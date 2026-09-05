// definitions.js
// Static configuration for the digital twin: telemetry parameters, fault
// signatures, mission profiles and the "trained model" feature importances.
// Everything here is a synthetic/prototype approximation for demo purposes.

export const PARAMS = {
  rpm: { label: "RPM", unit: "rpm", baseline: 1737, sigma: 45, decimals: 0 },
  cht: { label: "CHT", unit: "\u00b0C", baseline: 90, sigma: 12, decimals: 0 },
  egt: { label: "EGT", unit: "\u00b0C", baseline: 458, sigma: 24, decimals: 0 },
  oilPressure: { label: "Oil Pressure", unit: "psi", baseline: 55.4, sigma: 3.2, decimals: 1 },
  oilTemp: { label: "Oil Temperature", unit: "\u00b0C", baseline: 61.0, sigma: 7.5, decimals: 1 },
  fuelFlow: { label: "Fuel Flow", unit: "gph", baseline: 7.5, sigma: 0.3, decimals: 1 },
  vibration: { label: "Vibration", unit: "g", baseline: 0.52, sigma: 0.05, decimals: 2 },
  batteryVoltage: { label: "Battery Voltage", unit: "V", baseline: 27.8, sigma: 0.25, decimals: 1 },
};

// Which direction (in sigma-units per unit of fault severity, severity in [0,1])
// each fault pushes each parameter. Positive = increases, negative = decreases.
export const FAULTS = {
  overheating: {
    key: "overheating",
    label: "Overheating",
    description:
      "Cylinder-head / oil / EGT temperatures climb above the twin's expected envelope.",
    effects: { cht: 5.0, egt: 2.2, oilTemp: 3.2, oilPressure: -1.0, vibration: -0.2 },
  },
  abnormal_vibration: {
    key: "abnormal_vibration",
    label: "Abnormal Vibration",
    description:
      "Vibration amplitude climbs, consistent with an imbalance, loose mount or bearing wear.",
    effects: { vibration: 5.5, rpm: -1.4, egt: 0.6 },
  },
  injector_abnormality: {
    key: "injector_abnormality",
    label: "Injector Abnormality",
    description:
      "Fuel flow and EGT swing irregularly, consistent with a fouled or leaking injector.",
    effects: { fuelFlow: 4.6, egt: 2.8, rpm: -0.8 },
  },
  lubrication_issue: {
    key: "lubrication_issue",
    label: "Lubrication Issue",
    description:
      "Oil pressure drops while oil temperature climbs, consistent with a lubrication-system fault.",
    effects: { oilPressure: -4.8, oilTemp: 2.6, vibration: 0.8 },
  },
};

// Fixed "trained Random-Forest" global feature importances, ranked. The
// "value" shown alongside each in the UI is that parameter's *current*
// deviation from the twin, in sigma units (computed live).
export const FEATURE_IMPORTANCE = [
  { key: "egt", label: "EGT deviation from twin (\u03c3)", importance: 18.6 },
  { key: "cht", label: "CHT deviation from twin (\u03c3)", importance: 13.6 },
  { key: "oilPressure", label: "Oil-pressure deviation from twin (\u03c3)", importance: 13.2 },
  { key: "vibration", label: "Vibration deviation from twin (\u03c3)", importance: 11.7 },
  { key: "oilTemp", label: "Oil-temperature deviation from twin (\u03c3)", importance: 10.1 },
];

export const ADVISORY_TEMPLATES = {
  overheating: {
    title: "Thermal-management trend abnormal",
    body: (d) =>
      `Temperature trend is abnormal. Inspect the simulated thermal-management condition ` +
      `(cooling airflow, cylinder baffles, oil cooling). Observed: CHT deviation ${fmtSigma(d.cht)}; ` +
      `Oil Temperature deviation ${fmtSigma(d.oilTemp)}.`,
  },
  abnormal_vibration: {
    title: "Vibration signature abnormal",
    body: (d) =>
      `Vibration trend is abnormal. Inspect the simulated rotating assembly ` +
      `(balance, mounts, bearings). Observed: Vibration deviation ${fmtSigma(d.vibration)}; ` +
      `RPM deviation ${fmtSigma(d.rpm)}.`,
  },
  injector_abnormality: {
    title: "Fuel-delivery trend abnormal",
    body: (d) =>
      `Fuel-delivery trend is abnormal. Inspect the simulated injection path ` +
      `(injector, fuel pump, filter). Observed: Fuel Flow deviation ${fmtSigma(d.fuelFlow)}; ` +
      `EGT deviation ${fmtSigma(d.egt)}.`,
  },
  lubrication_issue: {
    title: "Lubrication trend abnormal",
    body: (d) =>
      `Oil pressure / temperature trend is abnormal. Inspect the simulated lubrication system ` +
      `(oil pump, oil level, cooler). Observed: Oil Pressure deviation ${fmtSigma(d.oilPressure)}; ` +
      `Oil Temperature deviation ${fmtSigma(d.oilTemp)}.`,
  },
};

function fmtSigma(v) {
  const n = Number(v ?? 0);
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}\u03c3`;
}

export const MISSION_PROFILES = {
  high_altitude: {
    key: "high_altitude",
    label: "High Altitude",
    description: "Climb to 12,000 ft simulated with cold ambient temperatures; high-power climb, then cruise.",
    altitude: 12000,
    ambient: -5,
    throttle: 85,
    duration: 20,
  },
  takeoff_climb: {
    key: "takeoff_climb",
    label: "Takeoff & Climb",
    description: "Full-power takeoff roll and initial climb-out at low altitude.",
    altitude: 2000,
    ambient: 20,
    throttle: 100,
    duration: 10,
  },
  cruise: {
    key: "cruise",
    label: "Cruise",
    description: "Steady-state cruise at moderate altitude and power.",
    altitude: 8000,
    ambient: 10,
    throttle: 65,
    duration: 30,
  },
  hot_weather: {
    key: "hot_weather",
    label: "Hot Weather",
    description: "Ground operations and climb in high ambient temperature.",
    altitude: 3000,
    ambient: 38,
    throttle: 75,
    duration: 15,
  },
  cold_start: {
    key: "cold_start",
    label: "Cold Start",
    description: "Engine start and warm-up in cold ambient conditions.",
    altitude: 1500,
    ambient: -10,
    throttle: 30,
    duration: 8,
  },
};

export const SIM_SPEED = 30; // simulated seconds advanced per real second
export const TICK_MS = 1000; // real ms per tick
export const HISTORY_LEN = 120; // rolling telemetry points kept per parameter
export const FAULT_RAMP_TICKS = 10; // ~10 real seconds to reach full severity
