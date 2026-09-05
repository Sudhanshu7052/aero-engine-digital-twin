import React, { useEffect, useState } from "react";

export default function MissionReplay({ fetchMissions, replayMission, replay }) {
  const [missions, setMissions] = useState([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const list = await fetchMissions();
      setMissions(list);
      if (!selected && list.length) setSelected(String(list[0].id));
    } catch {
      /* noop */
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePlay() {
    if (!selected) return;
    setBusy(true);
    try {
      await replayMission(Number(selected));
    } finally {
      setBusy(false);
    }
  }

  const chosen = missions.find((m) => String(m.id) === selected);

  return (
    <div className="panel">
      <div className="panel-head">
        <p className="panel-title">Mission Replay</p>
      </div>
      <p className="panel-sub">Re-run any recorded mission from SQLite: dashboard follows the historical data</p>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>Recorded mission</label>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {missions.length === 0 && <option value="">No missions recorded yet</option>}
          {missions.map((m) => (
            <option key={m.id} value={m.id}>
              #{m.id} &middot; {m.label} &middot; {m.status} &middot; {m.rowCount} rows
            </option>
          ))}
        </select>
      </div>

      <button className="btn full" onClick={handlePlay} disabled={busy || !selected || replay?.active}>
        &#9654; {replay?.active ? "Playing\u2026" : busy ? "Starting\u2026" : "Play"}
      </button>

      {!chosen && missions.length === 0 && (
        <p style={{ fontSize: "0.76rem", color: "var(--text-faint)", marginTop: 10 }}>
          Select a mission and press Play. Missions are recorded automatically whenever you start one in the Mission
          Simulator. (Start a mission first if the list is empty.)
        </p>
      )}

      {replay?.active && (
        <div className="replay-progress">
          <p style={{ fontSize: "0.78rem", color: "var(--text-dim)", margin: "0 0 2px" }}>
            Replaying <b>{replay.label}</b> &middot; row {replay.index}/{replay.total}
          </p>
          <div className="replay-track">
            <div className="replay-fill" style={{ width: `${(replay.index / replay.total) * 100}%` }} />
          </div>
          {replay.row && (
            <div className="replay-readout">
              <div>
                <span>RPM</span>
                {Math.round(replay.row.values.rpm)}
              </div>
              <div>
                <span>CHT &deg;C</span>
                {Math.round(replay.row.values.cht)}
              </div>
              <div>
                <span>EGT &deg;C</span>
                {Math.round(replay.row.values.egt)}
              </div>
              <div>
                <span>Health</span>
                {replay.row.health.toFixed(1)}
              </div>
              <div>
                <span>Anomaly</span>
                {replay.row.anomalyScore}
              </div>
              <div>
                <span>Predicted</span>
                {replay.row.predicted}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
