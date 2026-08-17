import type * as Three from 'three';

export type SceneName = 'ownership' | 'journey' | 'protocol-stack' | 'roadmap-reactor';
export type QualityLevel = 'off' | 'static' | 'low' | 'medium' | 'high';

export interface QualityBudget {
  level: QualityLevel;
  reducedMotion: boolean;
  fps: number;
  dpr: number;
  detail: number;
}

export interface SceneConfig {
  camera: readonly [number, number, number];
  fov: number;
  maxFps: number;
  load: () => Promise<SceneModule>;
}

export interface ScenePointer {
  x: number;
  y: number;
}

export interface SceneWorld {
  update(time: number, delta: number, pointer: ScenePointer): void;
  dispose(): void;
  setState?(patch: Record<string, unknown>): void;
  setViewport?(aspect: number): void;
  getDebugState?(): Record<string, unknown>;
}

export type SceneFactory = (
  three: typeof Three,
  scene: Three.Scene,
  quality: QualityBudget,
) => SceneWorld;

export interface SceneModule {
  createScene: SceneFactory;
}

export interface SceneControl {
  setState(patch: Record<string, unknown>): void;
  pulse(value?: number): void;
}
