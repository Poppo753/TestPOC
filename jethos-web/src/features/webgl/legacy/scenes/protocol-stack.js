import { COLORS, addStudioLights, createResources, emissive, physical } from '../visual-kit.js';

/** Protocol: an inspectable exploded stack, intentionally unlike the journey. */
export function createScene(THREE, scene, quality) {
  const resources = createResources(); const root = new THREE.Group(); scene.add(root); addStudioLights(THREE, scene);
  root.rotation.y = -.18; root.position.y = .48;
  const colors = [COLORS.mint, COLORS.violet, COLORS.amber, COLORS.cyan];
  const layers = colors.map((color, index) => {
    const group = new THREE.Group(); root.add(group);
    const plate = new THREE.Mesh(resources.use(new THREE.BoxGeometry(4.4 - index * .18, .34, 2.65 - index * .08, 3, 1, 2)), physical(THREE, resources, color, { emissive: color, emissiveIntensity: .12, metalness: .66, roughness: .25, opacity: .86, transparent: true }));
    group.add(plate);
    const inset = new THREE.Mesh(resources.use(new THREE.BoxGeometry(3.65 - index * .16, .055, 2.05 - index * .08)), emissive(THREE, resources, color, .38)); inset.position.y = .2; group.add(inset);
    group.userData.plate = plate; return group;
  });
  const connectors = [-1.45, 0, 1.45].map((x) => {
    const mesh = new THREE.Mesh(resources.use(new THREE.CylinderGeometry(.035,.035,3.7,12)), emissive(THREE, resources, COLORS.cyan, .65)); mesh.position.set(x,0,0); root.add(mesh); return mesh;
  });
  const modules = [-1,0,1].map((offset,index) => {
    const mesh = new THREE.Mesh(resources.use(new THREE.BoxGeometry(.72,.62,.72)), physical(THREE, resources, [COLORS.violet,COLORS.amber,COLORS.cyan][index], { emissive: [COLORS.violet,COLORS.amber,COLORS.cyan][index], emissiveIntensity:.2, metalness:.5, roughness:.2 }));
    mesh.position.set(2.75, -1.2 + index*1.2, offset*.72); root.add(mesh); return mesh;
  });
  const state = { focus: -1, spread: 1, pulse: 0 };
  function setViewport(aspect) { const wide = aspect > 1.35; root.position.x = 0; root.position.y = wide ? .35 : .48; root.scale.setScalar(wide ? 1.12 : .84); }
  function setState(patch) { Object.assign(state, patch); }
  function update(time, delta) {
    layers.forEach((layer,index) => {
      const baseY = (index - 1.5) * 1.02;
      const selected = state.focus < 0 || state.focus === index;
      const lift = state.focus === index ? .28 : 0;
      layer.position.y += ((baseY + lift) - layer.position.y) * Math.min(1,delta*5);
      layer.scale.lerp(new THREE.Vector3(selected ? 1.02 : .94, selected ? 1.02 : .94, selected ? 1.02 : .94), Math.min(1,delta*4));
      layer.userData.plate.material.emissiveIntensity += ((state.focus === index ? .75 : .12) - layer.userData.plate.material.emissiveIntensity) * .08;
    });
    modules.forEach((module,index) => { module.rotation.y += delta*(.12+index*.04); });
    connectors.forEach((connector,index) => { connector.material.emissiveIntensity = .45 + Math.sin(time*.002+index)*.15; });
  }
  return { root, state, setState, setViewport, update, dispose: () => resources.dispose(root) };
}
