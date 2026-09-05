// server.js
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import http from "node:http";

import { DigitalTwin } from "./simulation.js";
import { MISSION_PROFILES, FAULTS, TICK_MS } from "./definitions.js";
import * as db from "./db.js";

const PORT = process.env.PORT || 8787;

const app = express();
app.use(cors());
app.use(express.json());

const twin = new DigitalTwin((missionId, row) => {
  db.insertMissionRow(missionId, row.tick, row.simClockSec, row);
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

function broadcast(msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) client.send(data);
  });
}

// ---- Simulation loop -----------------------------------------------------
// One tick per real second. Simple setInterval is good enough here — this
// isn't a physics engine, and drift over a normal demo session is
// negligible.
setInterval(() => {
  if (twin.mode === "replay") return;
  const result = twin.step();
  if (result?.missionFinished) {
    db.finishMission(result.missionFinished);
  }
  broadcast({ type: "state", data: twin.snapshot() });
}, TICK_MS);

// ---- REST API -------------------------------------------------------------

app.get("/api/state", (req, res) => {
  res.json(twin.snapshot());
});

app.post("/api/sim/start", (req, res) => {
  twin.startSim();
  res.json({ ok: true });
});

app.post("/api/sim/stop", (req, res) => {
  twin.stopSim();
  res.json({ ok: true });
});

app.get("/api/faults", (req, res) => {
  res.json(Object.values(FAULTS).map(({ key, label, description }) => ({ key, label, description })));
});

app.post("/api/fault", (req, res) => {
  const { type } = req.body || {};
  const ok = twin.injectFault(type);
  if (!ok) return res.status(400).json({ ok: false, error: "unknown fault type" });
  res.json({ ok: true });
});

app.post("/api/fault/clear", (req, res) => {
  twin.clearFault();
  res.json({ ok: true });
});

app.post("/api/manual-target", (req, res) => {
  twin.setManualTarget(req.body || {});
  res.json({ ok: true, manualTarget: twin.manualTarget });
});

app.get("/api/missions/profiles", (req, res) => {
  res.json(Object.values(MISSION_PROFILES));
});

app.post("/api/missions/start", (req, res) => {
  const { profileKey, duration, altitude, ambient, throttle } = req.body || {};
  if (!MISSION_PROFILES[profileKey]) {
    return res.status(400).json({ ok: false, error: "unknown mission profile" });
  }
  const mission = twin.startMission(profileKey, { duration, altitude, ambient, throttle }, (m) =>
    db.insertMission({
      profileKey: m.profileKey,
      label: m.label,
      duration: m.duration,
      altitude: m.altitude,
      ambient: m.ambient,
      throttle: m.throttle,
      status: "running",
    })
  );
  res.json({ ok: true, mission });
});

app.get("/api/missions", (req, res) => {
  res.json(db.listMissions());
});

app.post("/api/missions/:id/replay", (req, res) => {
  const id = Number(req.params.id);
  const mission = db.getMission(id);
  if (!mission) return res.status(404).json({ ok: false, error: "mission not found" });
  const rows = db.getMissionRows(id);
  if (!rows.length) return res.status(400).json({ ok: false, error: "mission has no recorded rows" });

  twin.mode = "replay";
  broadcast({ type: "replay_start", data: { missionId: id, label: mission.label, total: rows.length } });

  let i = 0;
  const replayInterval = setInterval(() => {
    if (i >= rows.length) {
      clearInterval(replayInterval);
      twin.mode = "live";
      broadcast({ type: "replay_end", data: { missionId: id } });
      broadcast({ type: "state", data: twin.snapshot() });
      return;
    }
    const row = rows[i];
    broadcast({
      type: "replay_row",
      data: {
        missionId: id,
        index: i,
        total: rows.length,
        tick: row.tick,
        simClockSec: row.simClockSec,
        values: row.values,
        health: row.health,
        anomalyScore: row.anomalyScore,
        predicted: row.predicted,
      },
    });
    i += 1;
  }, 250);

  res.json({ ok: true, started: true, rowCount: rows.length });
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

// ---- WebSocket ------------------------------------------------------------
wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "state", data: twin.snapshot() }));
});

server.listen(PORT, () => {
  console.log(`\n  AI-Enabled Aero Engine Digital Twin API`);
  console.log(`  REST + WebSocket listening on http://localhost:${PORT}`);
  console.log(`  WebSocket path: ws://localhost:${PORT}/ws\n`);
});
