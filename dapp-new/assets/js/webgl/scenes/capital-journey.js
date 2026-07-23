import { COLORS, addStudioLights, createPlinth, createResources, createTube, emissive, physical } from '../visual-kit.js';

/** How it works: four spatially distinct stations and one selected capital unit. */
export function createScene(THREE, scene, quality) {
  const resources = createResources(); const root = new THREE.Group(); scene.add(root); addStudioLights(THREE, scene);
  root.rotation.x = -.08; root.position.y = .38;
  const xs = [-3, -1, 1, 3];
  const colors = [COLORS.mint, COLORS.amber, COLORS.violet, COLORS.cyan];
  const stations = xs.map((x, index) => {
    const group = new THREE.Group(); group.position.set(x, -.72 + Math.sin(index * 1.4) * .18, index % 2 ? -.35 : .12); root.add(group);
    const plinth = createPlinth(THREE, resources, .7, 0x111d33); plinth.position.y = -.65; group.add(plinth);
    let geometry;
    if (index === 0) geometry = new THREE.DodecahedronGeometry(.47, 1);
    if (index === 1) geometry = new THREE.TorusGeometry(.48, .09, 16, 64);
    if (index === 2) geometry = new THREE.BoxGeometry(.78, .78, .78, 2, 2, 2);
    if (index === 3) geometry = new THREE.CapsuleGeometry(.28, .46, 8, 20);
    const object = new THREE.Mesh(resources.use(geometry), physical(THREE, resources, colors[index], { emissive: colors[index], emissiveIntensity: .26, metalness: .52, roughness: .22, opacity: index === 2 ? .7 : 1, transparent: index === 2 }));
    object.rotation.set(.18, .4 + index * .3, index === 1 ? Math.PI / 2 : 0); group.add(object); group.userData.object = object; return group;
  });
  const route = createTube(THREE, resources, [[-3, -.25,.12],[-2,.05,.25],[-1,-.25,-.35],[0,.1,0],[1,-.16,.12],[2,.05,.25],[3,-.18,-.1]], COLORS.cyan, .022); route.mesh.material.opacity = .36; route.mesh.material.transparent = true; root.add(route.mesh);
  const capital = new THREE.Mesh(resources.use(new THREE.SphereGeometry(.14, 24, 16)), emissive(THREE, resources, COLORS.white, 2.4)); root.add(capital);
  const state = { focus: 0, current: 0, pulse: 0 };
  function setViewport(aspect) { const wide = aspect > 1.35; root.position.x = 0; root.position.y = wide ? .15 : .38; root.scale.setScalar(wide ? 1.12 : .88); }
  function setState(patch) { Object.assign(state, patch); }
  function update(time, delta) {
    state.current += (state.focus - state.current) * Math.min(1, delta * 4.2);
    capital.position.copy(route.curve.getPoint(state.current / 3)); capital.position.y += .13;
    stations.forEach((station, index) => {
      const selected = Math.abs(state.current - index) < .42;
      const target = selected ? 1.18 : .92;
      station.scale.lerp(new THREE.Vector3(target,target,target), Math.min(1,delta*5));
      station.userData.object.rotation.y += delta * (selected ? .55 : .13);
    });
    capital.scale.setScalar(1 + Math.sin(time * .006) * .12);
  }
  return { root, state, setState, setViewport, update, dispose: () => resources.dispose(root) };
}
