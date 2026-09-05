import React from "react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid } from "recharts";

function TrendChart({ data, color, title }) {
  return (
    <div className="chart-card">
      <h4>{title}</h4>
      <ResponsiveContainer width="100%" height={130}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="#e5e9ef" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#98a2b0" }} interval="preserveStartEnd" minTickGap={40} />
          <YAxis tick={{ fontSize: 10, fill: "#98a2b0" }} width={34} domain={["auto", "auto"]} />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DegradationRUL({ state }) {
  if (!state) return null;
  const { degradation } = state;

  return (
    <div className="panel">
      <div className="panel-head">
        <p className="panel-title">Degradation / RUL</p>
      </div>
      <p className="panel-sub">Health trend &middot; degradation trend &middot; Prototype RUL Estimate</p>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <div className="stat-value">
            {degradation.rulSimHours >= 100 ? "99+" : degradation.rulSimHours.toFixed(1)}
            <span className="unit">sim hours</span>
          </div>
          <p style={{ fontSize: "0.72rem", color: "var(--text-faint)", margin: "4px 0 0" }}>
            Prototype RUL Estimate &middot; life-fraction reference {(degradation.rulSimHours * 0.4 + 20).toFixed(0)} h
          </p>
        </div>
        <p style={{ fontSize: "0.74rem", color: "var(--text-faint)", marginLeft: "auto", maxWidth: 260, textAlign: "right" }}>
          degradation-trend extrapolation to inspection threshold ({degradation.threshold}/100)
        </p>
      </div>

      <div className="grid cols-2">
        <TrendChart title="Health Trend" data={degradation.healthHistory} color="#059669" />
        <TrendChart title="Degradation Trend" data={degradation.degradationHistory} color="#b45309" />
      </div>
      <p style={{ fontSize: "0.72rem", color: "var(--text-faint)", marginTop: 10 }}>
        Simulated estimate for demonstration only &mdash; not a certified engine-life prediction.
      </p>
    </div>
  );
}
