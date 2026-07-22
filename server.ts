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
  routeGeometry?: [number, number][];
  lastUpdated: string;
}

const app = express();
app.use(express.json());

const PORT = 3000;

// In-memory real-time store for active emergencies
const emergencies: Record<string, Emergency> = {
  "EMG-701": {
    id: "EMG-701",
    vehicleId: "AMB-7",
    destinationName: "Zymus Hospitals",
    destinationAddress: "Zymus Hospitals, Kanakapura Road, Talagattapura, Bengaluru - 560109, KA, India",
    destinationLat: 12.8715,
    destinationLng: 77.5385,
    startLat: 12.8620,
    startLng: 77.5280,
    currentLat: 12.8620,
    currentLng: 77.5280,
    priority: "critical",
    status: "active",
    etaMinutes: 3,
    distanceKm: 3.1,
    createdAt: "7:20:59 PM",
    lastUpdated: new Date().toISOString(),
    routeGeometry: [
      [12.8620, 77.5280],
      [12.8645, 77.5305],
      [12.8670, 77.5330],
      [12.8690, 77.5360],
      [12.8715, 77.5385]
    ]
  }
};

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
  res.json(Object.values(emergencies));
});

app.post("/api/emergencies", (req, res) => {
  const {
    vehicleId,
    destinationName,
    destinationAddress,
    destinationLat,
    destinationLng,
    startLat,
    startLng,
    priority,
    etaMinutes,
    distanceKm,
    routeGeometry
  } = req.body;

  const id = `EMG-${Math.floor(100 + Math.random() * 900)}`;
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const newEmergency: Emergency = {
    id,
    vehicleId: vehicleId || "AMB-7",
    destinationName: destinationName || "Hospital",
    destinationAddress: destinationAddress || "Bengaluru",
    destinationLat: destinationLat || 12.8715,
    destinationLng: destinationLng || 77.5385,
    startLat: startLat || 12.8620,
    startLng: startLng || 77.5280,
    currentLat: startLat || 12.8620,
    currentLng: startLng || 77.5280,
    priority: priority || "critical",
    status: "active",
    etaMinutes: etaMinutes || 3,
    distanceKm: distanceKm || 3.1,
    createdAt: timeStr,
    lastUpdated: now.toISOString(),
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
    res.status(404).json({ error: "Emergency not found" });
    return;
  }

  const emg = emergencies[id];
  emg.currentLat = currentLat ?? emg.currentLat;
  emg.currentLng = currentLng ?? emg.currentLng;
  if (etaMinutes !== undefined) emg.etaMinutes = etaMinutes;
  if (distanceKm !== undefined) emg.distanceKm = distanceKm;
  emg.lastUpdated = new Date().toISOString();

  broadcastUpdate("LOCATION_UPDATED", emg);
  res.json(emg);
});

app.put("/api/emergencies/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!emergencies[id]) {
    res.status(404).json({ error: "Emergency not found" });
    return;
  }

  const emg = emergencies[id];
  emg.status = status;
  emg.lastUpdated = new Date().toISOString();

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
