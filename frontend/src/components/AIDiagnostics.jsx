import React from "react";

const FAULT_LABELS = {
  overheating: "Overheating",
  abnormal_vibration: "Abnormal Vibration",
  injector_abnormality: "Injector Abnormality",
  lubrication_issue: "Lubrication Issue",
};

export default function AIDiagnostics({ state, onRetrain }) {
  if (!state) return null;
  const { anomaly, predicted, featureImportance } = state;

  return (
    <div className="grid cols-2">
      <div className="panel">
        <div className="panel-head">
          <p className="panel-title">AI Diagnostics</p>
          <button className="btn small" onClick={onRetrain}>
            Retrain models
          </button>
        </div>
        <p className="panel-sub">Isolation Forest anomaly detection + Random Forest fault classification</p>

        <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div className="param-label" style={{ marginBottom: 6 }}>
              Anomaly Detector {anomaly.flagged && <span className="chip anomaly" style={{ marginLeft: 6 }}>ANOMALY</span>}
            </div>
            <div className="stat-value">
              {anomaly.score}
              <span className="unit">/100</span>
            </div>
            <div className="stat-bar-track">
              <div className="stat-bar-fill" style={{ width: `${anomaly.score}%`, background: "var(--red)" }} />
            </div>
            <p style={{ fontSize: "0.7rem", color: "var(--text-faint)", margin: "6px 0 0" }}>
              flag threshold {anomaly.threshold}/100 &middot; {anomaly.model}
            </p>
          </div>
          <div style={{ flex: 1 }}>
            <div className="param-label" style={{ marginBottom: 6 }}>
              Predicted Condition <span className="chip warning" style={{ marginLeft: 6 }}>{predicted.confidence}%</span>
            </div>
            <div className="stat-value text">{predicted.label}</div>
            {Object.entries(predicted.probs || {}).map(([key, val]) => (
              <div className="prob-row" key={key} style={{ marginTop: 8 }}>
                <div className="prob-label">
                  <span>{FAULT_LABELS[key]}</span>
                  <b>{val}%</b>
                </div>
                <div className="prob-track">
                  <div className="prob-fill" style={{ width: `${val}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <p className="panel-title">Contributing Parameters</p>
        </div>
        <p className="panel-sub">Random-Forest feature importance</p>
        {featureImportance.map((f) => (
          <div className="feature-row" key={f.key}>
            <span className="fname">{f.label}</span>
            <span className="fmeta">
              importance {f.importance.toFixed(1)}% &middot; value {f.value >= 0 ? "+" : ""}
              {f.value.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
