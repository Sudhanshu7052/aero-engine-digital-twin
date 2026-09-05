import React, { useEffect, useState } from "react";
import { playInjectClick } from "../alertSound.js";

export function MissionSimulator({ startMission, fetchMissionProfiles, state }) {
  const [profiles, setProfiles] = useState([]);
  const [profileKey, setProfileKey] = useState("high_altitude");
  const [duration, setDuration] = useState("");
  const [altitude, setAltitude] = useState("");
  const [ambient, setAmbient] = useState("");
  const [throttle, setThrottle] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchMissionProfiles().then(setProfiles).catch(() => {});
  }, [fetchMissionProfiles]);

  const active = profiles.find((p) => p.key === profileKey);
  const mission = state?.mission;

  async function handleStart() {
    setBusy(true);
    try {
      await startMission({ profileKey, duration: duration || undefined, altitude: altitude || undefined, ambient: ambient || undefined, throttle: throttle || undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <p className="panel-title">Mission Simulator</p>
      </div>
      <p className="panel-sub">Fictional mission profiles drive the synthetic engine (30&times; simulated clock)</p>

      <div className="field" style={{ marginBottom: 10 }}>
        <label>Mission profile</label>
        <select value={profileKey} onChange={(e) => setProfileKey(e.target.value)}>
          {profiles.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      {active && <p className="field-desc">{active.description}</p>}

      <div className="form-row">
        <div className="field">
          <label>Duration (sim min)</label>
          <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder={active?.duration ?? "20"} />
        </div>
        <div className="field">
          <label>Altitude ft (opt.)</label>
          <input value={altitude} onChange={(e) => setAltitude(e.target.value)} placeholder="profile" />
        </div>
        <div className="field">
          <label>Ambient &deg;C (opt.)</label>
          <input value={ambient} onChange={(e) => setAmbient(e.target.value)} placeholder="profile" />
        </div>
      </div>
      <div className="field" style={{ marginBottom: 14 }}>
        <label>Throttle % (opt.)</label>
        <input value={throttle} onChange={(e) => setThrottle(e.target.value)} placeholder="profile" />
      </div>

      <button className="btn primary full" onClick={handleStart} disabled={busy || !!mission}>
        {mission ? `Mission running (${mission.progressPct}%)` : busy ? "Starting\u2026" : "Start Simulation"}
      </button>
      {mission && (
        <div className="stat-bar-track" style={{ marginTop: 10 }}>
          <div className="stat-bar-fill" style={{ width: `${mission.progressPct}%`, background: "var(--cyan)" }} />
        </div>
      )}
    </div>
  );
}

export function ManualOperatingPoint({ setManualTarget, state }) {
  const [throttle, setThrottle] = useState(40);
  const [altitude, setAltitude] = useState(1500);
  const [ambient, setAmbient] = useState(15);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state?.manualTarget) {
      setThrottle(state.manualTarget.throttle);
      setAltitude(state.manualTarget.altitude);
      setAmbient(state.manualTarget.ambient);
    }
  }, [state?.manualTarget?.throttle, state?.manualTarget?.altitude, state?.manualTarget?.ambient]); // eslint-disable-line

  async function apply() {
    setBusy(true);
    try {
      await setManualTarget({ throttle, altitude, ambient });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <p className="panel-title">Manual Operating Point</p>
        <span style={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>applies to free-running simulation</span>
      </div>

      <div className="slider-row">
        <label style={{ fontSize: "0.78rem", color: "var(--text-dim)", minWidth: 70 }}>Throttle</label>
        <input type="range" min="0" max="100" value={throttle} onChange={(e) => setThrottle(Number(e.target.value))} />
        <span className="slider-value">{throttle}%</span>
      </div>

      <div className="form-row" style={{ marginTop: 14, gridTemplateColumns: "1fr 1fr" }}>
        <div className="field">
          <label>Altitude ft</label>
          <input type="number" value={altitude} onChange={(e) => setAltitude(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Ambient &deg;C</label>
          <input type="number" value={ambient} onChange={(e) => setAmbient(Number(e.target.value))} />
        </div>
      </div>

      <button className="btn full" onClick={apply} disabled={busy}>
        {busy ? "Applying\u2026" : "Apply Targets"}
      </button>
    </div>
  );
}

export function FaultSimulator({ injectFault, clearFault, fetchFaultTypes, state }) {
  const [faults, setFaults] = useState([]);
  const [type, setType] = useState("overheating");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchFaultTypes().then(setFaults).catch(() => {});
  }, [fetchFaultTypes]);

  const active = state?.activeFault;
  const selected = faults.find((f) => f.key === type);

  async function handleInject() {
    playInjectClick(); // instant audible feedback the moment the fault is injected
    setBusy(true);
    try {
      await injectFault(type);
    } finally {
      setBusy(false);
    }
  }
  async function handleClear() {
    setBusy(true);
    try {
      await clearFault();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <p className="panel-title">Fault Simulator</p>
      </div>
      <p className="panel-sub">Inject synthetic faults and watch the twin + AI pipeline react end-to-end</p>

      <div className="field" style={{ marginBottom: 8 }}>
        <label>Fault type</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {faults.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      {selected && <p className="field-desc">{selected.description}</p>}

      <div className="inline-actions">
        <button className="btn danger" onClick={handleInject} disabled={busy}>
          &#9889; Inject Fault
        </button>
        <button className="btn ghost" onClick={handleClear} disabled={busy}>
          Clear Fault
        </button>
        {active && <span className="chip warning">severity {active.severity}%</span>}
      </div>

      {active ? (
        <div className="fault-active-box">
          <span>
            Active: <b>{active.label.toLowerCase()}</b>
            {active.clearing ? " (clearing)" : ""}
          </span>
        </div>
      ) : (
        <div className="fault-active-box" style={{ color: "var(--text-faint)" }}>
          No active fault
        </div>
      )}

      <p style={{ fontSize: "0.72rem", color: "var(--text-faint)", marginTop: 10 }}>
        Fault develops gradually (~10 real seconds at 30&times; simulated clock).
      </p>
      <p style={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>
        Demo tip: inject a fault, then watch Deviations &rarr; Anomaly Score &rarr; Predicted Condition &rarr; Health &rarr; Degradation &rarr; RUL &rarr; Alerts &rarr; Advisory update in sequence.
      </p>
    </div>
  );
}
