/** Keep the authored CSS composition visible and record a diagnostic reason. */
export function activateFallback(reason, canvas) {
  canvas?.remove();
  document.documentElement.dataset.webglState = 'fallback';
  document.documentElement.dataset.webglFallback = reason;
  document.querySelector('[data-webgl-status]')?.replaceChildren(document.createTextNode('Static visual'));
}

