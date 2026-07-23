import { COLORS, addStudioLights, createPlinth, createResources, createTube, easeInOut, emissive, physical } from '../visual-kit.js';

/** Home: capital remains in the wallet until an explicit path crosses the gate. */
export function createScene(THREE, scene, quality) {
  const resources = createResources();
  const root = new THREE.Group(); scene.add(root); addStudioLights(THREE, scene);

  const floor = new THREE.Mesh(resources.use(new THREE.CircleGeometry(7.2, 72)), physical(THREE, resources, COLORS.panel, { metalness: .2, roughness: .75, opacity: .32, transparent: true }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.72; root.add(floor);

  const wallet = new THREE.Group(); wallet.position.set(-2.45, -.25, 0); root.add(wallet);
  const walletPlinth = createPlinth(THREE, resources, 1.28); walletPlinth.position.y = -1.36; wallet.add(walletPlinth);
  const coreMaterial = emissive(THREE, resources, COLORS.mint, 1.25);
  const core = new THREE.Mesh(resources.use(new THREE.SphereGeometry(.62, quality.detail > 1 ? 48 : 28, 24)), coreMaterial); wallet.add(core);
  const shellMaterial = physical(THREE, resources, 0x164a48, { metalness: .72, roughness: .18, opacity: .82, transparent: true });
  const shell = new THREE.Mesh(resources.use(new THREE.IcosahedronGeometry(.93, 2)), shellMaterial); shell.rotation.z = .34; wallet.add(shell);
  for (let i = 0; i < 3; i += 1) {
    const rib = new THREE.Mesh(resources.use(new THREE.TorusGeometry(1.05 + i * .08, .025, 10, 72)), emissive(THREE, resources, COLORS.mint, .46));
    rib.rotation.set(Math.PI / 2 + i * .48, i * .52, i * .86); wallet.add(rib);
  }

  const gate = new THREE.Group(); gate.position.set(0, -.1, 0); root.add(gate);
  const gateMaterial = emissive(THREE, resources, COLORS.amber, .8);
  const gateRing = new THREE.Mesh(resources.use(new THREE.TorusGeometry(.92, .075, 16, 96)), gateMaterial); gateRing.rotation.y = Math.PI / 2; gate.add(gateRing);
  const gateFrame = new THREE.Mesh(resources.use(new THREE.CylinderGeometry(1.18, 1.18, .16, 64, 1, true)), physical(THREE, resources, 0x5f4913, { metalness: .8, roughness: .25, opacity: .72, transparent: true, side: THREE.DoubleSide }));
  gateFrame.rotation.z = Math.PI / 2; gate.add(gateFrame);

  const vault = new THREE.Group(); vault.position.set(2.48, -.23, 0); root.add(vault);
  const vaultPlinth = createPlinth(THREE, resources, 1.42, 0x17152d); vaultPlinth.position.y = -1.38; vault.add(vaultPlinth);
  const chamber = new THREE.Mesh(resources.use(new THREE.BoxGeometry(1.85, 1.85, 1.85, 3, 3, 3)), physical(THREE, resources, COLORS.violet, { metalness: .15, roughness: .12, transmission: quality.detail > 1 ? .3 : 0, opacity: .32, transparent: true, thickness: .9, depthWrite: false }));
  chamber.rotation.set(.22, .44, .1); vault.add(chamber);
  const vaultCore = new THREE.Mesh(resources.use(new THREE.OctahedronGeometry(.72, 2)), physical(THREE, resources, 0x7354c7, { emissive: COLORS.violet, emissiveIntensity: .45, metalness: .55, roughness: .2 })); vault.add(vaultCore);
  const innerRing = new THREE.Mesh(resources.use(new THREE.TorusGeometry(.88, .035, 10, 72)), emissive(THREE, resources, COLORS.cyan, .72)); innerRing.rotation.x = Math.PI / 2; vault.add(innerRing);

  const route = createTube(THREE, resources, [[-2.25,.15,.35],[-1.35,.72,.25],[0,0,0],[1.25,-.54,.2],[2.3,.08,.15]], COLORS.cyan, .025);
  route.mesh.material.opacity = .55; route.mesh.material.transparent = true; root.add(route.mesh);
  const pulses = Array.from({ length: quality.detail > 1 ? 3 : 1 }, (_, index) => {
    const pulse = new THREE.Mesh(resources.use(new THREE.SphereGeometry(.105, 20, 12)), emissive(THREE, resources, COLORS.white, 2.2));
    pulse.userData.offset = index / 3; root.add(pulse); return pulse;
  });

  const state = { replay: 0, replayAt: performance.now(), pulse: 0 };
  function setViewport(aspect) { const wide = aspect > 1.35; root.position.x = 0; root.scale.setScalar(wide ? 1.12 : .9); }
  function setState(patch) { if (patch.replay !== undefined) state.replayAt = performance.now(); Object.assign(state, patch); }
  function update(time, delta) {
    const seconds = time * .001;
    wallet.rotation.y = Math.sin(seconds * .34) * .08;
    shell.rotation.y += delta * .12;
    core.scale.setScalar(1 + Math.sin(seconds * 1.4) * .035);
    vault.rotation.y = Math.sin(seconds * .27) * .05;
    chamber.rotation.y += delta * .055;
    innerRing.rotation.z -= delta * .12;
    const sequence = ((time - state.replayAt) % 7600) / 7600;
    pulses.forEach((pulse, index) => {
      const local = (sequence + pulse.userData.offset) % 1;
      const active = local > .18 && local < .72;
      const progress = easeInOut((local - .18) / .54);
      pulse.visible = active;
      if (active) pulse.position.copy(route.curve.getPoint(progress));
    });
    const crossing = sequence > .39 && sequence < .52;
    gateMaterial.emissiveIntensity += ((crossing ? 2.1 : .75) - gateMaterial.emissiveIntensity) * .08;
    gate.scale.setScalar(1 + (crossing ? .055 : 0));
  }
  return { root, state, setState, setViewport, update, dispose: () => resources.dispose(root) };
}
