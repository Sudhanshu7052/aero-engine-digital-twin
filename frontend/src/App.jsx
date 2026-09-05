import React from "react";
import { useDigitalTwin } from "./api.js";

import Header from "./components/Header.jsx";
import UAVTwin3D from "./components/UAVTwin3D.jsx";
import StatCards from "./components/StatCards.jsx";
import LiveParameters from "./components/LiveParameters.jsx";
import TelemetryGraphs from "./components/TelemetryGraphs.jsx";
import AIDiagnostics from "./components/AIDiagnostics.jsx";
import DegradationRUL from "./components/DegradationRUL.jsx";
import AlertsAndAdvisory from "./components/AlertsAndAdvisory.jsx";
import { MissionSimulator, ManualOperatingPoint, FaultSimulator } from "./components/ControlPanels.jsx";
import MissionReplay from "./components/MissionReplay.jsx";

export default function App() {
  const twin = useDigitalTwin();
  const { state, connected, replay } = twin;

  return (
    <div className="app-shell">
      <Header state={state} connected={connected} replay={replay} onStart={twin.startSim} onStop={twin.stopSim} />

      {!connected && (
        <div className="connection-banner">
          Connecting to the digital-twin backend at <code>/api</code> &amp; <code>/ws</code>. Make sure the backend
          server is running (<code>npm run dev</code> inside <code>/backend</code>).
        </div>
      )}

      {state ? (
        <>
          <div className="panel twin-visual-panel">
            <div className="panel-head">
              <p className="panel-title">Digital Twin Visualization</p>
              <span style={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>
                pusher-prop speed, lean &amp; engine glow follow live telemetry when linked
              </span>
            </div>
            <div className="twin-visual-body">
              <UAVTwin3D
                rpm={state.params.rpm.value}
                vibration={state.params.vibration.value}
                throttle={state.manualTarget.throttle}
                status={state.health.status}
              />
              <div className="twin-visual-readout">
                <div>
                  <span>Engine RPM</span>
                  <b>{state.params.rpm.value}</b>
                </div>
                <div>
                  <span>Vibration</span>
                  <b>{state.params.vibration.value}g</b>
                </div>
                <div>
                  <span>Throttle</span>
                  <b>{state.manualTarget.throttle}%</b>
                </div>
                <div>
                  <span>Status</span>
                  <b className={`status-${state.health.status.toLowerCase()}`}>{state.health.status}</b>
                </div>
              </div>
            </div>
          </div>

          <StatCards state={state} />
          <LiveParameters state={state} />
          <TelemetryGraphs state={state} />
          <AIDiagnostics state={state} onRetrain={() => window.alert("Retraining is simulated in this prototype \u2014 models are static heuristics.")} />
          <DegradationRUL state={state} />
          <AlertsAndAdvisory state={state} />

          <div className="grid cols-2">
            <MissionSimulator startMission={twin.startMission} fetchMissionProfiles={twin.fetchMissionProfiles} state={state} />
            <FaultSimulator
              injectFault={twin.injectFault}
              clearFault={twin.clearFault}
              fetchFaultTypes={twin.fetchFaultTypes}
              state={state}
            />
          </div>

          <div className="grid cols-2">
            <ManualOperatingPoint setManualTarget={twin.setManualTarget} state={state} />
            <MissionReplay fetchMissions={twin.fetchMissions} replayMission={twin.replayMission} replay={replay} />
          </div>

          <footer className="disclaimer">
            Educational prototype &middot; all telemetry is synthetic &middot; no connection to any real aircraft,
            engine, ECU, FADEC or hardware &middot; RUL is a Prototype RUL Estimate, not a certified engine-life
            prediction.
          </footer>
        </>
      ) : (
        <div className="panel">
          <p style={{ color: "var(--text-dim)" }}>Waiting for telemetry&hellip;</p>
        </div>
      )}
    </div>
  );
}
