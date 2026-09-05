# Changelog

## v1.3
- Swapped the quadcopter for what the project's actually about: a
  **fixed-wing UAV airframe** (Lathe-revolved fuselage, tapered wings, a
  V-tail, tricycle landing gear) with a rear-mounted **pusher-prop piston
  engine** — the prop spins with RPM and the engine nacelle itself glows
  with the health status, since that's the actual thing being monitored.
- Added an **Exploded View** toggle — wings, tail, engine, prop and
  landing gear separate from the fuselage and reassemble on click.
- Added a **Connect / Disconnect** toggle that literally gates whether the
  airframe follows live telemetry (prop spin, glow, jitter) or sits in a
  neutral "offline" idle state — a visible stand-in for linking/unlinking
  the UAV from the monitoring backend. A pulsing ring under the model
  tracks the same link state.
- Upgraded materials to a clearcoat "aircraft paint" look with a
  procedural environment (Three.js `RoomEnvironment`) for reflections,
  instead of flat-shaded primitives.
- Note: I built this without a way to render a live WebGL preview, so the
  proportions are worked out from rotation math rather than eyeballed —
  if something looks off once you run it, it's an easy tweak, just let me
  know what you're seeing.

## v1.2
- Replaced the turbofan visual with an actual 3D **drone** (quadcopter) —
  fits the project name better. Rotors spin with RPM, the airframe leans
  and bobs with throttle, and the belly beacon + arm LEDs track health
  status.
- Switched the whole UI from a dark navy theme to a light/white theme. The
  3D viewport stays dark on purpose (like a live camera feed docked into a
  light ground-control-station UI) — everything else is now white/light
  gray with the same semantic accent colors, re-tuned for contrast.

## v1.1
- Added the 3D digital-twin visualization (`EngineTwin3D.jsx`) — a
  Three.js turbofan that spins with live RPM, glows by engine status, and
  shakes a little under high vibration.
- Minor README cleanup and a couple of honest notes about where the rough
  edges are.

## v1.0
- Initial build: simulation backend (telemetry, anomaly detection, fault
  classification, degradation/RUL, alerts, advisories), mission simulator,
  manual operating point, fault injector, mission replay via SQLite, and
  the full React dashboard.
