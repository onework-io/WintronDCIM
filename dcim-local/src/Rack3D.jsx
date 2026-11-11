import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {buildRackDetails} from './rackDetails';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
export default function Rack3D({rackId,assets,onEdit}){
 const annotationLayer=useRef(null);
 const host=useRef(null),engine=useRef(null),edit=useRef(onEdit);edit.current=onEdit;
 const [error,setError]=useState(''),[hover,setHover]=useState(''),[annotations,setAnnotations]=useState(true),[doorOpen,setDoorOpen]=useState(true),[cablesVisible,setCablesVisible]=useState(true);
 const options=useRef({doorOpen:true,cablesVisible:true});
 useEffect(()=>{
 let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch{setError('無法啟動 WebGL，請切換 2D 配置。');return;}
 setError('');const el=host.current;renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;el.appendChild(renderer.domElement);
 renderer.domElement.setAttribute('aria-label',rackId+' 可旋轉 3D 機櫃');
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.01,50),controls=new OrbitControls(camera,renderer.domElement);
 controls.enableDamping=true;controls.minDistance=1.8;controls.maxDistance=6;controls.maxPolarAngle=Math.PI*.85;controls.target.set(.1,1.08,0);
 const reset=(front=false)=>{camera.position.set(front?.1:-1.35,front?1.12:1.65,front?4.4:3.8);controls.target.set(.1,1.08,0);controls.update();};reset();engine.current={reset};
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=.65;room.dispose();pmrem.dispose();
 scene.add(new THREE.HemisphereLight(0xd7efff,0x394353,1.2));const key=new THREE.DirectionalLight(0xffffff,4);key.position.set(3,5,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-2;key.shadow.camera.right=2;key.shadow.camera.top=3;key.shadow.camera.bottom=-2;key.shadow.normalBias=.02;scene.add(key);const rim=new THREE.DirectionalLight(0x62bcff,3);rim.position.set(-3,2,-2);scene.add(rim);
 const mats=[],geos=[],textures=[],targets=[];
 const {door,cableGroup}=buildRackDetails({scene,assets,rackId,mats,geos,textures,targets});
 door.rotation.y=options.current.doorOpen?2.25:0;cableGroup.visible=options.current.cablesVisible;
 engine.current={reset,setCables:value=>{cableGroup.visible=value;}};
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null;
 const hit=e=>{const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);return ray.intersectObjects(targets)[0]?.object.userData.asset;};
 const move=e=>{const a=hit(e);setHover(a?`${a.name} · U${a.uStart}–${a.uStart+a.uSize-1} · 點擊編輯`:'');renderer.domElement.style.cursor=a?'pointer':'grab';};const start=e=>{down=[e.clientX,e.clientY];};const end=e=>{if(down&&Math.hypot(e.clientX-down[0],e.clientY-down[1])<5){const a=hit(e);if(a)edit.current(a);}down=null;};
 renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerdown',start);renderer.domElement.addEventListener('pointerup',end);
 const resize=new ResizeObserver(()=>{const w=el.clientWidth,h=el.clientHeight;if(w&&h){renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}});resize.observe(el);
 const timer=new THREE.Clock();
 const projected=new THREE.Vector3();
 function updateAnnotations(){
 const layer=annotationLayer.current;if(!layer)return;const width=el.clientWidth,height=el.clientHeight;
 const points=assets.map((a,i)=>{projected.set(.23,.19+(a.uStart-1+a.uSize/2)*.04445,.49).project(camera);return {i,x:(projected.x+1)*width/2,y:(1-projected.y)*height/2,visible:projected.z>-1&&projected.z<1};}).sort((a,b)=>a.y-b.y);
 const gap=Math.min(62,(height-20)/Math.max(1,points.length));let last=-gap;
 for(const point of points){point.top=Math.max(8,point.y-25,last+gap);last=point.top;}
 if(points.length){const over=Math.max(0,points.at(-1).top+54-height);for(const p of points)p.top-=over;}
 for(const p of points){const button=layer.querySelector(`[data-annotation="${p.i}"]`),line=layer.querySelector(`[data-line="${p.i}"]`);if(!button||!line)continue;const x=width-176;button.style.transform=`translate(${x}px,${p.top}px)`;button.style.visibility=p.visible?'visible':'hidden';line.style.visibility=p.visible?'visible':'hidden';line.setAttribute('x1',p.x);line.setAttribute('y1',p.y);line.setAttribute('x2',x);line.setAttribute('y2',p.top+25);}
 }

 renderer.setAnimationLoop(()=>{const dt=Math.min(timer.getDelta(),.05);door.rotation.y=THREE.MathUtils.damp(door.rotation.y,options.current.doorOpen?2.25:0,8,dt);controls.update();updateAnnotations();renderer.render(scene,camera);});
 return()=>{renderer.setAnimationLoop(null);resize.disconnect();controls.dispose();env.dispose();key.shadow.dispose();geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.domElement.remove();engine.current=null;};
 },[rackId,assets]);
 return <div className="rack3d"><div className="rack3d-toolbar"><button onClick={()=>engine.current?.reset(true)}>正面</button><button onClick={()=>engine.current?.reset()}>透視復位</button><button aria-pressed={doorOpen} onClick={()=>{options.current.doorOpen=!doorOpen;setDoorOpen(!doorOpen);}}>{doorOpen?'關閉櫃門':'開啟櫃門'}</button><button aria-pressed={cablesVisible} onClick={()=>{options.current.cablesVisible=!cablesVisible;engine.current?.setCables(!cablesVisible);setCablesVisible(!cablesVisible);}}>{cablesVisible?'隱藏線束':'顯示線束'}</button><button aria-pressed={annotations} onClick={()=>setAnnotations(!annotations)}>{annotations?'隱藏標註':'顯示標註'}</button><span>42U · 19″</span></div><div ref={host} className="rack3d-canvas"><div ref={annotationLayer} className="rack-annotations" style={{display:annotations?'block':'none'}}><svg aria-hidden="true">{assets.map((a,i)=><line key={a.id} data-line={i}/>)}</svg>{assets.map((a,i)=><button key={a.id} data-annotation={i} onClick={()=>onEdit(a)} title={'編輯 '+a.id}><strong>{a.name}</strong><span>{a.id} · U{a.uStart}–{a.uStart+a.uSize-1}</span></button>)}</div></div>{error&&<p role="alert">{error}</p>}<div className="rack3d-hint">{hover||'拖曳旋轉 · 滾輪縮放 · 點擊設備編輯'}</div><small>依 U 位資料生成；外觀為示意，非設備原廠模型。</small></div>;
}
