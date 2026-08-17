import type { SceneControl, SceneName } from './contracts';

type ListenerTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

/** Keeps semantic HTML controls authoritative and mirrors their state into a scene. */
export function bindSceneInteractions(controller: SceneControl, sceneName: SceneName): () => void {
  const cleanups: Array<() => void> = [];
  const on = (
    target: ListenerTarget | null,
    type: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
  ) => {
    target?.addEventListener(type, handler, options);
    cleanups.push(() => target?.removeEventListener(type, handler, options));
  };
  const select = (buttons: readonly HTMLButtonElement[], current: number) =>
    buttons.forEach((button, index) =>
      button.setAttribute('aria-pressed', String(index === current)),
    );

  if (sceneName === 'ownership') {
    on(document.querySelector('[data-scene-replay]'), 'click', () => {
      controller.setState({ replay: Date.now() });
      controller.pulse(1);
    });
    const markers = [...document.querySelectorAll<HTMLElement>('[data-boundary-scene-state]')];
    let frame = 0;
    const syncScrollState = () => {
      frame = 0;
      if (!markers.length) return;
      const sample = window.scrollY + window.innerHeight * 0.5;
      const positions = markers.map(
        (marker) =>
          marker.offsetTop + Math.min(marker.offsetHeight * 0.35, window.innerHeight * 0.35),
      );
      for (let index = 0; index < positions.length - 1; index += 1) {
        const current = positions[index];
        const next = positions[index + 1];
        if (current !== undefined && next !== undefined && sample < next) {
          const distance = Math.max(1, next - current);
          controller.setState({
            phase: index + Math.max(0, Math.min(1, (sample - current) / distance)),
          });
          return;
        }
      }
      controller.setState({ phase: positions.length - 1 });
    };
    const requestSync = () => {
      if (!frame) frame = requestAnimationFrame(syncScrollState);
    };
    on(window, 'scroll', requestSync, { passive: true });
    on(window, 'resize', requestSync, { passive: true });
    syncScrollState();
    cleanups.push(() => {
      if (frame) cancelAnimationFrame(frame);
    });
  }

  if (sceneName === 'journey') {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-scene-step]')];
    buttons.forEach((button, index) =>
      on(button, 'click', () => {
        select(buttons, index);
        controller.setState({ focus: index });
      }),
    );
  }

  if (sceneName === 'protocol-stack') {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-scene-layer]')];
    buttons.forEach((button, index) =>
      on(button, 'click', () => {
        select(buttons, index);
        controller.setState({ focus: index });
      }),
    );
    on(document.querySelector('[data-scene-all]'), 'click', () => {
      buttons.forEach((button) => button.setAttribute('aria-pressed', 'false'));
      controller.setState({ focus: -1 });
    });
  }

  return () => cleanups.forEach((cleanup) => cleanup());
}
