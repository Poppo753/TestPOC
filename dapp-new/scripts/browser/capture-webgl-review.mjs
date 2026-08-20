/**
 * Captures the four review frames with isolated browser profiles.
 * Usage: npm run capture:webgl -- http://127.0.0.1:4173 ./review-output
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const base=(process.argv[2]||'http://127.0.0.1:4173').replace(/\/$/,'');
const output=resolve(process.argv[3]||'artifacts/webgl-review'); mkdirSync(output,{recursive:true});
const candidates=process.platform==='win32'?['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe']:['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/microsoft-edge'];
const browser=process.env.JETHOS_BROWSER||candidates.find(existsSync);
if(!browser){console.error('No Chromium browser found. Set JETHOS_BROWSER.');process.exit(1);}
const cases=[['home','/index.html','1440,1000'],['journey','/pages/how-it-works.html','1440,1000'],['protocol','/pages/protocol.html','1440,1000'],['roadmap','/pages/roadmap.html','1440,1000']];
for(const [name,path,viewport] of cases){
  const profile=mkdtempSync(join(tmpdir(),'jethos-webgl-capture-')); const target=join(output,`${name}.png`);
  try{const result=spawnSync(browser,['--headless=new','--no-first-run','--disable-extensions','--hide-scrollbars','--use-angle=swiftshader','--enable-unsafe-swiftshader','--run-all-compositor-stages-before-draw','--virtual-time-budget=9000',`--window-size=${viewport}`,`--user-data-dir=${profile}`,`--screenshot=${target}`,`${base}${path}`],{encoding:'utf8',timeout:20000});if(result.error)throw result.error;if(!existsSync(target))throw new Error(`Capture failed: ${name}`);}
  finally{rmSync(profile,{recursive:true,force:true});}
}
console.log(`Captured ${cases.length} WebGL review frames in ${output}`);
