import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

// Tiny color-lerp helper — three.js Color has .lerp but no hex-in/hex-out
// convenience.
function lerpHexColor(fromHex, toHex, t) {
  const from = new THREE.Color(fromHex);
  const to = new THREE.Color(toHex);
  return from.lerp(to, t);
}

const STATUS_COLOR = {
  NOMINAL: "#39e07a",
  CAUTION: "#f2a93b",
  WARNING: "#f2a93b",
  CRITICAL: "#ff4d4d",
};
const OFFLINE_COLOR = "#5b6b58";

/**
 * A fixed-wing MALE-class tactical UAV airframe, built entirely from
 * primitives (no model file to fetch — a fresh clone renders this
 * immediately). Matte gunmetal / olive-drab composite finish rather than
 * glossy toy paint, a rear-facing pusher piston engine (the thing actually
 * being health-monitored), a belly-mounted EO/IR sensor turret and a
 * dorsal SATCOM antenna fairing — the recognisable silhouette of a
 * defense ISR platform rather than a generic RC plane.
 *
 * Two things make this more than a static render:
 *  - "Connect" / "Disconnect" gates whether prop speed, engine glow and
 *    airframe jitter follow live backend telemetry, vs. sitting in a
 *    neutral idle state — a visible version of "this UAV is linked to our
 *    monitoring solution".
 *  - "Exploded view" pulls each major assembly (wings, V-tail, engine,
 *    prop, landing gear, sensor turret, SATCOM antenna) away from the
 *    fuselage and labels every one of them with a HUD-style tag, so the
 *    breakdown of the airframe into its monitored subsystems is legible
 *    at a glance, not just a jumble of parts.
 *
 * I don't have a way to render a WebGL preview in the environment I built
 * this in, so the proportions are worked out on paper (rotation math is
 * commented inline) rather than eyeballed — expect it to need a small
 * tweak or two once you actually see it move.
 */
