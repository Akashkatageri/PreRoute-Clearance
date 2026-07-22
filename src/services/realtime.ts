import { Emergency } from "../types";
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

type Listener = (emergencies: Emergency[]) => void;

class RealtimeSyncService {
  private listeners: Set<Listener> = new Set();
  private cache: Emergency[] = [];
  private eventSource: EventSource | null = null;
  private pollingTimer: any = null;

  constructor() {
    this.initFirestoreListener();
    this.initSSE();
    this.startPolling();
  }

  private initFirestoreListener() {
    try {
      if (typeof window === "undefined") return;
      const emergenciesCol = collection(db, "emergencies");
      onSnapshot(emergenciesCol, (snapshot) => {
        const firestoreList: Emergency[] = [];
        snapshot.forEach((docSnap) => {
          firestoreList.push(docSnap.data() as Emergency);
        });

        if (firestoreList.length > 0) {
          this.cache = firestoreList;
          this.notify();
        }
      }, (error) => {
        console.warn("Firestore onSnapshot error:", error);
      });
    } catch (e) {
      console.warn("Could not setup Firestore realtime listener:", e);
    }
  }

  private initSSE() {
    try {
      if (typeof window === "undefined") return;
      this.eventSource = new EventSource("/api/emergencies/stream");

      this.eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "INIT") {
            if (payload.data && payload.data.length > 0) {
              this.cache = payload.data;
              this.notify();
            }
          } else {
            this.fetchLatest();
          }
        } catch (e) {
          console.error("SSE parse error:", e);
        }
      };

      this.eventSource.onerror = () => {
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
      };
    } catch (e) {
      console.warn("SSE init error, using polling:", e);
    }
  }

  private startPolling() {
    if (typeof window === "undefined") return;
    this.fetchLatest();
    this.pollingTimer = setInterval(() => {
      this.fetchLatest();
    }, 2000);
  }

  public async fetchLatest(): Promise<Emergency[]> {
    try {
      const res = await fetch("/api/emergencies");
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          this.cache = data;
          this.notify();
        }
        return data;
      }
    } catch (e) {
      console.warn("Fetch emergencies failed:", e);
    }
    return this.cache;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.cache);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.cache);
    }
  }

  public async createEmergency(emergencyData: Partial<Emergency>): Promise<Emergency> {
    const res = await fetch("/api/emergencies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(emergencyData)
    });
    const created = await res.json();

    // Also persist to Firestore for instant real-time multi-device synchronization
    try {
      await setDoc(doc(db, "emergencies", created.id), created);
    } catch (e) {
      console.warn("Firestore create emergency error:", e);
    }

    await this.fetchLatest();
    return created;
  }

  public async updateLocation(id: string, currentLat: number, currentLng: number, etaMinutes?: number, distanceKm?: number): Promise<void> {
    const payload: any = { currentLat, currentLng, lastUpdated: new Date().toISOString() };
    if (etaMinutes !== undefined) payload.etaMinutes = etaMinutes;
    if (distanceKm !== undefined) payload.distanceKm = distanceKm;

    fetch(`/api/emergencies/${id}/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch((e) => console.warn("API updateLocation error:", e));

    try {
      await updateDoc(doc(db, "emergencies", id), payload);
    } catch (e) {
      console.warn("Firestore updateLocation error:", e);
    }
  }

  public async updateStatus(id: string, status: Emergency['status']): Promise<void> {
    const payload = { status, lastUpdated: new Date().toISOString() };
    fetch(`/api/emergencies/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    }).catch((e) => console.warn("API updateStatus error:", e));

    try {
      await updateDoc(doc(db, "emergencies", id), payload);
    } catch (e) {
      console.warn("Firestore updateStatus error:", e);
    }
  }

  public async deleteEmergency(id: string): Promise<void> {
    fetch(`/api/emergencies/${id}`, {
      method: "DELETE"
    }).catch((e) => console.warn("API deleteEmergency error:", e));

    try {
      await deleteDoc(doc(db, "emergencies", id));
    } catch (e) {
      console.warn("Firestore deleteEmergency error:", e);
    }
  }
}

export const realtimeService = new RealtimeSyncService();
