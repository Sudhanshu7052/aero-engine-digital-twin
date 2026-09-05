import React from "react";

export default function Header({ state, connected, replay, onStart, onStop }) {
  const running = state?.simRunning;
  const mode = replay?.active ? "replay" : "live";

  return (
    <header className="header">
      <div className="header-left">
        <div className="header-mark">DT</div>
        <div className="header-title">
          <h1>AI-Enabled Aero Engine Digital Twin</h1>
          <p>Health Monitoring &middot; Fault Prediction &middot; Mission Reliability &mdash; synthetic-data prototype</p>
        </div>
      </div>

      <div className="header-right">
        {!connected && <span className="badge off">connecting&hellip;</span>}
        <span className={`badge ${running ? "on" : "off"}`}>
          <span className="dot" /> {running ? "SIM RUNNING" : "SIM PAUSED"}
        </span>
        <span className={`badge ${mode === "replay" ? "replay" : "live"}`}>
          <span className="dot" /> {mode === "replay" ? "REPLAY" : "LIVE"}
        </span>
        {state && (
          <span className="readout">
            tick <b>{state.tick}</b> &nbsp;sim clock <b>{state.simClockSec}s</b> &nbsp;{state.speed}&times; speed
          </span>
        )}
        <button className="btn" onClick={onStart} disabled={running}>
          Start Sim
        </button>
        <button className="btn danger" onClick={onStop} disabled={!running}>
          Stop Sim
        </button>
      </div>
    </header>
  );
}