export default function UAVTwin3D({ rpm = 1200, vibration = 0.4, throttle = 40, status = "NOMINAL" }) {
  const mountRef = useRef(null);
  const liveRef = useRef({ rpm, vibration, throttle, status });
  const [linked, setLinked] = useState(true);
  const [exploded, setExploded] = useState(false);
  const linkedRef = useRef(linked);
  const explodedRef = useRef(exploded);

  useEffect(() => {
    liveRef.current = { rpm, vibration, throttle, status };
  }, [rpm, vibration, throttle, status]);
  useEffect(() => {
    linkedRef.current = linked;
  }, [linked]);
  useEffect(() => {
    explodedRef.current = exploded;
  }, [exploded]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(3.4, 1.5, 3.6);
    camera.lookAt(0, 0.05, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    mount.appendChild(renderer.domElement);

    // CSS2D overlay for HUD-style part-name tags — sits on top of the
    // WebGL canvas, sized/positioned identically, but never intercepts
    // pointer events so the canvas underneath stays interactive.
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0";
    labelRenderer.domElement.style.left = "0";
    labelRenderer.domElement.style.pointerEvents = "none";
    mount.style.position = mount.style.position || "relative";
    mount.appendChild(labelRenderer.domElement);
    const labelEls = [];
    function makeLabel(text, parentGroup, localPos) {
      const div = document.createElement("div");
      div.className = "uav-part-label";
      div.textContent = text;
      div.style.opacity = "0";
      const obj = new CSS2DObject(div);
      obj.position.set(localPos.x, localPos.y, localPos.z);
      parentGroup.add(obj);
      labelEls.push(div);
      return obj;
    }

    // Procedural environment (no HDR file to fetch) so the airframe has
    // something believable to reflect without looking plastic-glossy.
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.045).texture;

    scene.add(new THREE.AmbientLight(0xc9d6c4, 0.38));
    const key = new THREE.DirectionalLight(0xfff2d8, 1.05);
    key.position.set(4, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x6fa3ff, 0.22);
    fill.position.set(-4, 2, -3);
    scene.add(fill);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2.6, 48),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.62;
    scene.add(ground);

    // "data link" ring on the ground — pulses when connected to the twin.
    const linkRing = new THREE.Mesh(
      new THREE.RingGeometry(1.15, 1.22, 64),
      new THREE.MeshBasicMaterial({ color: 0x39e07a, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
    );
    linkRing.rotation.x = -Math.PI / 2;
    linkRing.position.y = -0.6;
    scene.add(linkRing);

    // ------------------------------------------------------------------
    // Materials — matte composite airframe, not glossy toy paint.
    // ------------------------------------------------------------------
    const paintMat = new THREE.MeshPhysicalMaterial({
      color: 0x4b5240, // olive-drab composite skin
      metalness: 0.22,
      roughness: 0.58,
      clearcoat: 0.12,
      clearcoatRoughness: 0.5,
      envMapIntensity: 0.7,
    });

    const darkPaintMat = new THREE.MeshPhysicalMaterial({
      color: 0x23261f, // low-observable gunmetal — tail, nacelle, antennas
      metalness: 0.3,
      roughness: 0.55,
      clearcoat: 0.08,
      clearcoatRoughness: 0.6,
      envMapIntensity: 0.7,
    });

    const bellyMat = new THREE.MeshPhysicalMaterial({
      color: 0x8f9788, // lighter underside, ISR grey
      metalness: 0.15,
      roughness: 0.62,
      clearcoat: 0.05,
      envMapIntensity: 0.6,
    });

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x7d8892, metalness: 0.8, roughness: 0.4 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x14161a, metalness: 0.1, roughness: 0.85 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x2c3138, metalness: 0.55, roughness: 0.4 });
    const lensMat = new THREE.MeshPhysicalMaterial({
      color: 0x060a10,
      metalness: 0.15,
      roughness: 0.06,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.4,
    });
    const gimbalMat = new THREE.MeshStandardMaterial({ color: 0x3a3f34, metalness: 0.6, roughness: 0.45 });

    const engineMat = new THREE.MeshStandardMaterial({
      color: 0x14171a,
      emissive: 0x39e07a,
      emissiveIntensity: 0.9,
      metalness: 0.45,
      roughness: 0.5,
    });

    // ------------------------------------------------------------------
    // Root + fuselage
    // ------------------------------------------------------------------
    const root = new THREE.Group();
    scene.add(root);

    // Fuselage: a Lathe revolve. Lathe points are (radius, alongAxis); the
    // mesh is then rotated -90 deg around Z, which (see derivation in the
    // project notes) maps "alongAxis" directly onto world X. So: nose at
    // X = -1.4, tail at X = +1.4.
    const fuseProfile = [
      [0.02, -1.4],
      [0.09, -1.25],
      [0.16, -1.05],
      [0.205, -0.75],
      [0.215, -0.3],
      [0.2, 0.1],
      [0.17, 0.5],
      [0.13, 0.9],
      [0.085, 1.2],
      [0.03, 1.38],
      [0.0, 1.4],
    ].map(([r, x]) => new THREE.Vector2(r, x));
    const fuselage = new THREE.Mesh(new THREE.LatheGeometry(fuseProfile, 28), paintMat);
    fuselage.rotation.z = -Math.PI / 2;
    root.add(fuselage);

    // Belly panel — a flattened half-shell along the underside, giving the
    // two-tone ISR look (dark topsides, lighter belly) instead of one flat
    // colour, which is what read as "cartoon plastic" before.
    const bellyGeo = new THREE.CylinderGeometry(0.205, 0.03, 2.15, 20, 1, true, Math.PI * 0.62, Math.PI * 0.76);
    const belly = new THREE.Mesh(bellyGeo, bellyMat);
    belly.rotation.z = Math.PI / 2;
    belly.position.set(-0.05, -0.02, 0);
    root.add(belly);

    // Slim nose pitot boom — small greeble that reads as "real instrumented
    // airframe" rather than a toy.
    const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 8), metalMat);
    pitot.rotation.z = Math.PI / 2;
    pitot.position.set(-1.48, 0.0, 0);
    root.add(pitot);

    // Dorsal blade antennas — two low fins on the spine, static greebles.
    function buildBladeAntenna(x) {
      const geo = new THREE.BoxGeometry(0.09, 0.045, 0.014);
      const mesh = new THREE.Mesh(geo, darkPaintMat);
      mesh.position.set(x, 0.19, 0);
      return mesh;
    }
    root.add(buildBladeAntenna(0.55));
    root.add(buildBladeAntenna(0.2));

    // ------------------------------------------------------------------
    // Detachable parts registry — each entry animates between its
    // assembled position (0 offset) and an exploded offset, and carries
    // an optional HUD label that fades in as it separates.
    // ------------------------------------------------------------------
    const parts = [];
    function registerPart(group, basePos, explodeOffset) {
      group.position.copy(basePos);
      root.add(group);
      parts.push({ group, basePos: basePos.clone(), offset: explodeOffset.clone() });
      return group;
    }

    // -- wings -----------------------------------------------------------
    function buildPanel({ rootR, tipR, span, chordScale, thickScale, mirrored, material }) {
      const radiusTop = mirrored ? rootR : tipR;
      const radiusBottom = mirrored ? tipR : rootR;
      const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, span, 20, 1, false);
      const mesh = new THREE.Mesh(geo, material);
      mesh.scale.set(chordScale, 1, thickScale);
      mesh.rotation.x = Math.PI / 2;
      return mesh;
    }

    const WING_SPAN = 1.7;
    const wingMountX = 0.02;
    const wingMountY = 0.03;
    const fuselageRadiusAtWing = 0.207;

    const wingRightMesh = buildPanel({ rootR: 0.16, tipR: 0.05, span: WING_SPAN, chordScale: 3.0, thickScale: 0.22, mirrored: false, material: paintMat });
    wingRightMesh.position.set(0, 0, fuselageRadiusAtWing + WING_SPAN / 2);
    const wingRightGroup = new THREE.Group();
    wingRightGroup.add(wingRightMesh);
    registerPart(
      wingRightGroup,
      new THREE.Vector3(wingMountX, wingMountY, 0),
      new THREE.Vector3(-0.15, 0.35, 1.1)
    );
    makeLabel("STARBOARD WING", wingRightGroup, new THREE.Vector3(0, 0.16, fuselageRadiusAtWing + WING_SPAN / 2));

    const wingLeftMesh = buildPanel({ rootR: 0.16, tipR: 0.05, span: WING_SPAN, chordScale: 3.0, thickScale: 0.22, mirrored: true, material: paintMat });
    wingLeftMesh.position.set(0, 0, -(fuselageRadiusAtWing + WING_SPAN / 2));
    const wingLeftGroup = new THREE.Group();
    wingLeftGroup.add(wingLeftMesh);
    registerPart(
      wingLeftGroup,
      new THREE.Vector3(wingMountX, wingMountY, 0),
      new THREE.Vector3(-0.15, 0.35, -1.1)
    );
    makeLabel("PORT WING", wingLeftGroup, new THREE.Vector3(0, 0.16, -(fuselageRadiusAtWing + WING_SPAN / 2)));

    // -- V-tail ------------------------------------------------------------
    const FIN_SPAN = 0.72;
    const TILT = THREE.MathUtils.degToRad(38);
    const tailMountX = 1.18;
    const tailMountY = 0.06;

    function buildFin(mirrored) {
      const mesh = buildPanel({ rootR: 0.085, tipR: 0.028, span: FIN_SPAN, chordScale: 2.6, thickScale: 0.24, mirrored, material: darkPaintMat });
      mesh.position.set(0, 0, mirrored ? -FIN_SPAN / 2 : FIN_SPAN / 2);
      const inner = new THREE.Group();
      inner.add(mesh);
      makeLabel(mirrored ? "PORT V-TAIL" : "STBD V-TAIL", inner, new THREE.Vector3(0, 0.1, mirrored ? -FIN_SPAN / 2 : FIN_SPAN / 2));
      const outer = new THREE.Group();
      outer.add(inner);
      outer.rotation.x = mirrored ? TILT : -TILT;
      return outer;
    }

    const finRight = buildFin(false);
    registerPart(finRight, new THREE.Vector3(tailMountX, tailMountY, 0), new THREE.Vector3(-0.25, 0.45, 0.4));
    const finLeft = buildFin(true);
    registerPart(finLeft, new THREE.Vector3(tailMountX, tailMountY, 0), new THREE.Vector3(-0.25, 0.45, -0.4));

    // -- engine nacelle + pusher prop (the actual piston engine) ----------
    const engineGroup = new THREE.Group();
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.09, 0.26, 20), engineMat);
    nacelle.rotation.z = -Math.PI / 2; // lay the cylinder's axis along +X
    nacelle.position.set(0.12, 0, 0);
    engineGroup.add(nacelle);
    // cooling fins around the nacelle — piston engines run hot, this is the
    // detail that says "combustion engine", not electric motor
    for (let i = 0; i < 5; i++) {
      const fin = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.006, 6, 20), metalMat);
      fin.rotation.y = Math.PI / 2;
      fin.position.set(0.02 + i * 0.045, 0, 0);
      engineGroup.add(fin);
    }
    const engineRing = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 24), metalMat);
    engineRing.rotation.y = Math.PI / 2;
    engineRing.position.set(0, 0, 0);
    engineGroup.add(engineRing);
    registerPart(engineGroup, new THREE.Vector3(1.48, 0, 0), new THREE.Vector3(0.55, 0, 0));
    makeLabel("PISTON ENGINE", engineGroup, new THREE.Vector3(0.12, 0.16, 0));

    const propGroup = new THREE.Group();
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), metalMat);
    propGroup.add(hub);
    const bladeGeo = new THREE.BoxGeometry(0.018, 0.56, 0.07);
    bladeGeo.translate(0, 0.28, 0);
    for (let i = 0; i < 2; i++) {
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.rotation.x = (i * Math.PI) + Math.PI / 2;
      propGroup.add(blade);
    }
    registerPart(propGroup, new THREE.Vector3(1.66, 0, 0), new THREE.Vector3(0.6, 0, 0));
    makeLabel("PUSHER PROPELLER", propGroup, new THREE.Vector3(0, 0.38, 0));

    // -- EO/IR sensor turret (belly-mounted camera gimbal) ----------------
    const turretGroup = new THREE.Group();
    const turretMount = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.05, 16), gimbalMat);
    turretMount.position.set(0, 0.04, 0);
    turretGroup.add(turretMount);
    const turretBall = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 20), gimbalMat);
    turretGroup.add(turretBall);
    const turretLens = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), lensMat);
    turretLens.position.set(0, -0.04, 0.05);
    turretGroup.add(turretLens);
    registerPart(turretGroup, new THREE.Vector3(-1.05, -0.19, 0), new THREE.Vector3(0.1, -0.42, 0));
    makeLabel("EO/IR CAMERA TURRET", turretGroup, new THREE.Vector3(0, -0.11, 0));

    // -- SATCOM antenna fairing (dorsal hump) ------------------------------
    const satcomGroup = new THREE.Group();
    const satcomBase = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.05, 20), darkPaintMat);
    satcomGroup.add(satcomBase);
    const satcomDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      darkPaintMat
    );
    satcomDome.position.set(0, 0.02, 0);
    satcomGroup.add(satcomDome);
    registerPart(satcomGroup, new THREE.Vector3(-0.35, 0.21, 0), new THREE.Vector3(-0.1, 0.4, 0));
    makeLabel("SATCOM ANTENNA", satcomGroup, new THREE.Vector3(0, 0.14, 0));

    // -- tricycle landing gear ---------------------------------------------
    function buildLeg(wheelRadius) {
      const group = new THREE.Group();
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.34, 10), metalMat);
      strut.position.y = -0.17;
      group.add(strut);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.06, 20), rubberMat);
      wheel.rotation.x = Math.PI / 2; // stand the wheel up so its axle runs along Z
      wheel.position.y = -0.34;
      group.add(wheel);
      return group;
    }

    const noseGear = buildLeg(0.075);
    registerPart(noseGear, new THREE.Vector3(-0.95, -0.1, 0), new THREE.Vector3(0, -0.5, 0));
    makeLabel("NOSE LANDING GEAR", noseGear, new THREE.Vector3(0, 0.05, 0));
    const mainGearRight = buildLeg(0.09);
    registerPart(mainGearRight, new THREE.Vector3(0.28, -0.13, 0.16), new THREE.Vector3(0, -0.5, 0.25));
    makeLabel("STBD MAIN GEAR", mainGearRight, new THREE.Vector3(0, 0.05, 0));
    const mainGearLeft = buildLeg(0.09);
    registerPart(mainGearLeft, new THREE.Vector3(0.28, -0.13, -0.16), new THREE.Vector3(0, -0.5, -0.25));
    makeLabel("PORT MAIN GEAR", mainGearLeft, new THREE.Vector3(0, 0.05, 0));

    // ------------------------------------------------------------------
    // Animation loop
    // ------------------------------------------------------------------
    let frameId;
    let explodeAmount = 0;
    const clock = new THREE.Clock();
    let elapsed = 0;

    function animate() {
      frameId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      elapsed += dt;

      const isLinked = linkedRef.current;
      const isExploded = explodedRef.current;
      const { rpm: liveRpm, vibration: liveVibration, throttle: liveThrottle, status: liveStatus } = liveRef.current;
      const throttleN = THREE.MathUtils.clamp(liveThrottle / 100, 0, 1);

      // explode / assemble lerp
      const explodeTarget = isExploded ? 1 : 0;
      explodeAmount += (explodeTarget - explodeAmount) * Math.min(1, dt * 3.2);
      parts.forEach(({ group, basePos, offset }) => {
        group.position.set(
          basePos.x + offset.x * explodeAmount,
          basePos.y + offset.y * explodeAmount,
          basePos.z + offset.z * explodeAmount
        );
      });

      // HUD labels fade in once parts have visibly separated
      const labelOpacity = THREE.MathUtils.clamp((explodeAmount - 0.12) * 1.6, 0, 1);
      labelEls.forEach((div) => {
        div.style.opacity = String(labelOpacity);
      });

      // prop spin — only follows RPM while linked; idles gently otherwise
      const spin = isLinked ? THREE.MathUtils.clamp(liveRpm / 220, 1, 16) : 0.4;
      propGroup.rotation.x += dt * spin;

      // gentle idle bob + a bit of forward lean under throttle, only when linked
      root.position.y = Math.sin(elapsed * 1.1) * 0.03;
      root.rotation.x = isLinked ? -throttleN * 0.08 + Math.sin(elapsed * 0.5) * 0.01 : 0;
      root.rotation.y = Math.sin(elapsed * 0.35) * 0.05;

      if (isLinked) {
        const jitter = THREE.MathUtils.clamp((liveVibration - 0.3) * 0.3, 0, 0.08);
        root.position.x = (Math.random() - 0.5) * jitter;
        root.position.z = (Math.random() - 0.5) * jitter;
      } else {
        root.position.x = 0;
        root.position.z = 0;
      }

      // engine glow: status color while linked, neutral gray while offline
      const targetColor = isLinked ? STATUS_COLOR[liveStatus] || STATUS_COLOR.NOMINAL : OFFLINE_COLOR;
      const blinkSpeed = !isLinked ? 0.6 : liveStatus === "CRITICAL" ? 8 : liveStatus === "WARNING" || liveStatus === "CAUTION" ? 3.5 : 1.2;
      const blink = isLinked ? 0.55 + Math.abs(Math.sin(elapsed * blinkSpeed)) * 0.65 : 0.35;
      const mixed = lerpHexColor(`#${engineMat.emissive.getHexString()}`, targetColor, 0.06);
      engineMat.emissive.copy(mixed);
      engineMat.emissiveIntensity = blink;

      // link ring pulse
      linkRing.material.color.copy(mixed);
      linkRing.material.opacity = isLinked ? 0.18 + Math.abs(Math.sin(elapsed * 1.6)) * 0.28 : 0.08;
      const ringScale = isLinked ? 1 + Math.abs(Math.sin(elapsed * 1.6)) * 0.06 : 1;
      linkRing.scale.set(ringScale, ringScale, 1);

      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    }
    animate();

    function handleResize() {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      labelRenderer.setSize(w, h);
    }
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      mount.removeChild(renderer.domElement);
      mount.removeChild(labelRenderer.domElement);
      pmrem.dispose();
      renderer.dispose();
    };
    // init once — telemetry/linked/exploded stream in through refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="uav-3d-wrap">
      <div ref={mountRef} className="drone-3d-canvas" />
      <div className="uav-3d-controls">
        <button className={`btn small ${linked ? "" : "primary"}`} onClick={() => setLinked((v) => !v)}>
          {linked ? "Disconnect from Twin" : "Connect to Twin"}
        </button>
        <button className="btn small ghost" onClick={() => setExploded((v) => !v)}>
          {exploded ? "Assemble" : "Exploded View"}
        </button>
        <span className={`badge ${linked ? "on" : "off"}`}>
          <span className="dot" /> {linked ? "LINKED" : "OFFLINE"}
        </span>
      </div>
    </div>
  );
}
