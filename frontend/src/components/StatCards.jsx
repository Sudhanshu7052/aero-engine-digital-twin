import React from "react";

function statusAccent(status) {
  if (status === "CRITICAL") return "accent-red";
  if (status === "WARNING") return "accent-amber";
  if (status === "CAUTION") return "accent-amber";
  return "accent-green";
}
function statusChip(status) {
  if (status === "CRITICAL") return "critical";
  if (status === "WARNING") return "warning";
  if (status === "CAUTION") return "caution";
  return "nominal";
}

export default function StatCards({ state }) {
  if (!state) return null;
  const { health, anomaly, predicted, degradation } = state;

  return (
    <div className="grid cols-3">
      <div className="panel stat-card accent-cyan">
        <p className="panel-title">Engine Health</p>
        <div className="stat-value">
          {health.value.toFixed(1)}
          <span className="unit">/100</span>
        </div>
        <div className="stat-bar-track">
          <div
            className="stat-bar-fill"
            style={{ width: `${health.value}%`, background: health.value < 25 ? "var(--red)" : health.value < 50 ? "var(--amber)" : "var(--cyan)" }}
          />
        </div>
        <span className={`chip ${statusChip(health.status)}`}>{health.status}</span>
        <span style={{ marginLeft: 8, fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--text-faint)" }}>
          prev {health.prev.toFixed(1)} &middot; trend {health.trendPerMin >= 0 ? "+" : ""}
          {health.trendPerMin.toFixed(2)}/min
        </span>
      </div>

      <div className={`panel stat-card ${statusAccent(health.status)}`}>
        <p className="panel-title">Engine Status</p>
        <div className="stat-value text">{health.status}</div>
        <p style={{ margin: "4px 0 10px", fontSize: "0.85rem", color: "var(--text-dim)" }}>{predicted.label}</p>
        {health.contributors.map((c) => (
          <div className="contrib-row" key={c.label}>
            <b>{c.label}</b>
            <span className="pts">{c.pts} pts</span>
          </div>
        ))}
      </div>

      <div className="panel stat-card accent-violet">
        <p className="panel-title">Anomaly Score</p>
        <p className="meta-line">model: {anomaly.model}</p>
        <div className="stat-value">
          {anomaly.score}
          <span className="unit">/100</span>
        </div>
        <div className="stat-bar-track">
          <div className="stat-bar-fill" style={{ width: `${anomaly.score}%`, background: "var(--violet)" }} />
        </div>
        {anomaly.flagged && <span className="chip anomaly">ANOMALY</span>}
      </div>

      <div className="panel stat-card accent-amber">
        <p className="panel-title">Predicted Condition</p>
        <p className="meta-line">Random-Forest fault classifier</p>
        <div className="stat-value text">{predicted.label}</div>
        <div className="stat-bar-track">
          <div className="stat-bar-fill" style={{ width: `${predicted.confidence}%`, background: "var(--amber)" }} />
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.76rem", color: "var(--text-dim)" }}>
          confidence {predicted.confidence}%
        </span>
      </div>

      <div className="panel stat-card accent-cyan" style={{ gridColumn: "span 2" }}>
        <p className="panel-title">Prototype RUL Estimate</p>
        <p className="meta-line">method: {degradation.method} to inspection threshold ({degradation.threshold}/100)</p>
        <div className="stat-value">
          {degradation.rulSimHours >= 100 ? "99+" : degradation.rulSimHours.toFixed(1)}
          <span className="unit">sim h</span>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.76rem", color: "var(--text-dim)" }}>
          degradation {degradation.value.toFixed(1)}/100 &middot; threshold {degradation.threshold}
        </span>
        <p style={{ margin: "8px 0 0", fontSize: "0.74rem", color: "var(--text-faint)" }}>
          Simulated estimate for demonstration only &mdash; not a certified engine-life prediction.
        </p>
      </div>
    </div>
  );
}
