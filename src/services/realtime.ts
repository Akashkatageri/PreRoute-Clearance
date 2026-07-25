import { Emergency } from "../types";
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

type Listener = (emergencies: Emergency[]) => void;

class RealtimeSyncService {
  private listeners: Set<Listener> = new Set();
  private cache: Emergency[] = [];

  constructor() {
    this.initFirestoreListener();
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
            const emergencyItem: Emergency = {
              id: docId,
              vehicleId: (raw.vehicleId && raw.vehicleId.trim()) || "AMBULANCE-108",
              destinationName: (raw.destinationName && raw.destinationName.trim()) || "General Hospital",
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
              lastUpdated: raw.lastUpdated || new Date().toISOString(),
              routeGeometry: raw.routeGeometry || []
            };

            firestoreList.push(emergencyItem);
          }
        });

        // Always update cache and notify, even if list is empty (cleared/completed)
        this.cache = firestoreList;
        this.notify();
      }, (error) => {
        console.warn("Firestore onSnapshot realtime listener notice:", error);
      });
    } catch (e) {
      console.warn("Could not setup Firestore realtime listener:", e);
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    // Notify subscriber immediately with current cloud cache
    listener(this.cache);
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
      vehicleId: emergencyData.vehicleId || "AMBULANCE-108",
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
      lastUpdated: now.toISOString(),
      routeGeometry: emergencyData.routeGeometry || []
    };

    // 1. Immediately persist to Firestore cloud database (guarantees cross-device sync web <-> android)
    try {
      await setDoc(doc(db, "emergencies", id), newEmergency);
    } catch (e) {
      console.warn("Firestore setDoc create emergency error:", e);
    }

    // 2. Also send to Express server API route
    try {
      await fetch("/api/emergencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEmergency)
      }).catch((e) => console.warn("Express API create Emergency notice:", e));
    } catch (e) {
      console.warn("API createEmergency fetch error:", e);
    }

    // 3. Update local cache
    const existingIdx = this.cache.findIndex((e) => e.id === id);
    if (existingIdx >= 0) {
      this.cache[existingIdx] = newEmergency;
    } else {
      this.cache.push(newEmergency);
    }
    this.notify();

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
