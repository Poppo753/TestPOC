import { createResources, easeInOut } from '../visual-kit.js';

const TAU = Math.PI * 2;

const PALETTE = Object.freeze({
  ringInner: 0x9d8ac9,
  ringMid: 0x6f5f9b,
  ringOuter: 0x4e4677,
  ringRim: 0x2c5f52,
  violetSoft: 0xb7a4ed,
  violet: 0x9b87b8,
  mint: 0x57c7a3,
  mintSoft: 0x9de8cf,
  amber: 0xd7a64b,
  ember: 0x8f5a4e,
  guide: 0x4d8279,
});

/*
 * Partial arcs, never full circles: the system is deliberately open so it
 * reads as a diagram, not as a planet. Arcs are centred on +X and the group
 * sits right of centre, which keeps the hero copy area on the left free.
 */
const RINGS = [
  { radius: 1.30, tube: .055, arc: 2.30, spin: .00, tilt: .10, yaw: -.26, z: .30, color: PALETTE.ringInner, glow: .52, spreadOut: .08, spreadZ: .34 },
  { radius: 1.70, tube: .082, arc: 2.56, spin: -.11, tilt: .14, yaw: -.20, z: .02, color: PALETTE.ringMid, glow: .36, spreadOut: .16, spreadZ: .06 },
  { radius: 2.12, tube: .094, arc: 2.26, spin: .07, tilt: .18, yaw: -.14, z: -.30, color: PALETTE.ringOuter, glow: .26, spreadOut: .24, spreadZ: -.34 },
  { radius: 2.56, tube: .048, arc: 1.82, spin: -.22, tilt: .22, yaw: -.08, z: -.66, color: PALETTE.ringRim, glow: .22, spreadOut: .30, spreadZ: -.60 },
];

const GATE_ANGLE = -.72;
const GATE_RADIUS = 1.92;
const ORBIT_RADIUS = 1.04;

/*
 * Narrative keyframes. `at` maps to the phase produced by the scroll bridge:
 * 0 hero · 1 capital boundary · 2 transparency · 3 risk routes ·
 * 4 strategy inspector · 5 architecture · 6 closing call to action.
 * Intermediate entries hold a state before the next section takes over.
 */
const STATE_KEYS = ['rotX', 'rotY', 'posX', 'posY', 'scale', 'spread', 'ringOpacity', 'gate', 'journey', 'flow', 'core', 'evidence', 'routes', 'guides', 'dim'];
const STATES = [
  { at: 0.0, rotX: .06, rotY: -.34, posX: .15, posY: -.65, scale: 1.10, spread: .05, ringOpacity: .95, gate: .30, journey: .20, flow: .55, core: .30, evidence: .00, routes: .00, guides: .14, dim: .00 },
  { at: 1.0, rotX: .05, rotY: -.26, posX: .05, posY: -.50, scale: 1.08, spread: .18, ringOpacity: .95, gate: .44, journey: .46, flow: .78, core: .48, evidence: .00, routes: .00, guides: .26, dim: .10 },
  { at: 1.5, rotX: .03, rotY: -.17, posX: -.05, posY: -.42, scale: 1.10, spread: .28, ringOpacity: .90, gate: 1.0, journey: 1.04, flow: 1.00, core: .66, evidence: .04, routes: .00, guides: .30, dim: .40 },
  { at: 2.0, rotX: .09, rotY: -.20, posX: -.10, posY: -.30, scale: 1.04, spread: .40, ringOpacity: .92, gate: .42, journey: 1.30, flow: .70, core: .90, evidence: .18, routes: .00, guides: .34, dim: .05 },
  { at: 2.8, rotX: .18, rotY: -.10, posX: -.20, posY: -.15, scale: 0.98, spread: .62, ringOpacity: .74, gate: .30, journey: 1.55, flow: .55, core: .95, evidence: 1.00, routes: .00, guides: .46, dim: .00 },
  { at: 3.2, rotX: .13, rotY: -.20, posX: -.15, posY: -.20, scale: 0.96, spread: .58, ringOpacity: .78, gate: .26, journey: 1.68, flow: .50, core: .85, evidence: .55, routes: .70, guides: .42, dim: .00 },
  { at: 3.9, rotX: .11, rotY: -.24, posX: -.15, posY: -.20, scale: 0.95, spread: .60, ringOpacity: .80, gate: .24, journey: 1.86, flow: .48, core: .82, evidence: .40, routes: 1.00, guides: .40, dim: .00 },
  { at: 4.3, rotX: .14, rotY: -.30, posX: -.10, posY: -.20, scale: 0.97, spread: .80, ringOpacity: .78, gate: .28, journey: 2.00, flow: .52, core: .90, evidence: .80, routes: .35, guides: .50, dim: .00 },
  { at: 5.0, rotX: .09, rotY: -.38, posX: -.25, posY: -.15, scale: 0.93, spread: .95, ringOpacity: .82, gate: .24, journey: 2.22, flow: .50, core: .86, evidence: .60, routes: .15, guides: .55, dim: .00 },
  { at: 5.7, rotX: .07, rotY: -.34, posX: .00, posY: -.40, scale: 0.98, spread: .45, ringOpacity: .90, gate: .20, journey: 2.45, flow: .48, core: .74, evidence: .30, routes: .00, guides: .34, dim: .00 },
  { at: 6.0, rotX: .06, rotY: -.31, posX: .10, posY: -.55, scale: 1.06, spread: .18, ringOpacity: .94, gate: .22, journey: 2.60, flow: .46, core: .66, evidence: .12, routes: .00, guides: .22, dim: .00 },
];
const MAX_PHASE = STATES[STATES.length - 1].at;

