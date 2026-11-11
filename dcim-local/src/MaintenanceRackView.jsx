import React,{useState} from 'react';
import Scene from './Scene';
export default function MaintenanceRackView({selected,onRemove}){
 const [zone,setZone]=useState('all');
 return <section className="maintenance-3d"><div className="ops-heading"><div><h3>4F 維護範圍 · 整體空間</h3><p>已選 {selected.length} 櫃，以金色標示。點選空間中的機櫃可加入或移出維護範圍。</p></div></div><div className="maintenance-spatial-scene"><Scene selected={null} onSelect={onRemove} zone={zone} onZone={setZone} maintenanceRacks={selected}/></div><div className="maintenance-selected-list">{selected.map(id=><button key={id} onClick={()=>onRemove(id)} aria-label={`移出 ${id}`}>{id} ×</button>)}</div>{!selected.length&&<p>尚未選取機櫃，可直接點選 3D 機櫃或切回 2D 選取。</p>}</section>;
}
