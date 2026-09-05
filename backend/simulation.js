// simulation.js
// The "digital twin". Advances synthetic telemetry each tick, runs the
// (simulated) anomaly detector + fault classifier, tracks degradation/RUL,
// raises alerts, and produces a maintenance advisory. Pure JS, no ML
// libraries - the "isolation_forest_v1" / "Random-Forest" behaviour is
// approximated with statistics so the whole thing runs anywhere with no
// native ML deps.

import {
  PARAMS,
  FAULTS,
  FEATURE_IMPORTANCE,
  ADVISORY_TEMPLATES,
  MISSION_PROFILES,
  SIM_SPEED,
  HISTORY_LEN,
  FAULT_RAMP_TICKS,
} from "./definitions.js";

function gaussianNoise() {
  // Box-Muller
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function fmtClock(sec) {
  const m = Math.floor(sec / 60) % 60;
  const s = Math.floor(sec % 60);
  const h = Math.floor(sec / 3600);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export class DigitalTwin {
  constructor(onMissionRow) {
    this.onMissionRow = onMissionRow || (() => {});
    this.reset();
  }

  reset() {
    this.tick = 0;
    this.simClockSec = 0;
    this.simRunning = true;
    this.mode = "live"; // 'live' | 'replay'

    this.manualTarget = { throttle: 40, altitude: 1500, ambient: 15 };

    this.activeFault = null; // { type, severity, ramp }
    this.health = 96.0;
    this.prevHealth = 96.0;
    this.degradation = 8.0; // 0-100, inspection threshold at 85
    this.degradationRatePerHour = 0.35; // baseline creep

    this.alertIdSeq = 1;
    this.alerts = [];
    this._alertCooldowns = {};

    this.mission = null; // { id, profileKey, targets, durationTicks, ticksDone }

    this.history = {};
    for (const key of Object.keys(PARAMS)) {
      this.history[key] = [];
    }
    this.healthHistory = [];
    this.degradationHistory = [];

    this.lastValues = {};
    this.lastDeviations = {};
    this.lastExpected = {};
    for (const key of Object.keys(PARAMS)) {
      this.lastValues[key] = PARAMS[key].baseline;
      this.lastDeviations[key] = 0;
      this.lastExpected[key] = PARAMS[key].baseline;
    }

    this.predicted = { label: "Nominal", key: null, confidence: 4, probs: {} };
    this.anomaly = { score: 6, flagged: false };
    this.advisory = null;

    // Replay state
    this.replay = null; // { missionId, rows, index, label }
  }

  setManualTarget({ throttle, altitude, ambient }) {
    if (throttle !== undefined && throttle !== null && throttle !== "")
      this.manualTarget.throttle = clamp(Number(throttle), 0, 100);
    if (altitude !== undefined && altitude !== null && altitude !== "")
      this.manualTarget.altitude = clamp(Number(altitude), 0, 40000);
    if (ambient !== undefined && ambient !== null && ambient !== "")
      this.manualTarget.ambient = clamp(Number(ambient), -40, 55);
  }

  // Expected ("twin") baseline for a parameter given current throttle/altitude/ambient
  expectedFor(key, targets) {
    const { throttle, altitude, ambient } = targets;
    const t = throttle / 100;
    switch (key) {
      case "rpm":
        return 950 + t * 950;
      case "egt":
        return 320 + t * 260 + ambient * 0.6;
      case "cht":
        return 55 + t * 55 + ambient * 0.7;
      case "oilTemp":
        return 40 + t * 35 + ambient * 0.55;
      case "oilPressure":
        return clamp(62 - (altitude / 1000) * 0.35 - t * 4, 20, 70);
      case "fuelFlow":
        return 2.2 + t * 8.4;
      case "vibration":
        return 0.32 + t * 0.28;
      case "batteryVoltage":
        return 27.8 - t * 0.15;
      default:
        return PARAMS[key].baseline;
    }
  }

  injectFault(type) {
    if (!FAULTS[type]) return false;
    this.activeFault = { type, severity: 0, target: 1 };
    this.pushAlert("MEDIUM", `Fault injected: ${FAULTS[type].label} (ramping).`, "fault_sim", "sim");
    return true;
  }

  clearFault() {
    if (this.activeFault) this.activeFault.target = 0;
    return true;
  }

  startSim() {
    this.simRunning = true;
  }
  stopSim() {
    this.simRunning = false;
  }

  pushAlert(severity, message, tag, source) {
    const key = tag;
    const now = this.tick;
    const cooldown = 20; // ticks
    if (this._alertCooldowns[key] !== undefined && now - this._alertCooldowns[key] < cooldown) {
      return;
    }
    this._alertCooldowns[key] = now;
    this.alerts.unshift({
      id: this.alertIdSeq++,
      severity,
      message,
      tag,
      source,
      simClock: fmtClock(this.simClockSec),
      tick: this.tick,
    });
    if (this.alerts.length > 50) this.alerts.length = 50;
  }

  // ---- Mission control -------------------------------------------------

  startMission(profileKey, overrides, dbInsertMission) {
    const profile = MISSION_PROFILES[profileKey];
    if (!profile) return null;
    const duration = Number(overrides?.duration) || profile.duration;
    const altitude = overrides?.altitude !== undefined && overrides?.altitude !== "" ? Number(overrides.altitude) : profile.altitude;
    const ambient = overrides?.ambient !== undefined && overrides?.ambient !== "" ? Number(overrides.ambient) : profile.ambient;
    const throttle = overrides?.throttle !== undefined && overrides?.throttle !== "" ? Number(overrides.throttle) : profile.throttle;

    const durationTicks = Math.max(2, Math.round((duration * 60) / SIM_SPEED));
    const missionId = dbInsertMission({
      profileKey,
      label: profile.label,
      duration,
      altitude,
      ambient,
      throttle,
      status: "running",
    });

    this.mission = {
      id: missionId,
      profileKey,
      targets: { throttle, altitude, ambient },
      durationTicks,
      ticksDone: 0,
    };
    this.manualTarget = { throttle, altitude, ambient };
    this.pushAlert("MEDIUM", `Mission started: ${profile.label} (${duration} sim min).`, "mission", "sim");
    return this.mission;
  }

  // ---- Main tick ---------------------------------------------------------

  step() {
    if (!this.simRunning || this.mode === "replay") return null;

    this.tick += 1;
    this.simClockSec += SIM_SPEED;

    // Fault severity ramp
    if (this.activeFault) {
      const rate = 1 / FAULT_RAMP_TICKS;
      const dir = this.activeFault.target > this.activeFault.severity ? 1 : -1;
      this.activeFault.severity = clamp(this.activeFault.severity + dir * rate, 0, 1);
      if (this.activeFault.severity <= 0 && this.activeFault.target === 0) {
        this.activeFault = null;
      }
    }

    const targets = this.manualTarget;
    const deviations = {};
    const values = {};
    const expected = {};

    for (const key of Object.keys(PARAMS)) {
      const p = PARAMS[key];
      const exp = this.expectedFor(key, targets);
      let v = exp + gaussianNoise() * p.sigma * 0.35;

      if (this.activeFault) {
        const fault = FAULTS[this.activeFault.type];
        const effectSigma = fault.effects[key] || 0;
        v += effectSigma * p.sigma * this.activeFault.severity;
      }

      values[key] = v;
      expected[key] = exp;
      deviations[key] = (v - exp) / p.sigma;

      const hist = this.history[key];
      hist.push({ t: fmtClock(this.simClockSec), v: Number(v.toFixed(p.decimals + 2)) });
      if (hist.length > HISTORY_LEN) hist.shift();
    }

    this.lastValues = values;
    this.lastDeviations = deviations;
    this.lastExpected = expected;

    // ---- Anomaly score (Isolation-Forest-ish aggregate) ----
    const absDevs = Object.values(deviations).map((d) => Math.abs(d));
    const meanAbsDev = absDevs.reduce((a, b) => a + b, 0) / absDevs.length;
    const maxAbsDev = Math.max(...absDevs);
    const rawScore = 0.6 * meanAbsDev + 0.4 * maxAbsDev;
    let anomalyScore = clamp(Math.round(100 * (1 - Math.exp(-0.55 * rawScore))), 0, 100);
    anomalyScore = clamp(anomalyScore + Math.round(gaussianNoise() * 1.5), 0, 100);
    const anomalyFlagged = anomalyScore >= 65;

    // ---- Fault classifier (Random-Forest-ish) ----
    const probs = {};
    for (const [fkey, fault] of Object.entries(FAULTS)) {
      let score = 0;
      let norm = 0;
      for (const [pkey, effSigma] of Object.entries(fault.effects)) {
        const w = Math.abs(effSigma);
        norm += w;
        const dev = deviations[pkey] || 0;
        // Only count deviation in the direction the fault would push it
        const aligned = effSigma === 0 ? 0 : Math.max(0, dev / effSigma);
        score += w * Math.min(aligned, 1.4);
      }
      const normalized = norm > 0 ? score / norm : 0; // ~0..1.4
      const prob = clamp(Math.round(100 / (1 + Math.exp(-6 * (normalized - 0.45)))), 0, 100);
      probs[fkey] = prob;
    }
    let bestKey = null;
    let bestProb = -1;
    for (const [k, p] of Object.entries(probs)) {
      if (p > bestProb) {
        bestProb = p;
        bestKey = k;
      }
    }
    const predicted =
      bestProb >= 50
        ? { key: bestKey, label: FAULTS[bestKey].label, confidence: bestProb, probs }
        : { key: null, label: "Nominal", confidence: clamp(100 - bestProb, 60, 99), probs };

    // ---- Health index ----
    const healthDrop = anomalyScore * 0.85 + (this.activeFault ? this.activeFault.severity * 12 : 0);
    let health = clamp(100 - healthDrop + gaussianNoise() * 0.4, 0.5, 100);
    // smooth slightly against previous to avoid violent jumps
    health = this.health * 0.55 + health * 0.45;
    this.prevHealth = this.health;
    this.health = health;
    this.healthHistory.push({ t: fmtClock(this.simClockSec), v: Number(health.toFixed(1)) });
    if (this.healthHistory.length > HISTORY_LEN) this.healthHistory.shift();
    const trendPerMin = ((this.health - this.prevHealth) / SIM_SPEED) * 60;

    // ---- Degradation / RUL ----
    // TODO: this creeps up slowly even with zero faults, which is realistic
    // (engines do wear over time) but means "RUL" trends toward the
    // baseline creep rate if you leave the sim running for a long session.
    // Fine for demo purposes, just don't read too much into a multi-hour run.
    const degradationDrive = this.activeFault ? this.activeFault.severity * 0.9 : 0;
    this.degradation = clamp(
      this.degradation + (this.degradationRatePerHour / 3600) * SIM_SPEED + degradationDrive * 0.02,
      0,
      100
    );
    this.degradationHistory.push({ t: fmtClock(this.simClockSec), v: Number(this.degradation.toFixed(1)) });
    if (this.degradationHistory.length > HISTORY_LEN) this.degradationHistory.shift();

    const recentDeg = this.degradationHistory.slice(-20);
    let degRatePerSimHour = 0.05;
    if (recentDeg.length >= 2) {
      const span = recentDeg.length - 1;
      degRatePerSimHour = Math.max(0.01, ((recentDeg[span].v - recentDeg[0].v) / (span * SIM_SPEED)) * 3600);
    }
    const rulSimHours = clamp((85 - this.degradation) / degRatePerSimHour, 0, 999);

    // ---- Status / contributors ----
    let status = "NOMINAL";
    if (this.health < 25) status = "CRITICAL";
    else if (this.health < 50) status = "WARNING";
    else if (this.health < 80) status = "CAUTION";

    const contributors = Object.entries(deviations)
      .map(([key, dev]) => ({ key, label: PARAMS[key].label, dev, pts: -Math.abs(dev) * 3.2 }))
      .sort((a, b) => a.pts - b.pts)
      .slice(0, 3)
      .map((c) => ({ label: c.label, pts: Number(c.pts.toFixed(1)) }));

    // ---- Alerts ----
    if (status === "CRITICAL") {
      this.pushAlert("CRITICAL", `Engine health index CRITICAL: ${this.health.toFixed(0)}/100.`, "health", "ai");
    } else if (status === "WARNING") {
      this.pushAlert("HIGH", `Engine health index WARNING: ${this.health.toFixed(0)}/100.`, "health", "ai");
    }
    if (anomalyFlagged) {
      this.pushAlert(
        "MEDIUM",
        `AI anomaly score ${anomalyScore}/100 \u2014 off-nominal pattern detected by Isolation Forest.`,
        "ai_anomaly",
        "ai"
      );
    }
    if (predicted.key) {
      this.pushAlert(
        "MEDIUM",
        `Fault classifier predicts '${predicted.label}' (confidence ${predicted.confidence}%).`,
        "ai_fault",
        "ai"
      );
    }
    for (const [key, dev] of Object.entries(deviations)) {
      if (Math.abs(dev) >= 5) {
        const p = PARAMS[key];
        this.pushAlert(
          "HIGH",
          `${p.label} ${values[key].toFixed(p.decimals)}${p.unit} (${dev >= 0 ? "+" : ""}${dev.toFixed(1)}\u03c3 vs twin expected ${expected[key].toFixed(p.decimals)}${p.unit}) \u2014 above simulated limit.`,
          key,
          "rule"
        );
      }
    }

    // ---- Advisory ----
    let advisory = null;
    if (predicted.key && predicted.confidence >= 55) {
      const tpl = ADVISORY_TEMPLATES[predicted.key];
      advisory = {
        severity: predicted.confidence >= 80 ? "HIGH" : "MEDIUM",
        label: "PROTOTYPE / DEMO ADVISORY",
        title: tpl.title,
        body: tpl.body(deviations) + " Prototype/demo recommendation for a synthetic engine \u2014 not real maintenance instructions.",
      };
    }

    this.predicted = predicted;
    this.anomaly = { score: anomalyScore, flagged: anomalyFlagged };
    this.advisory = advisory;
    this.degRulSimHours = rulSimHours;
    this.status = status;
    this.contributors = contributors;

    // ---- Mission recording ----
    if (this.mission) {
      this.mission.ticksDone += 1;
      this.onMissionRow(this.mission.id, {
        tick: this.tick,
        simClockSec: this.simClockSec,
        values,
        health: this.health,
        anomalyScore,
        predicted: predicted.label,
      });
      if (this.mission.ticksDone >= this.mission.durationTicks) {
        const finishedId = this.mission.id;
        this.mission = null;
        return { missionFinished: finishedId };
      }
    }

    return null;
  }

  snapshot() {
    const params = {};
    for (const key of Object.keys(PARAMS)) {
      const p = PARAMS[key];
      params[key] = {
        label: p.label,
        unit: p.unit,
        value: Number((this.lastValues[key] ?? p.baseline).toFixed(p.decimals)),
        exp: Number((this.lastExpected[key] ?? p.baseline).toFixed(p.decimals)),
        deviation: Number((this.lastDeviations[key] ?? 0).toFixed(2)),
        decimals: p.decimals,
        history: this.history[key],
      };
    }

    const featureImportance = FEATURE_IMPORTANCE.map((f) => ({
      ...f,
      value: Number((this.lastDeviations[f.key] ?? 0).toFixed(2)),
    }));

    return {
      mode: this.mode,
      simRunning: this.simRunning,
      tick: this.tick,
      simClockSec: this.simClockSec,
      simClock: fmtClock(this.simClockSec),
      speed: 30,
      params,
      health: {
        value: Number(this.health.toFixed(1)),
        prev: Number(this.prevHealth.toFixed(1)),
        trendPerMin: Number((((this.health - this.prevHealth) / 30) * 60).toFixed(2)),
        status: this.status || "NOMINAL",
        contributors: this.contributors || [],
      },
      anomaly: { ...this.anomaly, threshold: 65, model: "isolation_forest_v1" },
      predicted: this.predicted,
      featureImportance,
      degradation: {
        value: Number(this.degradation.toFixed(1)),
        threshold: 85,
        rulSimHours: Number((this.degRulSimHours ?? 0).toFixed(1)),
        method: "degradation-trend extrapolation",
        healthHistory: this.healthHistory,
        degradationHistory: this.degradationHistory,
      },
      alerts: this.alerts.slice(0, 30),
      advisory: this.advisory,
      activeFault: this.activeFault
        ? {
            type: this.activeFault.type,
            label: FAULTS[this.activeFault.type].label,
            severity: Math.round(this.activeFault.severity * 100),
            clearing: this.activeFault.target === 0,
          }
        : null,
      manualTarget: this.manualTarget,
      mission: this.mission
        ? {
            id: this.mission.id,
            profileKey: this.mission.profileKey,
            progressPct: Math.round((this.mission.ticksDone / this.mission.durationTicks) * 100),
          }
        : null,
    };
  }
}