/** Interpolate the authored keyframes into one frame description. */
function readState(phase, out) {
  let index = 0;
  while (index < STATES.length - 2 && phase >= STATES[index + 1].at) index += 1;
  const from = STATES[index];
  const to = STATES[index + 1];
  const blend = easeInOut((phase - from.at) / Math.max(.0001, to.at - from.at));
  for (const key of STATE_KEYS) out[key] = from[key] + (to[key] - from[key]) * blend;
  return out;
}

/** Soft radial sprite used as a cheap, local substitute for a bloom pass. */
function createGlowTexture(THREE, resources) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,.92)');
  gradient.addColorStop(.32, 'rgba(255,255,255,.3)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = resources.use(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Landing scene: the "Controlled Orbit System".
 *
 * Capital arrives from outside the frame along a single mint flow, waits at an
 * amber authorization gate and only then enters the governed interior. Scroll
 * does not spin the object: it opens it, so each section exposes one more layer
 * of the same system instead of showing a different one.
 */
export function createScene(THREE, scene, quality) {
  const resources = createResources();
  const detail = quality.detail;
  const tubular = detail >= 3 ? 128 : detail >= 2 ? 84 : 48;
  const radial = detail >= 2 ? 12 : 8;
  const specs = RINGS.slice(0, detail >= 2 ? RINGS.length : 3);

  const root = new THREE.Group();
  const system = new THREE.Group();
  root.add(system);
  scene.add(root);
  scene.fog = new THREE.FogExp2(0x061211, .028);

  const matte = (color, options = {}) => resources.use(new THREE.MeshStandardMaterial({
    color,
    emissive: options.emissive ?? color,
    emissiveIntensity: options.glow ?? .12,
    metalness: options.metalness ?? .18,
    roughness: options.roughness ?? .52,
    transparent: true,
    opacity: options.opacity ?? 1,
    depthWrite: options.depthWrite ?? true,
  }));

  const glowTexture = createGlowTexture(THREE, resources);
  const glowSprite = (color, size, opacity) => {
    const sprite = new THREE.Sprite(resources.use(new THREE.SpriteMaterial({
      map: glowTexture, color, transparent: true, opacity,
      depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    })));
    sprite.scale.setScalar(size);
    return sprite;
  };

  /* Lighting stays deliberately small: one soft key plus three coloured
     accents that belong to the core, the gate and the incoming flow. */
  const ambient = new THREE.HemisphereLight(0x9fc4b8, 0x040d0c, 1.05);
  const key = new THREE.DirectionalLight(0xd8e6de, 2.4);
  key.position.set(-5, 4.5, 6.5);
  root.add(ambient, key);
  const violetLight = new THREE.PointLight(PALETTE.violet, 6, 9, 2);
  violetLight.position.set(0, 0, 1.1);
  const amberLight = new THREE.PointLight(PALETTE.amber, 2, 6, 2);
  const mintLight = new THREE.PointLight(PALETTE.mint, 3, 8, 2);
  mintLight.position.set(-2.6, -1.7, 1.4);
  system.add(violetLight, amberLight, mintLight);

  // 1 · Partial orbit rings ------------------------------------------------
  const rings = specs.map((spec) => {
    const group = new THREE.Group();
    group.rotation.set(spec.tilt, spec.yaw, 0);
    group.position.z = spec.z;
    const material = matte(spec.color, { glow: spec.glow, roughness: .48, metalness: .22 });
    const mesh = new THREE.Mesh(resources.use(new THREE.TorusGeometry(spec.radius, spec.tube, radial, tubular, spec.arc)), material);
    mesh.rotation.z = spec.spin - spec.arc / 2;
    group.add(mesh);
    system.add(group);
    return { spec, group, mesh, material };
  });

  const guideMaterial = matte(PALETTE.guide, { glow: .5, opacity: .2, depthWrite: false, roughness: .7 });
  const guides = new THREE.Group();
  guides.rotation.set(.5, -.06, 0);
  [2.78, 3.16].forEach((radius) => {
    guides.add(new THREE.Mesh(resources.use(new THREE.TorusGeometry(radius, .006, 6, detail >= 2 ? 96 : 56)), guideMaterial));
  });
  system.add(guides);

  // 2 · Authorization gate -------------------------------------------------
  const gateGroup = new THREE.Group();
  gateGroup.rotation.set(RINGS[2].tilt, RINGS[2].yaw, 0);
  gateGroup.position.z = -.1;
  system.add(gateGroup);
  const gateMaterial = matte(PALETTE.amber, { glow: .6, roughness: .34, metalness: .3 });
  const gate = new THREE.Mesh(resources.use(new THREE.TorusGeometry(GATE_RADIUS, .1, radial, detail >= 2 ? 28 : 16, .34)), gateMaterial);
  gate.rotation.z = GATE_ANGLE - .17;
  gateGroup.add(gate);
  const gatePoint = new THREE.Vector3(Math.cos(GATE_ANGLE) * GATE_RADIUS, Math.sin(GATE_ANGLE) * GATE_RADIUS, 0)
    .applyEuler(gateGroup.rotation)
    .add(gateGroup.position);
  const gateGlow = glowSprite(PALETTE.amber, 1.25, .14);
  gateGlow.position.copy(gatePoint);
  amberLight.position.copy(gatePoint);
  system.add(gateGlow);

  // 3 · Incoming capital flow ---------------------------------------------
  const flowCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-6.8, -1.34, 1.4),
    new THREE.Vector3(-4.4, -1.18, 1.0),
    new THREE.Vector3(-2.5, -1.06, .66),
    new THREE.Vector3(-.8, -1.02, .42),
    new THREE.Vector3(.6, -1.06, .22),
    gatePoint.clone().add(new THREE.Vector3(-.42, -.16, .14)),
    gatePoint.clone(),
  ]);
  const flowMaterial = matte(PALETTE.mint, { glow: .9, opacity: .4, depthWrite: false, roughness: .6 });
  const flow = new THREE.Mesh(resources.use(new THREE.TubeGeometry(flowCurve, detail >= 2 ? 96 : 48, .016, 6, false)), flowMaterial);
  system.add(flow);

  // 4 · Vault core ---------------------------------------------------------
  const core = new THREE.Group();
  core.rotation.set(RINGS[0].tilt, RINGS[0].yaw, 0);
  system.add(core);
  const coreMaterial = matte(PALETTE.violetSoft, { glow: 1.1, roughness: .4, metalness: .1 });
  core.add(new THREE.Mesh(resources.use(new THREE.TorusGeometry(.58, .022, 8, detail >= 2 ? 88 : 48)), coreMaterial));
  const coreInnerMaterial = matte(PALETTE.violet, { glow: .5, opacity: .55, depthWrite: false });
  core.add(new THREE.Mesh(resources.use(new THREE.TorusGeometry(.4, .01, 6, detail >= 2 ? 64 : 36)), coreInnerMaterial));
  const coreGlow = glowSprite(PALETTE.violet, 2.4, .16);
  system.add(coreGlow);

  // 5 · Markers ------------------------------------------------------------
  const markerGeometry = resources.use(new THREE.SphereGeometry(.055, 14, 10));
  const capitalMaterial = matte(PALETTE.mintSoft, { glow: 1.6, roughness: .3 });
  const capital = new THREE.Mesh(markerGeometry, capitalMaterial);
  capital.add(glowSprite(PALETTE.mint, .7, .5));
  system.add(capital);
  /* Two smaller packets make the incoming line read as a controlled flow,
     rather than as one decorative ball. They never cross the gate on idle. */
  const flowPulses = [0, .5].map((offset) => {
    const material = matte(PALETTE.mintSoft, { glow: 1.25, opacity: .72, depthWrite: false, roughness: .34 });
    const marker = new THREE.Mesh(resources.use(new THREE.SphereGeometry(.027, 10, 8)), material);
    marker.add(glowSprite(PALETTE.mint, .38, .42));
    system.add(marker);
    return { marker, material, offset };
  });

  /* Two extra markers only exist to compare routes; each one is pinned to its
     own route arc so it can never wander like a particle. */
  const routeArcs = [
    { radius: 1.16, color: PALETTE.mint, weight: .55, arc: 1.7, angle: -.2 },
    { radius: 1.52, color: PALETTE.amber, weight: .34, arc: 1.4, angle: -.5, marker: .9, sweep: .55 },
    { radius: 1.9, color: PALETTE.ember, weight: .2, arc: 1.1, angle: -.95, marker: .42, sweep: .16 },
  ].map((config) => {
    const material = matte(config.color, { glow: .8, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(resources.use(new THREE.TorusGeometry(config.radius, .009, 6, detail >= 2 ? 64 : 36, config.arc)), material);
    mesh.rotation.z = config.angle - config.arc / 2;
    core.add(mesh);
    return { ...config, mesh, material };
  });

  const routeMarkers = routeArcs.filter((arc) => arc.marker).map((arc) => {
    const material = matte(arc.color, { glow: 1.2, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(markerGeometry, material);
    core.add(mesh);
    return { arc, mesh, material };
  });

  // 6 · Evidence nodes -----------------------------------------------------
  const evidence = [];
  const evidenceMaterial = matte(PALETTE.mintSoft, { glow: 1.1, opacity: 0, depthWrite: false });
  const nodeGeometry = resources.use(new THREE.SphereGeometry(.032, 10, 8));
  const tickGeometry = resources.use(new THREE.CylinderGeometry(.005, .005, .16, 5));
  const perRing = detail >= 2 ? 4 : 2;
  rings.forEach((ring, ringIndex) => {
    if (ringIndex === rings.length - 1) return;
    for (let index = 0; index < perRing; index += 1) {
      const angle = -ring.spec.arc / 2 + ring.spec.spin + (ring.spec.arc * (index + .6)) / (perRing + .2);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const node = new THREE.Mesh(nodeGeometry, evidenceMaterial);
      node.position.set(cos * ring.spec.radius, sin * ring.spec.radius, 0);
      const tick = new THREE.Mesh(tickGeometry, evidenceMaterial);
      tick.position.set(cos * (ring.spec.radius + .12), sin * (ring.spec.radius + .12), 0);
      tick.rotation.z = angle - Math.PI / 2;
      ring.group.add(node, tick);
      evidence.push(node, tick);
    }
  });

  // Authorization wave, played once each time the marker crosses the gate.
  const waveMaterial = matte(PALETTE.amber, { glow: 1.4, opacity: 0, depthWrite: false });
  const wave = new THREE.Mesh(resources.use(new THREE.TorusGeometry(1, .01, 6, detail >= 2 ? 72 : 40)), waveMaterial);
  wave.rotation.copy(core.rotation);
  wave.visible = false;
  system.add(wave);

  const state = { phase: 0 };
  const frame = {};
  let currentPhase = 0;
  let previousJourney = STATES[0].journey;
  let waveTime = -1;
  let flash = 0;
  let pointerX = 0;
  let pointerY = 0;
  let pointerEnergy = 0;

  /** Local point on a ring plane, respecting its live spread and tilt. */
  function orbitPoint(ring, angle, radius, out) {
    return out
      .set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0)
      .multiplyScalar(ring.group.scale.x)
      .applyEuler(ring.group.rotation)
      .add(ring.group.position);
  }

  function setViewport(aspect) {
    const portrait = aspect < 1.05;
    const narrow = aspect < 1.35;
    root.position.set(portrait ? .1 : narrow ? .9 : 1.3, portrait ? .35 : 0, 0);
    root.scale.setScalar(portrait ? .62 : narrow ? .82 : 1);
  }

  function setState(patch) {
    if (Number.isFinite(patch.phase)) state.phase = Math.max(0, Math.min(MAX_PHASE, patch.phase));
    if (patch.replay || patch.pulse) { flash = 1; waveTime = 0; }
  }

  function update(time, delta, pointer = { x: 0, y: 0 }) {
    const seconds = time * .001;
    const still = quality.reducedMotion || quality.level === 'static';
    const motion = still ? 0 : 1;
    /* Pointer values are smoothed inside the scene. This prevents direct DOM
       mouse samples from making the ring system twitch or feel bugged. */
    const pointerDelta = Math.hypot(pointer.x - pointerX, pointer.y - pointerY);
    pointerX += (pointer.x - pointerX) * Math.min(1, delta * 7);
    pointerY += (pointer.y - pointerY) * Math.min(1, delta * 7);
    pointerEnergy = Math.max(pointerEnergy * Math.exp(-delta * 2.8), Math.min(1, pointerDelta * 1.8)) * motion;
    currentPhase += (state.phase - currentPhase) * (still ? 1 : Math.min(1, delta * 2.2));
    const s = readState(currentPhase, frame);

    /* The scene should feel alive at rest, but never spin like a planet.
       These are bounded diagram motions: a slow tilt, a small lateral drift
       and ring-specific phase offsets, all intentionally capped below 4°. */
    system.rotation.x = s.rotX + Math.sin(seconds * .13) * .009 * motion + pointerY * .028 * motion;
    system.rotation.y = s.rotY + Math.sin(seconds * .10) * .014 * motion + pointerX * .050 * motion;
    system.position.set(s.posX + Math.sin(seconds * .08) * .045 * motion, s.posY + Math.sin(seconds * .18) * .05 * motion, 0);
    system.scale.setScalar(s.scale);

    const attenuation = 1 - s.dim * .45;
    rings.forEach((ring, index) => {
      ring.group.scale.setScalar(1 + s.spread * ring.spec.spreadOut);
      ring.group.position.z = ring.spec.z + s.spread * ring.spec.spreadZ;
      const scrollSweep = s.spread * (.12 + index * .075) * (index % 2 ? -1 : 1);
      const mouseWave = Math.sin(seconds * .82 + index * .95) * pointerEnergy * (.075 + index * .013);
      ring.group.rotation.x = ring.spec.tilt + Math.sin(seconds * .12 + index) * .008 * motion + pointerY * (.022 + index * .005) * motion;
      ring.group.rotation.y = ring.spec.yaw - s.spread * .05 * index + pointerX * (.035 + index * .008) * motion;
      /* Scroll performs the intentional opening. Mouse movement sends one
         decaying wave through the arcs, so they respond as one system rather
         than each orbiting independently forever. */
      ring.mesh.rotation.z = ring.spec.spin - ring.spec.arc / 2
        + scrollSweep + mouseWave + pointerX * (.11 + index * .018) * motion;
      ring.group.rotation.z = pointerY * .028 * motion + Math.sin(seconds * .16 + index) * .012 * motion;
      ring.material.opacity = s.ringOpacity * attenuation;
      ring.material.emissiveIntensity = ring.spec.glow * (.85 + s.core * .4);
    });
    guideMaterial.opacity = s.guides * .3 * attenuation;
    guides.scale.setScalar(1 + s.spread * .1);

    // The gate is the only element allowed to brighten sharply.
    flash = Math.max(0, flash - delta * 1.2);
    const gateBreath = (Math.sin(seconds * .38) + 1) * .025 * motion;
    const gateLevel = Math.min(1.7, s.gate + flash * .7 + gateBreath);
    gateGroup.scale.setScalar(1 + s.spread * .18 + gateBreath * .16);
    gateMaterial.emissiveIntensity = .3 + gateLevel * 1.35;
    gateGlow.material.opacity = .1 + gateLevel * .34;
    amberLight.intensity = 1 + gateLevel * 4;

    const flowBreath = (Math.sin(seconds * .52) + 1) * .045 * motion;
    flowMaterial.opacity = (s.flow * .8 + flowBreath) * attenuation;
    flowMaterial.emissiveIntensity = .6 + s.flow * .9 + flowBreath * .9;
    mintLight.intensity = 1.4 + s.flow * 2.6;

    coreMaterial.emissiveIntensity = .5 + s.core * 1.5;
    coreInnerMaterial.opacity = .25 + s.core * .45;
    core.rotation.z = Math.sin(seconds * .16) * .055 * motion;
    core.scale.setScalar((.92 + s.core * .18) * (1 + Math.sin(seconds * .42) * .022 * motion));
    coreGlow.material.opacity = .08 + s.core * .26;
    coreGlow.scale.setScalar(2.2 + s.core * .5);
    violetLight.intensity = 2 + s.core * 5.5;

    /* One marker, one journey: below 1 it travels the incoming flow, above 1
       it orbits inside the boundary it just crossed. */
    if (s.journey < 1) {
      /* A restrained 9-second transit makes the incoming flow legible even
         before the user scrolls. It deliberately stops before the gate: no
         visual capital crosses the boundary without the scroll state. */
      capital.position.copy(flowCurve.getPoint(Math.max(0, s.journey)));
    } else {
      const angle = GATE_ANGLE + (s.journey - 1) * TAU * .62 + Math.sin(seconds * .22) * .23 * motion;
      orbitPoint(rings[0], angle, ORBIT_RADIUS, capital.position);
    }
    capitalMaterial.opacity = .55 + Math.min(1, s.flow + s.core) * .45;
    flowPulses.forEach(({ marker, material, offset }, index) => {
      const pulse = (seconds * (.105 + index * .012) + offset) % 1;
      const progress = .08 + pulse * Math.min(.76, .56 + s.flow * .22);
      marker.position.copy(flowCurve.getPoint(progress));
      const envelope = Math.sin(pulse * Math.PI);
      marker.visible = s.flow > .12;
      material.opacity = envelope * s.flow * .78;
      marker.scale.setScalar(.78 + envelope * .52);
    });
    if (previousJourney < 1 && s.journey >= 1 && !still) { waveTime = 0; flash = 1; }
    previousJourney = s.journey;

    if (waveTime >= 0) {
      waveTime += delta;
      const progress = Math.min(1, waveTime / 1.6);
      wave.visible = progress < 1;
      wave.scale.setScalar(.5 + progress * 2.4);
      waveMaterial.opacity = (1 - progress) * .32;
      if (progress >= 1) waveTime = -1;
    }

    const evidenceVisible = s.evidence > .02;
    evidenceMaterial.opacity = s.evidence * .85;
    evidence.forEach((node, index) => {
      node.visible = evidenceVisible;
      const pulse = 1 + Math.sin(seconds * .45 + index * .8) * .12 * motion;
      node.scale.setScalar(pulse);
    });
    const routesVisible = s.routes > .02;
    routeArcs.forEach((arc) => { arc.material.opacity = s.routes * arc.weight; arc.mesh.visible = routesVisible; });
    routeMarkers.forEach(({ arc, mesh, material }) => {
      material.opacity = s.routes * arc.marker;
      mesh.visible = routesVisible;
      const angle = arc.angle + s.routes * arc.sweep + Math.sin(seconds * .7 + arc.radius) * pointerEnergy * .08 * motion;
      mesh.position.set(Math.cos(angle) * arc.radius, Math.sin(angle) * arc.radius, 0);
      mesh.scale.setScalar(1 + Math.sin(seconds * .48 + arc.radius) * .18 * motion);
    });
  }

  return {
    root,
    state,
    setState,
    setViewport,
    update,
    getDebugState: () => ({ phase: currentPhase.toFixed(2), pointer: `${pointerX.toFixed(2)},${pointerY.toFixed(2)}`, wave: pointerEnergy.toFixed(2) }),
    dispose: () => resources.dispose(root),
  };
}
