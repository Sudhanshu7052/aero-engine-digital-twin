# AI-Enabled Aero Engine Digital Twin

A synthetic-data prototype dashboard for engine health monitoring, fault
prediction, and mission reliability. It's a full-stack app: a Node/Express +
WebSocket backend that plays the role of the "digital twin" (it generates
telemetry, runs the anomaly/fault logic, tracks degradation), and a React +
Recharts dashboard on top of it.

Nothing here is a real trained ML model — the "Isolation Forest" and
"Random Forest" behaviour is hand-rolled with statistics in
`backend/simulation.js` so the whole thing runs anywhere with zero ML
dependencies. If you ever want to swap that out for something real, that
file is small and self-contained enough to do it in an afternoon.

> Educational prototype. All telemetry is synthetic. No connection to any
> real aircraft, engine, ECU, FADEC, or hardware. RUL figures are a
> "Prototype RUL Estimate" for demo purposes, not certified engine-life
> predictions.

## Features

- **Live simulated telemetry** for RPM, CHT, EGT, oil pressure, oil
  temperature, fuel flow, vibration, and battery voltage, each with a
  sparkline and its deviation from the digital twin's expected value (in
  σ units).
- **Telemetry graphs** — full time-series charts for every parameter plus a
  derived Health Index.
- **AI diagnostics** — a simulated Isolation-Forest-style anomaly detector
  (0–100 anomaly score) and a simulated Random-Forest-style fault
  classifier that predicts Overheating / Abnormal Vibration / Injector
  Abnormality / Lubrication Issue, with per-feature contribution
  ("feature importance") breakdowns.
- **Engine health, status, and degradation/RUL** — a rolling health index,
  a degradation trend extrapolated to an inspection threshold, and a
  Prototype RUL Estimate in simulated hours.
- **Alerts feed** — severity-ranked (CRITICAL / HIGH / MEDIUM) alerts from
  both a rule engine and the AI models.
- **Maintenance advisory** — an explainable, template-based recommendation
  tied to whichever fault the classifier currently predicts.
- **Mission Simulator** — run scripted mission profiles (High Altitude,
  Takeoff & Climb, Cruise, Hot Weather, Cold Start) that drive the twin for
  a set duration, at a 30× simulated clock.
- **Manual Operating Point** — a throttle slider plus altitude/ambient
  inputs that re-target the twin's expected baseline for free-running
  simulation.
- **Fault Simulator** — inject or clear one of four synthetic faults and
  watch deviations → anomaly score → predicted condition → health →
  degradation → RUL → alerts → advisory update end-to-end, in real time.
- **Mission Replay** — every mission you run is recorded tick-by-tick to a
  local SQLite database; replay any past mission to re-stream its
  historical telemetry.
- **3D digital-twin visualization** — a fixed-wing UAV airframe built from
  primitives (no model file to load): tapered wings, a V-tail, tricycle
  landing gear, and a rear pusher-prop piston engine that's the actual
  thing being health-monitored. The prop spins with RPM and the engine
  glows by status, but only while **linked** — there's a Connect/Disconnect
  toggle that puts the whole airframe into a neutral offline idle state,
  and an **Exploded View** toggle that separates the wings/tail/engine/
  prop/gear from the fuselage to show it's an assembly. Purely for feel —
  don't read anything physically meaningful into it.

## Project structure

```
uav-health-monitor/
├── backend/                # Node/Express + WebSocket simulation API
│   ├── definitions.js      # telemetry params, fault signatures, mission profiles
│   ├── simulation.js       # the digital-twin state machine
│   ├── db.js                # SQLite (better-sqlite3) mission + telemetry storage
│   ├── server.js            # REST + WebSocket server
│   └── package.json
├── frontend/                # React + Vite + Recharts dashboard
│   ├── src/
│   │   ├── api.js           # WebSocket hook + REST client
│   │   ├── App.jsx
│   │   ├── styles.css
│   │   └── components/
│   │       └── UAVTwin3D.jsx     # the Three.js fixed-wing UAV visual
│   ├── vite.config.js       # dev-server proxy to the backend
│   └── package.json
├── LICENSE
├── CHANGELOG.md
└── README.md
```

