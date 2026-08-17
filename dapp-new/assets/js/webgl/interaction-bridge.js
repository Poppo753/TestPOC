/** HTML remains the complete control surface; this bridge only mirrors state. */
export function bindSceneInteractions(controller, sceneName) {
  const cleanups = [];
  const on = (target, type, handler, options) => { target?.addEventListener(type, handler, options); cleanups.push(() => target?.removeEventListener(type, handler, options)); };
  const select = (buttons, current) => buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === current)));
  if (sceneName === 'ownership') {
    const replay = document.querySelector('[data-scene-replay]');
    on(replay, 'click', () => { controller.setState({ replay: Date.now() }); controller.pulse(1); });
    const markers = [...document.querySelectorAll('[data-boundary-scene-state]')];
    let frame = 0;
    const syncScrollState = () => {
      frame = 0;
      if (!markers.length) return;
      const sample = window.scrollY + window.innerHeight * .5;
      const positions = markers.map((marker) => marker.offsetTop + Math.min(marker.offsetHeight * .35, window.innerHeight * .35));
      let phase = 0;
      for (let index = 0; index < positions.length - 1; index += 1) {
        if (sample < positions[index + 1]) {
          const distance = Math.max(1, positions[index + 1] - positions[index]);
          phase = index + Math.max(0, Math.min(1, (sample - positions[index]) / distance));
          controller.setState({ phase });
          return;
        }
      }
      controller.setState({ phase: positions.length - 1 });
    };
    const requestSync = () => { if (!frame) frame = requestAnimationFrame(syncScrollState); };
    on(window, 'scroll', requestSync, { passive: true });
    on(window, 'resize', requestSync, { passive: true });
    syncScrollState();
    cleanups.push(() => { if (frame) cancelAnimationFrame(frame); });
  }
  if (sceneName === 'journey') {
    const buttons = [...document.querySelectorAll('[data-scene-step]')];
    buttons.forEach((button, index) => on(button, 'click', () => { select(buttons, index); controller.setState({ focus: index }); }));
  }
  if (sceneName === 'protocol-stack') {
    const buttons = [...document.querySelectorAll('[data-scene-layer]')];
    buttons.forEach((button, index) => on(button, 'click', () => { select(buttons, index); controller.setState({ focus: index }); }));
    on(document.querySelector('[data-scene-all]'), 'click', () => { buttons.forEach((button) => button.setAttribute('aria-pressed', 'false')); controller.setState({ focus: -1 }); });
  }
  return () => cleanups.forEach((cleanup) => cleanup());
}
