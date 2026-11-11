import React from 'react';
import {Server,Network,HardDrive,Shield,Zap,Box} from 'lucide-react';
const kinds={server:['伺服器',Server],switch:['交換器',Network],storage:['儲存設備',HardDrive],firewall:['防火牆',Shield],ups:['UPS',Zap],pdu:['PDU',Zap]};
export default function RackHoverCard({hover,assets,telemetry}){
 const rows=assets.filter(a=>a.rackId===hover.id).sort((a,b)=>b.uStart-a.uStart),rack=telemetry?.racks?.find(r=>r.id===hover.id);
 return <aside className="rack-hover-card" role="tooltip" aria-label={`${hover.id} 機櫃設備`} style={{left:hover.x,top:hover.y}}>
 <header><Server size={19}/><div><strong>{hover.id}</strong><small>{rows.length} 台設備 · 42U 機櫃</small></div><span>{rack?.temperature!=null?`${rack.temperature} °C`:'—'}</span></header>
 <div className="rack-hover-columns"><span>設備／類型</span><span>U 位 · 額定功率</span></div>
 <div className="rack-hover-assets">{rows.slice(0,6).map(a=>{const [name,Icon]=kinds[a.type]||[a.type||'設備',Box];return <div key={a.id} className="rack-hover-asset"><Icon size={17}/><div><b>{a.name}</b><small>{name} · {a.id}</small></div><div><b>U{a.uStart}–{a.uStart+a.uSize-1}</b><small>{Number.isFinite(a.powerKw)?`${a.powerKw.toFixed(2)} kW`:'—'}</small></div></div>;})}</div>
 {!rows.length&&<p>此機櫃尚未登錄資產</p>}
 <footer>{rows.length>6?`另有 ${rows.length-6} 台設備 · `:''}點擊機櫃查看完整配置</footer>
 </aside>;
}
