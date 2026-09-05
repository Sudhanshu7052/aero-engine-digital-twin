// Tiny Web Audio helper for the fault/alert sound cues. Synthesized with
// oscillators so there's no audio file to ship or fetch — it just works the
// moment the browser allows sound (i.e. after the first user click).

let ctx = null;
function getCtx() {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, startAt, duration, { gain = 0.09, type = "sine" } = {}) {
  const audio = getCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);
  amp.gain.setValueAtTime(0, startAt);
  amp.gain.linearRampToValueAtTime(gain, startAt + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(amp);
  amp.connect(audio.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

// Soft double-click acknowledgement — used right when the operator injects
// a fault, so there's instant feedback that the action registered.
export function playInjectClick() {
  const audio = getCtx();
  if (!audio) return;
  const t = audio.currentTime;
  tone(760, t, 0.07, { gain: 0.06, type: "triangle" });
  tone(980, t + 0.06, 0.09, { gain: 0.07, type: "triangle" });
}

// Two-tone caution chime — for WARNING / CAUTION severity alerts.
export function playCautionAlert() {
  const audio = getCtx();
  if (!audio) return;
  const t = audio.currentTime;
  tone(660, t, 0.16, { gain: 0.08, type: "sine" });
  tone(880, t + 0.17, 0.18, { gain: 0.08, type: "sine" });
}

// Urgent three-pulse alarm — for CRITICAL severity alerts.
export function playCriticalAlert() {
  const audio = getCtx();
  if (!audio) return;
  const t = audio.currentTime;
  for (let i = 0; i < 3; i++) {
    tone(880, t + i * 0.22, 0.14, { gain: 0.1, type: "square" });
  }
}

export function playAlertForSeverity(severity) {
  const sev = String(severity || "").toLowerCase();
  if (sev === "critical" || sev === "high") playCriticalAlert();
  else if (sev === "warning" || sev === "caution" || sev === "medium") playCautionAlert();
}
