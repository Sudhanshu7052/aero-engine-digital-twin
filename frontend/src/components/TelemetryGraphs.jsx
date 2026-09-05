import React from "react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

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

function Chart({ title, data, color, unit }) {
  return (
    <div className="chart-card">
      <h4>
        {title} {unit ? `(${unit})` : ""}
      </h4>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="#e5e9ef" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#98a2b0" }} interval="preserveStartEnd" minTickGap={40} />
          <YAxis tick={{ fontSize: 10, fill: "#98a2b0" }} width={40} domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{ background: "#ffffff", border: "1px solid #e1e6ed", fontSize: 12 }}
            labelStyle={{ color: "#64707e" }}
          />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function TelemetryGraphs({ state }) {
  if (!state) return null;
  const { params, degradation } = state;

  return (
    <div className="panel">
      <div className="panel-head">
        <p className="panel-title">Telemetry Graphs</p>
      </div>
      <p className="panel-sub">{Object.values(params)[0]?.history?.length || 0} samples &middot; simulated mission clock (mm:ss)</p>
      <div className="grid charts">
        {Object.entries(params).map(([key, p]) => (
          <Chart key={key} title={p.label} unit={p.unit} data={p.history} color={COLORS[key]} />
        ))}
        <Chart title="Health Index" data={degradation.healthHistory} color="#059669" />
      </div>
    </div>
  );
}
