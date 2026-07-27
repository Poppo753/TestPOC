import { createDebugPanel } from './debug-panel.js';

/** Owns one local renderer and pauses it whenever its section is not visible. */
export class SceneController {
  constructor(THREE, host, canvas, config, quality, sceneName, factory) {
    Object.assign(this,{THREE,host,canvas,config,quality,sceneName});
    this.pointer={x:0,y:0}; this.running=false; this.visible=true; this.lastFrame=0; this.lastRender=0;
    this.scene=new THREE.Scene(); this.scene.fog=new THREE.FogExp2(0x07101f,.035);
    this.camera=new THREE.PerspectiveCamera(config.fov,1,.1,100); this.camera.position.set(...config.camera); this.baseCamera=this.camera.position.clone();
    this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:quality.level==='high',powerPreference:quality.level==='low'?'low-power':'high-performance'});
    this.renderer.setClearColor(0x07101f,0); this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,quality.dpr));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace; this.renderer.toneMapping=THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure=1.08;
    this.world=factory(THREE,this.scene,quality); this.debug=createDebugPanel(host,this.renderer,sceneName,quality);
    this.onPointer=(event)=>{const rect=host.getBoundingClientRect();this.pointer.x=((event.clientX-rect.left)/Math.max(1,rect.width))*2-1;this.pointer.y=((event.clientY-rect.top)/Math.max(1,rect.height))*2-1;};
    this.onVisibility=()=>{this.visible=!document.hidden;if(this.visible)this.start();else this.stop();};
    /* The decorative canvas intentionally ignores pointer events so it never
       blocks the UI. Listen on window instead; the previous host listener
       could never fire for the fixed, pointer-events:none ownership canvas. */
    window.addEventListener('pointermove',this.onPointer,{passive:true}); document.addEventListener('visibilitychange',this.onVisibility);
    this.resizeObserver=new ResizeObserver(()=>this.resize()); this.resizeObserver.observe(host);
    this.intersectionObserver=new IntersectionObserver(([entry])=>{this.visible=entry.isIntersecting;if(this.visible)this.start();else this.stop();},{rootMargin:'150px'}); this.intersectionObserver.observe(host);
    this.resize();
  }
  start(){if(this.running||!this.visible)return;this.running=true;if(this.quality.level==='static'){this.render(performance.now(),0);return;}this.renderer.setAnimationLoop((time)=>this.frame(time));}
  stop(){this.running=false;this.renderer.setAnimationLoop(null);}
  frame(time){if(!this.running)return;const interval=1000/Math.min(this.quality.fps,this.config.maxFps);if(time-this.lastRender<interval)return;const delta=Math.min(.05,(time-(this.lastFrame||time))/1000);this.lastFrame=time;this.lastRender=time;this.render(time,delta);}
  render(time,delta){this.world.update(time,delta,this.pointer);const motion=this.quality.reducedMotion?0:1;this.camera.position.x+=(this.baseCamera.x+this.pointer.x*.16*motion-this.camera.position.x)*.025;this.camera.position.y+=(this.baseCamera.y-this.pointer.y*.1*motion-this.camera.position.y)*.025;this.camera.lookAt(0,-.1,0);this.renderer.render(this.scene,this.camera);this.debug.update(time,this.world.getDebugState?.());}
  resize(){const rect=this.host.getBoundingClientRect();const width=Math.max(1,Math.round(rect.width));const height=Math.max(1,Math.round(rect.height));this.camera.aspect=width/height;const portraitCompensation=this.camera.aspect<1.35?Math.min(1.55,1.35/this.camera.aspect):1;this.baseCamera.set(this.config.camera[0],this.config.camera[1],this.config.camera[2]*portraitCompensation);this.camera.position.z=this.baseCamera.z;this.world.setViewport?.(this.camera.aspect);this.camera.updateProjectionMatrix();this.renderer.setSize(width,height,false);if(this.quality.level==='static')requestAnimationFrame(()=>this.render(performance.now(),0));}
  setState(patch){this.world.setState?.(patch);if(this.quality.level==='static')requestAnimationFrame(()=>this.render(performance.now(),0));}
  pulse(value=1){this.setState({pulse:value});}
  dispose(){this.stop();window.removeEventListener('pointermove',this.onPointer);document.removeEventListener('visibilitychange',this.onVisibility);this.resizeObserver.disconnect();this.intersectionObserver.disconnect();this.debug.dispose();this.world.dispose();this.renderer.dispose();this.renderer.forceContextLoss?.();}
}
