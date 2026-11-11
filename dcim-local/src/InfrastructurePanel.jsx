import React,{useEffect,useState} from 'react';
import {topologyImpact} from '../shared/topology.mjs';
export default function InfrastructurePanel({selection,telemetry,onAffected,onClose}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[preview,setPreview]=useState(false);
 useEffect(()=>{let alive=true;fetch('/api/topology/connections').then(r=>{if(!r.ok)throw Error('無法讀取拓樸');return r.json();}).then(d=>{if(alive)setData(d);}).catch(e=>setError(e.message));setPreview(false);return()=>{alive=false;onAffected([]);};},[selection.id]);
 const rows=(data?.rows||[]).filter(r=>!selection.zone||r.asset.rackId.split('-')[1]===selection.zone),result=topologyImpact(rows,selection.kind,selection.source||selection.id),affected=result.filter(r=>r.affected),racks=[...new Set(affected.map(r=>r.asset.rackId))];
 useEffect(()=>{onAffected(preview?racks:[]);},[preview,selection.id,data]);
 const load=racks.reduce((s,id)=>s+(telemetry?.racks?.find(r=>r.id===id)?.powerKw||0),0);
 return <aside className="infrastructure-panel"><header><strong>{selection.id}</strong><button onClick={onClose} aria-label="關閉管線資訊">×</button></header>{error?<p role="alert">{error}</p>:!data?<p>讀取設備連線…</p>:<><p>{selection.kind==='power'?'供電':'網路'} · {racks.length} 櫃／{affected.length} 台設備</p><p>關聯機櫃總功率 <b>{load.toFixed(2)} kW</b></p><small>總功率非單路實測；依已保存連線計算影響。</small><button onClick={()=>setPreview(!preview)}>{preview?'清除中斷預覽':'預覽此路中斷影響'}</button>{preview&&<p>仍有其他路徑 {affected.filter(r=>r.remaining>0).length} 台 · 無其他路徑 {affected.filter(r=>!r.remaining).length} 台</p>}<div className="infrastructure-list">{affected.map(r=><div key={r.asset.id}><b>{r.asset.rackId} · {r.asset.name}</b><small>{r.asset.id} · {r.asset.service||'未指定服務'}</small></div>)}</div>{!affected.length&&<p>尚無已配置的下游設備</p>}</>}</aside>;
}
