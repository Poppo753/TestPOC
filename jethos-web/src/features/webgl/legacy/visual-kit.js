export const COLORS = Object.freeze({
  ink: 0x07101f, panel: 0x101b31, mint: 0x45ddb5, violet: 0xa78bfa,
  cyan: 0x22d3ee, amber: 0xfbbf24, white: 0xf5f7fb, muted: 0x52617b,
});

/** Track resources once so every scene can release its GPU allocations. */
export function createResources() {
  const resources = new Set();
  return {
    use(value) { if (value) resources.add(value); return value; },
    dispose(root) { resources.forEach((resource) => resource.dispose?.()); resources.clear(); root?.clear(); },
  };
}

export function physical(THREE, resources, color, options = {}) {
  return resources.use(new THREE.MeshPhysicalMaterial({
    color,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    metalness: options.metalness ?? .48,
    roughness: options.roughness ?? .28,
    transmission: options.transmission ?? 0,
    transparent: Boolean(options.transparent || options.opacity < 1 || options.transmission),
    opacity: options.opacity ?? 1,
    thickness: options.thickness ?? .6,
    clearcoat: options.clearcoat ?? .35,
    clearcoatRoughness: .22,
    side: options.side,
    depthWrite: options.depthWrite ?? true,
  }));
}

export function emissive(THREE, resources, color, intensity = 1.2) {
  return resources.use(new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, metalness: .22, roughness: .28 }));
}

export function addStudioLights(THREE, scene) {
  scene.add(new THREE.HemisphereLight(0xb9dfff, 0x080b16, 1.55));
  const key = new THREE.DirectionalLight(0xd8e8ff, 4.2); key.position.set(-4, 6, 7); scene.add(key);
  const violet = new THREE.PointLight(COLORS.violet, 25, 13, 2); violet.position.set(4, 1, 3); scene.add(violet);
  const mint = new THREE.PointLight(COLORS.mint, 18, 11, 2); mint.position.set(-4, -1, 2); scene.add(mint);
}

export function createPlinth(THREE, resources, radius = 1.2, color = COLORS.panel) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(resources.use(new THREE.CylinderGeometry(radius, radius * 1.08, .16, 48)), physical(THREE, resources, color, { metalness: .72, roughness: .24 }));
  const inset = new THREE.Mesh(resources.use(new THREE.CylinderGeometry(radius * .78, radius * .82, .025, 48)), emissive(THREE, resources, COLORS.cyan, .28));
  inset.position.y = .095; group.add(base, inset); return group;
}

export function createTube(THREE, resources, points, color, radius = .025) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const mesh = new THREE.Mesh(resources.use(new THREE.TubeGeometry(curve, 72, radius, 8, false)), emissive(THREE, resources, color, 1.6));
  return { curve, mesh };
}

export function easeInOut(value) {
  const x = Math.min(1, Math.max(0, value));
  return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

