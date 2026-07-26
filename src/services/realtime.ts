import { Emergency } from "../types";
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

type Listener = (emergencies: Emergency[]) => void;

class RealtimeSyncService {
  private listeners: Set<Listener> = new Set();
  private cache: Emergency[] = [];

  constructor() {
    this.initFirestoreListener();
    this.initServerSSEAndPolling();
    this.startExpirationCheck();
  }

  private startExpirationCheck() {
    if (typeof window === "undefined") return;
    setInterval(() => {
      const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
      const now = Date.now();
      const expiredItems = this.cache.filter((e) => {
        const ts = e.createdTimestamp || (e.lastUpdated ? new Date(e.lastUpdated).getTime() : now);
        return now - ts > TWELVE_HOURS_MS;
      });

      for (const expired of expiredItems) {
        this.deleteEmergency(expired.id);
      }
    }, 30000);
  }

  // Merge list from Firestore or Express Server without wiping out locally active emergencies
  private mergeEmergencies(newList: Emergency[]) {
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
    const now = Date.now();
    const map = new Map<string, Emergency>();

    // Preserve existing cache items
    for (const emg of this.cache) {
      if (emg && emg.id) map.set(emg.id, emg);
    }

    // Merge incoming new items
    for (const item of newList) {
      if (!item || !item.id) continue;
      const createdTs = item.createdTimestamp || (item.lastUpdated ? new Date(item.lastUpdated).getTime() : now);
      if (now - createdTs > TWELVE_HOURS_MS) continue;

      const existing = map.get(item.id);
      if (!existing) {
        map.set(item.id, item);
      } else {
        const existingTs = new Date(existing.lastUpdated || 0).getTime();
        const incomingTs = new Date(item.lastUpdated || 0).getTime();

        if (incomingTs >= existingTs) {
          map.set(item.id, {
            ...existing,
            ...item,
            routeGeometry: (item.routeGeometry && item.routeGeometry.length > 0) ? item.routeGeometry : existing.routeGeometry
          });
        } else {
          map.set(item.id, {
            ...item,
            ...existing,
            routeGeometry: (existing.routeGeometry && existing.routeGeometry.length > 0) ? existing.routeGeometry : item.routeGeometry
          });
        }
      }
    }

    const mergedList = Array.from(map.values()).filter((e) => {
      if (!e || e.status === "completed" || e.status === "cleared") return false;
      const createdTs = e.createdTimestamp || (e.lastUpdated ? new Date(e.lastUpdated).getTime() : now);
      return now - createdTs <= TWELVE_HOURS_MS;
    });

    this.cache = mergedList;
    this.notify();
  }

