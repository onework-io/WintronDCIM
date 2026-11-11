import * as THREE from 'three';
import {heatScales} from '../../shared/energy.mjs';
// Measured rack positions from the GLB, not hardcoded screen-space hotspots.
// The field is illustrative interpolation of simulated rack readings, not CFD.
export function createHeatmap(scene,racks){
 const points=[...racks].map(([id,object])=>{const box=new THREE.Box3().setFromObject(object);return {id,zone:object.userData.Zone,center:box.getCenter(new THREE.Vector3())};});
 const group=new THREE.Group();group.name='Simulated rack heatmap';group.visible=false;scene.add(group);
 const materials=[];
 for(const zone of ['A','B']){
  const items=points.filter(p=>p.zone===zone),bounds=new THREE.Box3().setFromPoints(items.map(p=>p.center));bounds.expandByVector(new THREE.Vector3(1.4,0,2));const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const uniforms={samples:{value:Array.from({length:33},()=>new THREE.Vector4())},count:{value:items.length},low:{value:20},high:{value:32},opacity:{value:.7},blue:{value:new THREE.Color('#2389ff')},green:{value:new THREE.Color('#30d8a1')},yellow:{value:new THREE.Color('#ffd34e')},red:{value:new THREE.Color('#fc4545')}};
  const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,vertexShader:`varying vec2 worldXZ;void main(){vec4 w=modelMatrix*vec4(position,1.);worldXZ=w.xz;gl_Position=projectionMatrix*viewMatrix*w;}`,fragmentShader:`varying vec2 worldXZ;uniform vec4 samples[33];uniform int count;uniform float low,high,opacity;uniform vec3 blue,green,yellow,red;
void main(){float total=0.;float weighted=0.;float mask=0.;for(int i=0;i<33;i++){if(i>=count)break;if(samples[i].w<.5)continue;vec2 d=(worldXZ-samples[i].xy)/vec2(.26,1.5);float w=exp(-dot(d,d)*.75);weighted+=w*samples[i].z;total+=w;mask=max(mask,w);}if(total<.0001||mask<.015)discard;float t=clamp((weighted/total-low)/(high-low),0.,1.);vec3 color=t<.333?mix(blue,green,t*3.):t<.667?mix(green,yellow,(t-.333)*3.):mix(yellow,red,(t-.667)*3.);gl_FragColor=vec4(color,smoothstep(.015,.45,mask)*opacity);}`});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(size.x,size.z),material);mesh.rotation.x=-Math.PI/2;mesh.position.set(center.x,3.55,center.z);mesh.renderOrder=12;mesh.userData.zone=zone;group.add(mesh);materials.push({material,items,mesh});
 }
 return {update(mode,telemetry,opacity,zone){group.visible=mode!=='off';if(mode==='off')return;const scale=heatScales[mode];for(const {material,items,mesh} of materials){mesh.visible=zone==='all'||zone===mesh.userData.zone;material.uniforms.low.value=scale.min;material.uniforms.high.value=scale.max;material.uniforms.opacity.value=opacity;items.forEach((p,i)=>{const row=telemetry?.racks?.find(r=>r.id===p.id),value=mode==='temperature'?row?.temperature:row?.powerKw;material.uniforms.samples.value[i].set(p.center.x,p.center.z,Number.isFinite(value)?value:0,Number.isFinite(value)?1:0);});}},dispose(){group.removeFromParent();group.children.forEach(m=>{m.geometry.dispose();m.material.dispose();});}};
}
