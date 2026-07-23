export function createDebugPanel(host, renderer, sceneName, quality) {
  if (new URLSearchParams(location.search).get('webglDebug') !== '1') return { update() {}, dispose() {} };
  const panel=document.createElement('output'); panel.className='webgl-debug'; panel.setAttribute('aria-label','WebGL diagnostics'); host.append(panel);
  let frames=0,last=performance.now(),fps=0;
  return {
    update(time){frames+=1;if(time-last>500){fps=Math.round(frames*1000/(time-last));frames=0;last=time;const info=renderer.info.render;panel.textContent=`scene ${sceneName}\nquality ${quality.level} · ${fps} fps\ndraw ${info.calls} · triangles ${info.triangles}`;}},
    dispose(){panel.remove();},
  };
}