  private initServerSSEAndPolling() {
    if (typeof window === "undefined") return;

    // 1. Initial fetch & periodic 2.5s polling from Express backend
    const fetchExpressEmergencies = async () => {
      try {
        const res = await fetch("/api/emergencies");
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list)) {
            this.mergeEmergencies(list);
          }
        }
      } catch (e) {
        // Quiet notice for polling
      }
    };

    fetchExpressEmergencies();
    setInterval(fetchExpressEmergencies, 2500);

    // 2. Real-time Server-Sent Events (SSE) Stream
    try {
      const eventSource = new EventSource("/api/emergencies/stream");
      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === "INIT" && Array.isArray(parsed.data)) {
            this.mergeEmergencies(parsed.data);
          } else if (parsed.type === "EMERGENCY_CREATED" && parsed.data) {
            this.mergeEmergencies([parsed.data]);
          } else if (parsed.type === "LOCATION_UPDATED" && parsed.data) {
            this.mergeEmergencies([parsed.data]);
          } else if (parsed.type === "STATUS_UPDATED" && parsed.data) {
            this.mergeEmergencies([parsed.data]);
          } else if (parsed.type === "EMERGENCY_DELETED" && parsed.data?.id) {
            this.cache = this.cache.filter((e) => e.id !== parsed.data.id);
            this.notify();
          }
        } catch (e) {
          console.warn("SSE parse notice:", e);
        }
      };
      eventSource.onerror = () => {
        // SSE reconnect handles automatically
      };
    } catch (e) {
      console.warn("SSE setup notice:", e);
    }
  }

  private initFirestoreListener() {
    try {
      if (typeof window === "undefined") return;
      const emergenciesCol = collection(db, "emergencies");

      onSnapshot(emergenciesCol, (snapshot) => {
        const firestoreList: Emergency[] = [];
        snapshot.forEach((docSnap) => {
          const raw = docSnap.data() as Partial<Emergency>;
          const docId = raw.id || docSnap.id;

          if (docId) {
            const rawCreatedTimestamp = typeof raw.createdTimestamp === "number" ? raw.createdTimestamp : (raw.lastUpdated ? new Date(raw.lastUpdated).getTime() : Date.now());
            const createdTimestamp = isNaN(rawCreatedTimestamp) || rawCreatedTimestamp <= 0 ? Date.now() : rawCreatedTimestamp;
            const ageMs = Date.now() - createdTimestamp;
            const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

            if (ageMs > TWELVE_HOURS_MS) {
              deleteDoc(doc(db, "emergencies", docId)).catch(() => {});
              return;
            }

            const emergencyItem: Emergency = {
              id: docId,
              vehicleId: (raw.vehicleId && raw.vehicleId.trim()) || docId || "AMBULANCE",
              destinationName: (raw.destinationName && raw.destinationName.trim()) || "Hospital",
              destinationAddress: (raw.destinationAddress && raw.destinationAddress.trim()) || raw.destinationName || "General Hospital",
              destinationLat: typeof raw.destinationLat === "number" ? raw.destinationLat : 12.8715,
              destinationLng: typeof raw.destinationLng === "number" ? raw.destinationLng : 77.5385,
              startLat: typeof raw.startLat === "number" ? raw.startLat : 12.8620,
              startLng: typeof raw.startLng === "number" ? raw.startLng : 77.5280,
              currentLat: typeof raw.currentLat === "number" ? raw.currentLat : (raw.startLat || 12.8620),
              currentLng: typeof raw.currentLng === "number" ? raw.currentLng : (raw.startLng || 77.5280),
              priority: raw.priority || "critical",
              status: raw.status || "active",
              etaMinutes: typeof raw.etaMinutes === "number" && !isNaN(raw.etaMinutes) && raw.etaMinutes >= 0 ? raw.etaMinutes : 3,
              distanceKm: typeof raw.distanceKm === "number" && !isNaN(raw.distanceKm) && raw.distanceKm >= 0 ? raw.distanceKm : 2.5,
              createdAt: (raw.createdAt && raw.createdAt.trim()) || "Just now",
              createdTimestamp,
              lastUpdated: raw.lastUpdated || new Date().toISOString(),
              routeGeometry: raw.routeGeometry || []
            };

            firestoreList.push(emergencyItem);
          }
        });

        this.mergeEmergencies(firestoreList);
      }, (error) => {
        console.warn("Firestore onSnapshot realtime listener notice:", error);
      });
    } catch (e) {
      console.warn("Could not setup Firestore realtime listener:", e);
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener([...this.cache]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener([...this.cache]);
      } catch (e) {
        console.warn("Error notifying realtime listener:", e);
      }
    }
  }

  public async createEmergency(emergencyData: Partial<Emergency>): Promise<Emergency> {
    const id = emergencyData.id || `EMG-${Math.floor(100 + Math.random() * 900)}`;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const newEmergency: Emergency = {
      id,
      vehicleId: (emergencyData.vehicleId && emergencyData.vehicleId.trim()) || "KA-05-EM-0108",
      destinationName: emergencyData.destinationName || "General Hospital",
      destinationAddress: emergencyData.destinationAddress || "Hospital Address",
      destinationLat: emergencyData.destinationLat || 12.8715,
      destinationLng: emergencyData.destinationLng || 77.5385,
      startLat: emergencyData.startLat || 12.8620,
      startLng: emergencyData.startLng || 77.5280,
      currentLat: emergencyData.currentLat || emergencyData.startLat || 12.8620,
      currentLng: emergencyData.currentLng || emergencyData.startLng || 77.5280,
      priority: emergencyData.priority || "critical",
      status: emergencyData.status || "active",
      etaMinutes: emergencyData.etaMinutes || 3,
      distanceKm: emergencyData.distanceKm || 3.1,
      createdAt: timeStr,
      createdTimestamp: now.getTime(),
      lastUpdated: now.toISOString(),
      routeGeometry: emergencyData.routeGeometry || []
    };

    // 1. Immediately update local cache & notify
    this.mergeEmergencies([newEmergency]);

    // 2. Persist to Firestore cloud database
    try {
      // Clean document object to avoid Firestore undefined field errors
      const docData = JSON.parse(JSON.stringify(newEmergency));
      await setDoc(doc(db, "emergencies", id), docData);
    } catch (e) {
      console.warn("Firestore setDoc create emergency error:", e);
    }

    // 3. Send to Express server API route
    try {
      await fetch("/api/emergencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEmergency)
      }).catch((e) => console.warn("Express API create Emergency notice:", e));
    } catch (e) {
      console.warn("API createEmergency fetch error:", e);
    }

    return newEmergency;
  }

  public async updateLocation(id: string, currentLat: number, currentLng: number, etaMinutes?: number, distanceKm?: number): Promise<void> {
    const payload: any = {
      id,
      currentLat,
      currentLng,
      lastUpdated: new Date().toISOString()
    };
    if (etaMinutes !== undefined) payload.etaMinutes = etaMinutes;
    if (distanceKm !== undefined) payload.distanceKm = distanceKm;

    // Update local cache state immediately
    const item = this.cache.find((e) => e.id === id);
    if (item) {
      item.currentLat = currentLat;
      item.currentLng = currentLng;
      if (etaMinutes !== undefined) item.etaMinutes = etaMinutes;
      if (distanceKm !== undefined) item.distanceKm = distanceKm;
      item.lastUpdated = payload.lastUpdated;
      this.notify();
    }

    // Persist to Firestore server database
    try {
      await updateDoc(doc(db, "emergencies", id), payload);
    } catch (e) {
      console.warn("Firestore updateLocation error:", e);
    }

    // Also update Express backend
    try {
      fetch(`/api/emergencies/${id}/location`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch((e) => console.warn("API updateLocation error:", e));
    } catch (e) {
      console.warn("API updateLocation exception:", e);
    }
  }

  public async updateStatus(id: string, status: Emergency['status']): Promise<void> {
    const payload = {
      id,
      status,
      lastUpdated: new Date().toISOString()
    };

    // Update local cache state immediately
    const item = this.cache.find((e) => e.id === id);
    if (item) {
      item.status = status;
      item.lastUpdated = payload.lastUpdated;
      this.notify();
    }

    // Persist to Firestore server database with merge
    try {
      await setDoc(doc(db, "emergencies", id), payload, { merge: true });
    } catch (e) {
      console.warn("Firestore updateStatus error:", e);
    }

    // Also update Express backend
    try {
      fetch(`/api/emergencies/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      }).catch((e) => console.warn("API updateStatus error:", e));
    } catch (e) {
      console.warn("API updateStatus exception:", e);
    }
  }

  public async deleteEmergency(id: string): Promise<void> {
    // Update local cache
    this.cache = this.cache.filter((e) => e.id !== id);
    this.notify();

    // Remove from Firestore
    try {
      await deleteDoc(doc(db, "emergencies", id));
    } catch (e) {
      console.warn("Firestore deleteEmergency error:", e);
    }

    // Remove from Express backend
    try {
      fetch(`/api/emergencies/${id}`, {
        method: "DELETE"
      }).catch((e) => console.warn("API deleteEmergency error:", e));
    } catch (e) {
      console.warn("API deleteEmergency exception:", e);
    }
  }
}

export const realtimeService = new RealtimeSyncService();
