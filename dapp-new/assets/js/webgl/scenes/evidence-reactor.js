import { COLORS, addStudioLights, createPlinth, createResources, createTube, emissive, physical } from '../visual-kit.js';

/** Roadmap: a restrained reactor that stabilizes as evidence gates are passed. */
export function createScene(THREE, scene, quality) {
  const resources = createResources(); const root = new THREE.Group(); root.position.y = .42; scene.add(root); addStudioLights(THREE, scene);
  const route = createTube(THREE, resources, [[-3.6,0,0],[-2.4,.35,.2],[-1.2,-.2,-.15],[0,.25,.12],[1.2,-.18,-.1],[2.4,.25,.18],[3.6,0,0]], COLORS.mint, .035); route.mesh.material.opacity=.44; route.mesh.material.transparent=true; root.add(route.mesh);
  const gates = Array.from({length:5},(_,index) => {
    const group = new THREE.Group(); group.position.set(-3.2+index*1.6, index%2?.18:-.12, 0); root.add(group);
    const ringMaterial = physical(THREE, resources, COLORS.muted, { emissive: COLORS.cyan, emissiveIntensity:.04, metalness:.72, roughness:.24 });
    const ring = new THREE.Mesh(resources.use(new THREE.TorusGeometry(.58,.075,14,72)), ringMaterial); group.add(ring);
    const brace = new THREE.Mesh(resources.use(new THREE.TorusGeometry(.78,.018,8,64)), emissive(THREE, resources, COLORS.cyan,.12)); brace.rotation.x=Math.PI/2; group.add(brace);
    const plinth=createPlinth(THREE,resources,.66); plinth.position.y=-.9; group.add(plinth);
    group.userData={ring,brace}; return group;
  });
  const core = new THREE.Mesh(resources.use(new THREE.DodecahedronGeometry(.25,1)), emissive(THREE,resources,COLORS.white,2.2)); root.add(core);
  const state={roadmap:0,progress:0,pulse:0};
  function setViewport(aspect){const wide=aspect>1.35;root.position.x=0;root.position.y=wide?.1:.42;root.scale.setScalar(wide?1.12:.86);}
  function setState(patch){Object.assign(state,patch);}
  function update(time,delta){
    state.progress += (state.roadmap-state.progress)*Math.min(1,delta*2.4);
    core.position.copy(route.curve.getPoint(Math.min(.999,state.progress))); core.position.y+=.05; core.rotation.y+=delta*.7; core.rotation.x+=delta*.34;
    gates.forEach((gate,index)=>{
      const completed=index<Math.round(state.progress*5); const current=index===Math.round(state.progress*5);
      gate.userData.ring.material.color.setHex(completed?COLORS.mint:current?COLORS.amber:COLORS.muted);
      gate.userData.ring.material.emissive.setHex(completed?COLORS.mint:current?COLORS.amber:COLORS.cyan);
      gate.userData.ring.material.emissiveIntensity += (((completed||current)?.65:.04)-gate.userData.ring.material.emissiveIntensity)*.08;
      gate.userData.brace.rotation.z += delta*(completed?.18:.035);
      const scale=current?1+Math.sin(time*.004)*.035:1; gate.scale.setScalar(scale);
    });
  }
  return {root,state,setState,setViewport,update,dispose:()=>resources.dispose(root)};
}
