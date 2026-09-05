import React from "react";
import Sparkline from "./Sparkline.jsx";

const COLORS = {
  rpm: "#0d9488",
  cht: "#db2777",
  egt: "#b45309",
  oilPressure: "#059669",
  oilTemp: "#ca8a04",
  fuelFlow: "#2563eb",
  vibration: "#7c3aed",
  batteryVoltage: "#dc2626",
};

function sigmaClass(dev) {
  const a = Math.abs(dev);
  if (a >= 3) return "bad";
  if (a >= 1.5) return "warn";
  return "ok";
}

export default function LiveParameters({ state }) {
  if (!state) return null;
  const { params } = state;

  return (
    <div className="panel">
      <div className="panel-head">
        <p className="panel-title">Live Parameters</p>
      </div>
      <p className="panel-sub">Synthetic telemetry &middot; &Delta; = deviation from digital-twin expectation (&sigma;) &middot; shown in live mode</p>
      <div className="grid params">
        {Object.entries(params).map(([key, p]) => (
          <div className="param-card" key={key}>
            <div className="param-head">
              <span className="param-label">{p.label}</span>
              <span className={`sigma-badge ${sigmaClass(p.deviation)}`}>
                &Delta; {p.deviation >= 0 ? "+" : ""}
                {p.deviation.toFixed(1)}&sigma;
              </span>
            </div>
            <div className="param-value">
              {p.value}
              <span className="unit">{p.unit}</span>
            </div>
            <Sparkline data={p.history} color={COLORS[key]} />
            <div className="param-foot">
              <span>&nbsp;</span>
              <span>exp {p.exp}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
