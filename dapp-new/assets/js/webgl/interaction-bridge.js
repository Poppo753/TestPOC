/** HTML remains the complete control surface; this bridge only mirrors state. */
export function bindSceneInteractions(controller, sceneName) {
  const cleanups = [];
  const on = (target, type, handler) => { target?.addEventListener(type, handler); cleanups.push(() => target?.removeEventListener(type, handler)); };
  const select = (buttons, current) => buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === current)));
  if (sceneName === 'ownership') {
    const replay = document.querySelector('[data-scene-replay]');
    on(replay, 'click', () => { controller.setState({ replay: Date.now() }); controller.pulse(1); });
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

