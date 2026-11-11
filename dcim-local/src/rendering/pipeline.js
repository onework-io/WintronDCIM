import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

// Adapted from TaipeiCityHall's ThreeFloorViewer / GisSceneViewer pipeline.
// Transparent containment must not become an opaque wall in the AO depth pass.
class GlassAwareAO extends SSAOPass {
 _overrideVisibility(){super._overrideVisibility();this.scene.traverse(o=>{if(o.isMesh&&o.visible&&(Array.isArray(o.material)?o.material:[o.material]).some(m=>m.transparent)){o.visible=false;this._visibilityCache.push(o);}});}
}
const finishShader={uniforms:{tDiffuse:{value:null}},vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform sampler2D tDiffuse; varying vec2 vUv;
void main(){vec4 c=texture2D(tDiffuse,vUv);vec2 p=vUv-.5;float edge=smoothstep(.12,.65,dot(p,p));c.rgb*=1.-.16*edge;gl_FragColor=c;}`};

export function createPipeline(renderer,scene,camera){
 renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.05;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 renderer.shadowMap.autoUpdate=false;
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
 const environment=pmrem.fromScene(room,.04);room.dispose();pmrem.dispose();
 scene.environment=environment.texture;scene.environmentIntensity=.65;
 const hemi=new THREE.HemisphereLight(0xc4def6,0x222b38,.55);scene.add(hemi);
 const key=new THREE.DirectionalLight(0xfff1dc,3.2);key.position.set(-22,32,18);key.target.position.set(-12,0,5);key.castShadow=true;
 key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-42,right:42,top:34,bottom:-34,near:1,far:100});key.shadow.camera.updateProjectionMatrix();key.shadow.normalBias=.035;key.shadow.bias=-.00015;
 scene.add(key,key.target);
 const fill=new THREE.DirectionalLight(0xa6d5ff,.85);fill.position.set(12,18,-20);scene.add(fill);
 const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
 const ao=new GlassAwareAO(scene,camera,1,1,16);ao.kernelRadius=5;ao.minDistance=.001;ao.maxDistance=.045;composer.addPass(ao);
 const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.16,.35,1.5);composer.addPass(bloom);
 const finish=new ShaderPass(finishShader);composer.addPass(finish);
 // SMAA runs in linear-sRGB in this Three.js version, before OutputPass.
 // Composer resizes its edge/weight buffers with the current pixel ratio.
 const smaa=new SMAAPass();composer.addPass(smaa);
 const output=new OutputPass();composer.addPass(output);
 let quality=true,interacting=false,settle=0,width=1,height=1,lastRatio=0;
 function size(){const ratio=quality&&!interacting?Math.min(devicePixelRatio,1.65):Math.min(devicePixelRatio,1);if(ratio!==lastRatio){renderer.setPixelRatio(ratio);composer.setPixelRatio(ratio);lastRatio=ratio;}renderer.setSize(width,height);composer.setSize(width,height);}
 return {
  resize(w,h){width=w;height=h;size();},
  quality(v){quality=v;size();},
  interaction(v){interacting=v;clearTimeout(settle);if(v)size();else settle=setTimeout(size,180);},
  invalidateShadows(){renderer.shadowMap.needsUpdate=true;},
  render(){if(quality)composer.render();else renderer.render(scene,camera);},
  dispose(){clearTimeout(settle);for(const p of composer.passes)p.dispose();composer.dispose();environment.dispose();key.shadow.map?.dispose();}
 };
}

export function tuneMaterials(root){
 const seen=new Set();root.traverse(o=>{if(!o.isMesh)return;const materials=Array.isArray(o.material)?o.material:[o.material];o.castShadow=!materials.some(m=>m.transparent||m.emissiveIntensity>1);o.receiveShadow=true;
 for(const m of materials){if(seen.has(m))continue;seen.add(m);const n=m.name;
  if(n.includes('Containment | clear')){m.color.set('#91c9da');m.opacity=.13;m.depthWrite=false;m.roughness=.3;m.metalness=0;m.envMapIntensity=.3;m.side=THREE.DoubleSide;}
  else if(n.includes('Rack | graphite')){m.color.set('#202a34');m.roughness=.32;m.metalness=.6;}
  else if(n.includes('perforated')){m.roughness=.57;m.metalness=.3;}
  else if(n.includes('galvanized')){m.roughness=.26;m.metalness=.85;}
  else if(n.includes('Architecture')){m.color.set('#a7b4c1');m.roughness=.82;}
  else if(n.includes('Raised floor')){m.roughness=.52;m.metalness=.08;}
  else if(n.includes('LED | white')){m.emissiveIntensity=2.8;}
  else if(n.includes('Status | green')){m.emissiveIntensity=1.5;}
  else if(n.includes('Cold aisle')){m.roughness=.65;m.metalness=.04;}
  else if(n.includes('Power B')){m.roughness=.48;m.metalness=.2;}
 }
 });
}
