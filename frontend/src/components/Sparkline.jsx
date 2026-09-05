import React from "react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

export default function Sparkline({ data, color = "#0d9488", height = 34 }) {
  const points = (data || []).slice(-20).map((d, i) => ({ i, v: d.v }));
  if (points.length < 2) return <div style={{ height }} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
