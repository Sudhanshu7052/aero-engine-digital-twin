import React, { useEffect, useRef } from "react";
import { playAlertForSeverity } from "../alertSound.js";

function chipClass(sev) {
  return sev.toLowerCase();
}

export default function AlertsAndAdvisory({ state }) {
  const seenIds = useRef(new Set());
  const primed = useRef(false);

  const alertsForEffect = state?.alerts;
  useEffect(() => {
    if (!alertsForEffect) return;
    if (!primed.current) {
      // first render: just remember what's already there, don't sound off
      // for alerts that existed before this page loaded
      alertsForEffect.forEach((a) => seenIds.current.add(a.id));
      primed.current = true;
      return;
    }
    alertsForEffect.forEach((a) => {
      if (!seenIds.current.has(a.id)) {
        seenIds.current.add(a.id);
        playAlertForSeverity(a.severity);
      }
    });
  }, [alertsForEffect]);

  if (!state) return null;
  const { alerts, advisory } = state;

  return (
    <div className="two-col">
      <div className="panel">
        <div className="panel-head">
          <p className="panel-title">Alerts</p>
        </div>
        <p className="panel-sub">{alerts.length} recent &middot; severity-ranked rule engine + AI alerts</p>
        <div className="alerts-list scrollbar-thin">
          {alerts.length === 0 && (
            <p style={{ color: "var(--text-faint)", fontSize: "0.82rem" }}>No alerts yet &mdash; system nominal.</p>
          )}
          {alerts.map((a) => (
            <div className="alert-item" key={a.id}>
              <span className={`chip ${chipClass(a.severity)}`}>{a.severity}</span>
              <div className="msg">{a.message}</div>
              <div className="meta">
                {a.simClock} &middot; {a.tag} &middot; {a.source}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <p className="panel-title">Maintenance Advisory</p>
        </div>
        <p className="panel-sub">Explainable prototype recommendation</p>
        {!advisory && (
          <p style={{ color: "var(--text-faint)", fontSize: "0.85rem" }}>
            No active advisory &mdash; telemetry within expected envelope.
          </p>
        )}
        {advisory && (
          <>
            <span className={`chip ${chipClass(advisory.severity)}`}>{advisory.severity}</span>
            <span style={{ marginLeft: 8, fontSize: "0.68rem", color: "var(--text-faint)", letterSpacing: "0.05em" }}>
              {advisory.label}
            </span>
            <div className="advisory-title">{advisory.title}</div>
            <p className="advisory-body">{advisory.body}</p>
          </>
        )}
      </div>
    </div>
  );
}