## Requirements

- Node.js 18+ (Node 20/22 recommended)
- npm 9+

## Run it locally

Open two terminals (or use the VS Code integrated terminal split view).

**Terminal 1 — backend**

```bash
cd backend
npm install
npm run dev        # or: npm start
```

The API + WebSocket server starts on `http://localhost:8787`
(WebSocket at `ws://localhost:8787/ws`). It also creates a local SQLite
database at `backend/data/missions.sqlite` on first run (auto-created,
git-ignored).

**Terminal 2 — frontend**

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints — by default **http://localhost:5173**. The Vite
dev server proxies `/api` and `/ws` to the backend, so no extra
configuration is needed.

### Production build

```bash
cd frontend
npm run build       # outputs static files to frontend/dist
npm run preview     # serve the production build locally
```

For a real deployment, serve `frontend/dist` as static files from any
static host/CDN, and run `backend/server.js` as a long-lived Node process
(behind a reverse proxy that also forwards WebSocket upgrades on `/ws`).
Update `frontend/vite.config.js`'s proxy target (dev) or add an
environment-based API base URL if you split hosting between two domains.

## How the simulation works (at a glance)

- Every real second, the server advances the "sim clock" by 30 simulated
  seconds (`SIM_SPEED` in `backend/definitions.js`) and recomputes all
  telemetry with Gaussian noise around an expected baseline derived from
  the current throttle/altitude/ambient targets.
- Injecting a fault gradually ramps a severity value from 0→1 over ~10
  real seconds and biases the relevant parameters in the direction that
  fault would actually push them (e.g. Overheating pushes CHT/EGT/oil
  temperature up and oil pressure slightly down).
- The anomaly score aggregates each parameter's deviation (in σ) from its
  expected value; the fault classifier scores each fault type by how well
  the current deviations match that fault's known "signature", then
  reports the highest-scoring one as the predicted condition.
- Health, degradation, and the Prototype RUL Estimate are all derived from
  the anomaly score and active fault severity over time — there's no real
  ML model file to swap in, but the `backend/simulation.js` module is
  small and self-contained if you want to replace the heuristics with a
  real trained model later.

## A few honest notes

- The anomaly score, fault probabilities, health index, and degradation
  curve are all tuned by feel (a lot of `sleep 8 && curl /api/state` while
  building this) rather than fit to any real dataset. They behave sensibly
  — inject a fault and the numbers move the way you'd expect — but don't
  take the exact figures as meaningful.
- `better-sqlite3` is a native module. It ships prebuilt binaries for most
  common platforms so `npm install` usually "just works", but if it fails
  to install on your machine, the two most likely fixes are updating to a
  current Node LTS version or installing your platform's build tools
  (Xcode Command Line Tools on macOS, `build-essential` on Debian/Ubuntu,
  the "Desktop development with C++" workload on Windows).
- The 3D visualization is intentionally simple geometry, not an imported
  model — that was a deliberate choice to keep the repo dependency-light
  and avoid shipping binary asset files, not a limitation of Three.js. It
  was also built without a way to render a live WebGL preview, so if a
  panel or the prop position looks slightly off in your browser, that's
  expected — it's a quick fix in `UAVTwin3D.jsx`, just tell me what you're
  seeing.
- If you resize the browser window while a mission replay is running, the
  chart briefly redraws — cosmetic only, doesn't affect the underlying
  data.

## Customizing

- Add/edit telemetry parameters, fault signatures, or mission profiles in
  `backend/definitions.js`.
- Tune the simulation math (noise, health/degradation formulas, alert
  thresholds) in `backend/simulation.js`.
- All dashboard panels are separate components under
  `frontend/src/components/` — safe to restyle or reorder independently.

## Pushing to GitHub

```bash
cd uav-health-monitor
git init
git add .
git commit -m "Initial commit: AI-Enabled Aero Engine Digital Twin"
git branch -M main
git remote add origin <your-empty-github-repo-url>
git push -u origin main
```

`node_modules/`, build output, and the local SQLite database are already
git-ignored.
