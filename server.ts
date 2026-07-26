import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

interface Emergency {
  id: string;
  vehicleId: string;
  destinationName: string;
  destinationAddress: string;
  destinationLat: number;
  destinationLng: number;
  startLat: number;
  startLng: number;
  currentLat: number;
  currentLng: number;
  priority: "critical" | "high" | "normal";
  status: "active" | "acknowledged" | "cleared" | "completed";
  etaMinutes: number;
  distanceKm: number;
  createdAt: string;
  createdTimestamp?: number;
  routeGeometry?: [number, number][];
  lastUpdated: string;
}

const app = express();
app.use(express.json());

const PORT = 3000;

// In-memory real-time store for active emergencies
const emergencies: Record<string, Emergency> = {};

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

function purgeExpiredEmergencies() {
  const now = Date.now();
  for (const id of Object.keys(emergencies)) {
    const emg = emergencies[id];
    const createdTime = emg.createdTimestamp || (emg.lastUpdated ? new Date(emg.lastUpdated).getTime() : now);
    if (now - createdTime > TWELVE_HOURS_MS) {
      delete emergencies[id];
      broadcastUpdate("EMERGENCY_DELETED", { id });
    }
  }
}

// Periodic cleanup every minute
setInterval(purgeExpiredEmergencies, 60000);

const sseClients: express.Response[] = [];

function broadcastUpdate(type: string, data: any) {
  const payload = `data: ${JSON.stringify({ type, data })}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(payload);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

app.get("/api/emergencies", (req, res) => {
  purgeExpiredEmergencies();
  res.json(Object.values(emergencies));
});

app.post("/api/emergencies", (req, res) => {
  const {
    id: customId,
    vehicleId,
    destinationName,
    destinationAddress,
    destinationLat,
    destinationLng,
    startLat,
    startLng,
    currentLat,
    currentLng,
    priority,
    status,
    etaMinutes,
    distanceKm,
    routeGeometry,
    createdAt,
    createdTimestamp,
    lastUpdated
  } = req.body;

  const id = customId || `EMG-${Math.floor(100 + Math.random() * 900)}`;
  const now = new Date();
  const timeStr = createdAt || now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const newEmergency: Emergency = {
    id,
    vehicleId: vehicleId || "AMBULANCE",
    destinationName: destinationName || "Hospital",
    destinationAddress: destinationAddress || "Bengaluru",
    destinationLat: destinationLat || 12.8715,
    destinationLng: destinationLng || 77.5385,
    startLat: startLat || 12.8620,
    startLng: startLng || 77.5280,
    currentLat: typeof currentLat === "number" ? currentLat : (startLat || 12.8620),
    currentLng: typeof currentLng === "number" ? currentLng : (startLng || 77.5280),
    priority: priority || "critical",
    status: status || "active",
    etaMinutes: typeof etaMinutes === "number" ? etaMinutes : 3,
    distanceKm: typeof distanceKm === "number" ? distanceKm : 3.1,
    createdAt: timeStr,
    createdTimestamp: typeof createdTimestamp === "number" ? createdTimestamp : now.getTime(),
    lastUpdated: lastUpdated || now.toISOString(),
    routeGeometry: routeGeometry || []
  };

  emergencies[id] = newEmergency;
  broadcastUpdate("EMERGENCY_CREATED", newEmergency);
  res.status(201).json(newEmergency);
});

app.put("/api/emergencies/:id/location", (req, res) => {
  const { id } = req.params;
  const { currentLat, currentLng, etaMinutes, distanceKm } = req.body;

  if (!emergencies[id]) {
    if (req.body && req.body.vehicleId) {
      emergencies[id] = {
        ...req.body,
        id,
        currentLat: currentLat ?? req.body.currentLat,
        currentLng: currentLng ?? req.body.currentLng,
        lastUpdated: new Date().toISOString()
      };
    } else {
      return res.status(404).json({ error: "Emergency not found" });
    }
  } else {
    const emg = emergencies[id];
    if (typeof currentLat === "number") emg.currentLat = currentLat;
    if (typeof currentLng === "number") emg.currentLng = currentLng;
    if (etaMinutes !== undefined) emg.etaMinutes = etaMinutes;
    if (distanceKm !== undefined) emg.distanceKm = distanceKm;
    emg.lastUpdated = new Date().toISOString();
  }

  const emg = emergencies[id];
  broadcastUpdate("LOCATION_UPDATED", emg);
  res.json(emg);
});

app.put("/api/emergencies/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!emergencies[id]) {
    if (req.body && req.body.vehicleId) {
      emergencies[id] = {
        ...req.body,
        id,
        status: status || req.body.status || "acknowledged",
        lastUpdated: new Date().toISOString()
      };
    } else {
      return res.status(404).json({ error: "Emergency not found" });
    }
  } else {
    emergencies[id].status = status;
    emergencies[id].lastUpdated = new Date().toISOString();
  }

  const emg = emergencies[id];
  broadcastUpdate("STATUS_UPDATED", emg);
  res.json(emg);
});

app.delete("/api/emergencies/:id", (req, res) => {
  const { id } = req.params;
  if (emergencies[id]) {
    const deleted = emergencies[id];
    delete emergencies[id];
    broadcastUpdate("EMERGENCY_DELETED", { id });
    res.json({ success: true, deleted });
  } else {
    res.status(404).json({ error: "Not found" });
  }
});

app.get("/api/emergencies/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  sseClients.push(res);
  res.write(`data: ${JSON.stringify({ type: "INIT", data: Object.values(emergencies) })}\n\n`);

  req.on("close", () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
