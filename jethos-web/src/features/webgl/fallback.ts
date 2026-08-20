export function activateFallback(reason: string, canvas?: HTMLCanvasElement): void {
  canvas?.remove();
  document.documentElement.dataset.webglState = 'fallback';
  document.documentElement.dataset.webglFallback = reason;
  document
    .querySelector('[data-webgl-status]')
    ?.replaceChildren(document.createTextNode('Static visual'));
}
