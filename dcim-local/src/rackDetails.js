import * as THREE from 'three';
// Procedural detail stays separate from the asset inventory and U allocations.
export function buildRackDetails({scene,assets,rackId,mats,geos,textures,targets}){
 const base=.19,u=.04445,H=42*u;
 const material=(color,metalness=.5,roughness=.4)=>{const m=new THREE.MeshStandardMaterial({color,metalness,roughness});mats.push(m);return m;};
 const graphite=material('#22272e',.7,.38),black=material('#080d12',.25,.55),silver=material('#a4adb7',.8,.3),blue=material('#125acc',.12,.35),cyan=material('#28bbc7',.12,.35),rubber=material('#11151b',0,.8);
 const led=new THREE.MeshStandardMaterial({color:'#5fe9ac',emissive:'#25b879',emissiveIntensity:1.4});mats.push(led);
 function box(w,h,d,x,y,z,m,parent=scene){const g=new THREE.BoxGeometry(w,h,d);geos.push(g);const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 function cylinder(r,length,x,y,z,m,axis='z',parent=scene){const g=new THREE.CylinderGeometry(r,r,length,12);geos.push(g);const mesh=new THREE.Mesh(g,m);if(axis==='z')mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;}
 function label(text,x,y,z,w=.12,h=.035){const c=document.createElement('canvas');c.width=512;c.height=80;const ctx=c.getContext('2d');ctx.fillStyle='#c0d2dc';ctx.font='500 42px sans-serif';ctx.textAlign='center';ctx.fillText(text,256,55);const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;textures.push(tx);const m=new THREE.MeshBasicMaterial({map:tx,transparent:true,depthWrite:false});mats.push(m);const g=new THREE.PlaneGeometry(w,h);geos.push(g);const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);scene.add(mesh);}
 // Alpha-tested perforated metal: holes remain transparent, including at oblique angles.
 const c=document.createElement('canvas');c.width=64;c.height=64;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,64,64);ctx.fillStyle='black';for(const [x,y] of [[16,16],[48,48]]){ctx.beginPath();for(let k=0;k<6;k++){const a=k*Math.PI/3;const px=x+16*Math.cos(a),py=y+16*Math.sin(a);if(k===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.closePath();ctx.fill();}
 const meshTexture=new THREE.CanvasTexture(c);meshTexture.wrapS=meshTexture.wrapT=THREE.RepeatWrapping;meshTexture.repeat.set(12,40);textures.push(meshTexture);
 const perforated=new THREE.MeshStandardMaterial({color:'#333b42',metalness:.65,roughness:.5,alphaMap:meshTexture,alphaTest:.45,side:THREE.DoubleSide});mats.push(perforated);
 box(.76,.1,1.08,0,.13,0,graphite);box(.76,.075,1.08,0,base+H+.065,0,graphite);
 for(const x of [-.34,.34])for(const z of [-.48,.48]){box(.045,H+.08,.045,x,base+H/2,z,graphite);cylinder(.045,.045,x,.055,z,rubber);}
 const side=box(.018,H,1,.365,base+H/2,0,graphite);box(.018,H,1,-.365,base+H/2,0,graphite);box(.67,H,.02,0,base+H/2,-.5,black);
 for(const x of [-.277,.277]){box(.035,H,.026,x,base+H/2,.453,silver);for(let n=1;n<=42;n++){const y=base+(n-.5)*u;box(.012,.012,.004,x,y,.469,black);if(x<0)label(String(n),-.317,y,.49,.032,.025);}}
 label(rackId,0,base+H+.065,.546,.43,.052);
 // Empty slots are blanking panels rather than invented assets.
 for(let n=1;n<=42;n++)if(!assets.some(a=>n>=a.uStart&&n<a.uStart+a.uSize)){box(.51,u-.003,.012,0,base+(n-.5)*u,.418,black);}
 const cableGroup=new THREE.Group();scene.add(cableGroup);
 const cable=(points,m)=>{const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const g=new THREE.TubeGeometry(curve,28,.0035,6,false);geos.push(g);const mesh=new THREE.Mesh(g,m);cableGroup.add(mesh);};
 for(const a of assets){const y=base+(a.uStart-1+a.uSize/2)*u,h=a.uSize*u-.004;
 const body=box(.5,h,.86,0,y,-.015,graphite);body.userData.asset=a;targets.push(body);
 const face=box(.5,h,.018,0,y,.432,graphite);face.userData.asset=a;targets.push(face);
 for(const x of [-.243,.243]){box(.018,h,.024,x,y,.45,silver);for(const yy of [y-h/2+.012,y+h/2-.012]){cylinder(.004,.006,x,yy,.466,black);box(.005,.001,.001,x,yy,.47,silver);}}
 if(a.type==='switch'){
  for(let row=0;row<2;row++)for(let col=0;col<12;col++){const x=-.207+col*.034,yy=y+(row?-.014:.014);box(.026,.021,.009,x,yy,.449,silver);box(.021,.015,.01,x,yy,.455,black);box(.004,.002,.002,x+.009,yy+.009,.46,led);}
  for(let i=0;i<8;i++){const x=-.2+i*.034,yy=y-.014;box(.014,.014,.022,x,yy,.466,blue);const routeY=Math.max(base+.035,y-.12-i*.009);cable([[x,yy,.477],[x+.02,yy-.06,.50],[.20,routeY,.51],[.306+i*.003,routeY-.02,.48],[.306+i*.003,base+.04,.35]],i>5?cyan:blue);}
 }else{
  const rows=Math.max(1,Math.floor(a.uSize/2));const cols=a.type==='storage'?8:3;
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
   const w=.414/cols-.007,hh=(h-.025)/rows-.006,x=-.207+(col+.5)*.414/cols,yy=y-h/2+.012+(row+.5)*(h-.025)/rows;
   box(w,hh,.015,x,yy,.452,silver);box(w-.006,hh-.005,.012,x,yy,.464,black);
   box(.006,Math.max(.012,hh-.014),.01,x+w/2-.008,yy,.474,blue);box(.003,.004,.005,x-w/2+.006,yy+hh/2-.007,.474,led);
   for(let line=0;line<4;line++)box(w*.62,.0015,.003,x-.003,yy-hh*.28+line*hh*.18,.472,graphite);
  }
 }
 for(const x of [-.228,.228])box(.008,h*.5,.024,x,y,.472,black);
 label(a.id,0,y+h/2-.009,.485,.14,.014);
 // Rail ledges remain behind the equipment faces.
 for(const x of [-.252,.252])box(.018,.008,.84,x,y-h/2,-.01,silver);
 }
 for(let n=0;n<9;n++){box(.028,.018,.05,.32,base+.1+n*.2,.34,black,cableGroup);}
 const door=new THREE.Group();door.position.set(.35,base+H/2,.535);scene.add(door);
 for(const x of [0,-.68])box(.028,H+.035,.026,x,0,0,graphite,door);for(const y of [-H/2,H/2])box(.68,.03,.026,-.34,y,0,graphite,door);
 box(.626,H-.04,.003,-.34,0,0,perforated,door);box(.015,.16,.025,-.65,-.1,.022,black,door);cylinder(.009,.006,-.65,-.03,.037,silver,'z',door);
 for(const yy of [-.7,.7])cylinder(.012,.07,0,yy,0,silver,'y',door);
 door.rotation.y=2.25;
 box(1.8,.018,1.7,.12,-.008,.1,material('#172531',.15,.65));
 return {door,side,cableGroup};
}
