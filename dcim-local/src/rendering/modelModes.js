import * as THREE from 'three';
// Room extents from build_4f.py; Blender XY becomes glTF X/-Z.
const rooms=[{minX:-4,maxX:8.5,minZ:-8.9,maxZ:-1.5},{minX:-29,maxX:-8.5,minZ:.7,maxZ:10}];
export function createModelModes(root,scene){
 root.updateMatrixWorld(true);const entries=[],copies=[];
 root.traverse(o=>{if(!o.isMesh)return;const b=new THREE.Box3().setFromObject(o),c=b.getCenter(new THREE.Vector3());const wall=o.name.startsWith('Wall');
 const exterior=wall&&(Math.abs(c.x+40)<.2||Math.abs(c.x-18.4)<.2||Math.abs(c.z+8.9)<.2||Math.abs(c.z-10)<.2||(c.z>10&&(Math.abs(c.x)<.2||Math.abs(c.x-11)<.2||Math.abs(c.z-33)<.2)));
 const inRoom=rooms.some(r=>b.min.x>=r.minX-.45&&b.max.x<=r.maxX+.45&&b.min.z>=r.minZ-.45&&b.max.z<=r.maxZ+.45);
 const original=o.material;let faded=null;if(exterior){const clone=m=>{const n=m.clone();n.transparent=true;n.opacity=.16;n.depthWrite=false;copies.push(n);return n;};faded=Array.isArray(original)?original.map(clone):clone(original);}
 entries.push({o,original,faded,visible:o.visible,shadow:o.castShadow,room:inRoom&&!wall});
 });
 const floors=new THREE.Group();floors.name='Isolated room floors';floors.visible=false;scene.add(floors);const floorMaterial=new THREE.MeshStandardMaterial({color:'#b6c1c8',roughness:.72,metalness:.05});
 for(const r of rooms){const mesh=new THREE.Mesh(new THREE.BoxGeometry(r.maxX-r.minX,.25,r.maxZ-r.minZ),floorMaterial);mesh.position.set((r.minX+r.maxX)/2,-.15,(r.minZ+r.maxZ)/2);mesh.receiveShadow=true;floors.add(mesh);}
 return {apply(mode){for(const e of entries){e.o.visible=e.visible&&(mode!=='rooms'||e.room);e.o.material=mode==='transparent'&&e.faded?e.faded:e.original;e.o.castShadow=mode==='transparent'&&e.faded?false:e.shadow;}floors.visible=mode==='rooms';},dispose(){for(const e of entries){e.o.material=e.original;e.o.visible=e.visible;e.o.castShadow=e.shadow;}copies.forEach(m=>m.dispose());floors.children.forEach(o=>o.geometry.dispose());floorMaterial.dispose();scene.remove(floors);}};
}
