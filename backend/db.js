// db.js
// Lightweight SQLite persistence for recorded missions + their telemetry,
// used by the Mission Replay feature.

import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "missions.sqlite"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_key TEXT NOT NULL,
    label TEXT NOT NULL,
    duration REAL,
    altitude REAL,
    ambient REAL,
    throttle REAL,
    status TEXT NOT NULL DEFAULT 'running',
    row_count INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT
  );

  CREATE TABLE IF NOT EXISTS mission_rows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mission_id INTEGER NOT NULL,
    tick INTEGER NOT NULL,
    sim_clock_sec REAL NOT NULL,
    payload TEXT NOT NULL,
    FOREIGN KEY (mission_id) REFERENCES missions(id)
  );
`);

const insertMissionStmt = db.prepare(
  `INSERT INTO missions (profile_key, label, duration, altitude, ambient, throttle, status)
   VALUES (@profileKey, @label, @duration, @altitude, @ambient, @throttle, @status)`
);

const insertRowStmt = db.prepare(
  `INSERT INTO mission_rows (mission_id, tick, sim_clock_sec, payload) VALUES (?, ?, ?, ?)`
);

const bumpRowCountStmt = db.prepare(
  `UPDATE missions SET row_count = row_count + 1 WHERE id = ?`
);

const finishMissionStmt = db.prepare(
  `UPDATE missions SET status = 'completed', finished_at = datetime('now') WHERE id = ?`
);

const listMissionsStmt = db.prepare(
  `SELECT id, profile_key as profileKey, label, duration, altitude, ambient, throttle,
          status, row_count as rowCount, started_at as startedAt, finished_at as finishedAt
   FROM missions ORDER BY id DESC LIMIT 50`
);

const getRowsStmt = db.prepare(
  `SELECT tick, sim_clock_sec as simClockSec, payload FROM mission_rows
   WHERE mission_id = ? ORDER BY id ASC`
);

const getMissionStmt = db.prepare(`SELECT * FROM missions WHERE id = ?`);

export function insertMission(mission) {
  const info = insertMissionStmt.run(mission);
  return info.lastInsertRowid;
}

export function insertMissionRow(missionId, tick, simClockSec, payload) {
  insertRowStmt.run(missionId, tick, simClockSec, JSON.stringify(payload));
  bumpRowCountStmt.run(missionId);
}

export function finishMission(missionId) {
  finishMissionStmt.run(missionId);
}

export function listMissions() {
  return listMissionsStmt.all();
}

export function getMission(missionId) {
  return getMissionStmt.get(missionId);
}

export function getMissionRows(missionId) {
  return getRowsStmt.all(missionId).map((r) => ({
    tick: r.tick,
    simClockSec: r.simClockSec,
    ...JSON.parse(r.payload),
  }));
}

export default db;
