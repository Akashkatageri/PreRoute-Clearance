import { Emergency } from "../types";

type Listener = (emergencies: Emergency[]) => void;

class RealtimeSyncService {
  private listeners: Set<Listener> = new Set();
  private cache: Emergency[] = [];
  private eventSource: EventSource | null = null;
  private pollingTimer: any = null;

  constructor() {
    this.initSSE();
    this.startPolling();
  }

  private initSSE() {
    try {
      if (typeof window === "undefined") return;
      this.eventSource = new EventSource("/api/emergencies/stream");

      this.eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "INIT") {
            this.cache = payload.data;
            this.notify();
          } else {
            this.fetchLatest();
          }
        } catch (e) {
          console.error("SSE parse error:", e);
        }
      };

      this.eventSource.onerror = () => {
        // SSE disconnected, fallback polling takes over seamlessly
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
        this.cache = data;
        this.notify();
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
    await this.fetchLatest();
    return created;
  }

  public async updateLocation(id: string, currentLat: number, currentLng: number, etaMinutes?: number, distanceKm?: number): Promise<void> {
    await fetch(`/api/emergencies/${id}/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentLat, currentLng, etaMinutes, distanceKm })
    });
    await this.fetchLatest();
  }

  public async updateStatus(id: string, status: Emergency['status']): Promise<void> {
    await fetch(`/api/emergencies/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    await this.fetchLatest();
  }

  public async deleteEmergency(id: string): Promise<void> {
    await fetch(`/api/emergencies/${id}`, {
      method: "DELETE"
    });
    await this.fetchLatest();
  }
}

export const realtimeService = new RealtimeSyncService();
