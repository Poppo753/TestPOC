import * as THREE from 'three';

import { createDebugPanel } from './debug';
import type {
  QualityBudget,
  SceneConfig,
  SceneControl,
  SceneFactory,
  SceneName,
  ScenePointer,
  SceneWorld,
} from './contracts';

export class SceneController implements SceneControl {
  readonly pointer: ScenePointer = { x: 0, y: 0 };
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly world: SceneWorld;
  readonly baseCamera: THREE.Vector3;
  private running = false;
  private visible = true;
  private lastFrame = 0;
  private lastRender = 0;
  private readonly resizeObserver?: ResizeObserver;
  private readonly intersectionObserver?: IntersectionObserver;
  private readonly debug;

  constructor(
    private readonly host: HTMLElement,
    canvas: HTMLCanvasElement,
    private readonly config: SceneConfig,
    private readonly quality: QualityBudget,
    sceneName: SceneName,
    factory: SceneFactory,
  ) {
    this.scene.fog = new THREE.FogExp2(0x07101f, 0.035);
    this.camera = new THREE.PerspectiveCamera(config.fov, 1, 0.1, 100);
    this.camera.position.set(...config.camera);
    this.baseCamera = this.camera.position.clone();
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: quality.level === 'high',
      powerPreference: quality.level === 'low' ? 'low-power' : 'high-performance',
    });
    this.renderer.setClearColor(0x07101f, 0);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality.dpr));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.world = factory(THREE, this.scene, quality);
    this.debug = createDebugPanel(host, this.renderer, sceneName, quality);

    window.addEventListener('pointermove', this.onPointer, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibility);
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(host);
    }
    if ('IntersectionObserver' in window) {
      this.intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          this.visible = entry?.isIntersecting ?? true;
          if (this.visible) this.start();
          else this.stop();
        },
        { rootMargin: '150px' },
      );
      this.intersectionObserver.observe(host);
    }
    this.resize();
  }

  private readonly onPointer = (event: PointerEvent) => {
    const rect = this.host.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    this.pointer.y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1;
  };

  private readonly onVisibility = () => {
    this.visible = !document.hidden;
    if (this.visible) this.start();
    else this.stop();
  };

  start(): void {
    if (this.running || !this.visible) return;
    this.running = true;
    if (this.quality.level === 'static') {
      this.render(performance.now(), 0);
      return;
    }
    this.renderer.setAnimationLoop((time) => this.frame(time));
  }

  stop(): void {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  private frame(time: number): void {
    if (!this.running) return;
    const interval = 1000 / Math.min(this.quality.fps, this.config.maxFps);
    if (time - this.lastRender < interval) return;
    const delta = Math.min(0.05, (time - (this.lastFrame || time)) / 1000);
    this.lastFrame = time;
    this.lastRender = time;
    this.render(time, delta);
  }

  private render(time: number, delta: number): void {
    this.world.update(time, delta, this.pointer);
    const motion = this.quality.reducedMotion ? 0 : 1;
    this.camera.position.x +=
      (this.baseCamera.x + this.pointer.x * 0.16 * motion - this.camera.position.x) * 0.025;
    this.camera.position.y +=
      (this.baseCamera.y - this.pointer.y * 0.1 * motion - this.camera.position.y) * 0.025;
    this.camera.lookAt(0, -0.1, 0);
    this.renderer.render(this.scene, this.camera);
    this.debug.update(time, this.world.getDebugState?.());
  }

  resize(): void {
    const rect = this.host.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    this.camera.aspect = width / height;
    const portraitCompensation =
      this.camera.aspect < 1.35 ? Math.min(1.55, 1.35 / this.camera.aspect) : 1;
    this.baseCamera.set(
      this.config.camera[0],
      this.config.camera[1],
      this.config.camera[2] * portraitCompensation,
    );
    this.camera.position.z = this.baseCamera.z;
    this.world.setViewport?.(this.camera.aspect);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    if (this.quality.level === 'static') {
      requestAnimationFrame(() => this.render(performance.now(), 0));
    }
  }

  setState(patch: Record<string, unknown>): void {
    this.world.setState?.(patch);
    if (this.quality.level === 'static') {
      requestAnimationFrame(() => this.render(performance.now(), 0));
    }
  }

  pulse(value = 1): void {
    this.setState({ pulse: value });
  }

  dispose(): void {
    this.stop();
    window.removeEventListener('pointermove', this.onPointer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.debug.dispose();
    this.world.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
