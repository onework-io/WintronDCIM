import React,{useMemo,useState} from 'react';
const clock=t=>new Intl.DateTimeFormat('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false}).format(t);
const stamp=t=>new Intl.DateTimeFormat('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(t);
const domains={temperature:[18,32],humidity:[30,70],co2:[300,1100],pm25:[0,40]};
function reading(key,zone,t){const n=t/300000,noise=(Math.sin(n*12.9898+(zone==='A'?2:9))*43758.5453)%1;const base={temperature:zone==='A'?22.4:24.1,humidity:zone==='A'?44:47,co2:zone==='A'?580:640,pm25:zone==='A'?9:13}[key],amp={temperature:1.2,humidity:3,co2:65,pm25:3}[key];return +(base+amp*(Math.sin(n/17)*.6+Math.sin(n/4)*.2+noise*.35)).toFixed(1);}
export default function EnvironmentTrend({metric,zone,hours,timestamp}){
 const [paused,setPaused]=useState(null),[cursor,setCursor]=useState(null),[thresholds,setThresholds]=useState(true),[visible,setVisible]=useState({A:true,B:true});
 const end=Math.floor((paused??new Date(timestamp).getTime())/300000)*300000;
 const rows=useMemo(()=>Array.from({length:hours*12+1},(_,i)=>{const t=end-hours*3600000+i*300000;return {t,A:reading(metric.key,'A',t),B:reading(metric.key,'B',t)};}),[end,hours,metric.key]);
 const zones=(zone==='all'?['A','B']:[zone]).filter(z=>visible[z]);const [min,max]=domains[metric.key],x=i=>58+i*884/(rows.length-1),y=v=>230-(v-min)/(max-min)*190;
 const index=cursor===null?rows.length-1:Math.min(cursor,rows.length-1),row=rows[index],all=rows.flatMap(r=>zones.map(z=>r[z]));
 function download(){const csv=['timestamp,zone,metric,value,unit,source',...rows.flatMap(r=>zones.map(z=>[new Date(r.t).toISOString(),z,metric.key,r[z],metric.unit,'simulation'].join(',')))].join('\r\n');const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`environment-${metric.key}-${hours}h.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <article className="panel env-trend"><header><div><span className="env-trend-eyebrow">HISTORICAL TREND / 歷史趨勢</span><h3>{metric.name}趨勢 <small>{metric.unit}</small></h3></div><div className="env-trend-actions"><label><input type="checkbox" checked={thresholds} onChange={e=>setThresholds(e.target.checked)}/>門檻線</label><button onClick={()=>setPaused(paused===null?end:null)}>{paused===null?'暫停更新':'恢復更新'}</button><button disabled={!zones.length} onClick={download}>匯出 CSV</button></div></header>
 <div className="env-trend-meta"><span>{stamp(rows[0].t)} — {stamp(end)} · 每 5 分鐘 · {rows.length} 筆／區</span><b>{paused===null?'● 自動更新':'Ⅱ 已暫停'}</b></div>
 <div className="env-chart-legend">{(zone==='all'?['A','B']:[zone]).map(z=><button key={z} aria-pressed={visible[z]} onClick={()=>setVisible(v=>({...v,[z]:!v[z]}))} className={visible[z]?'':'muted'}><i style={{background:z==='A'?'#5bdfdc':'#a59bff'}}/>Zone {z} {visible[z]?'顯示':'隱藏'}</button>)}<span>滑動讀值 · 可用下方滑桿精確選取時間</span></div>
 <svg className="env-interactive-chart" viewBox="0 0 980 268" role="img" aria-label={`${metric.name}互動趨勢圖`} onPointerMove={e=>{const b=e.currentTarget.getBoundingClientRect(),px=(e.clientX-b.left)/b.width*980;setCursor(Math.max(0,Math.min(rows.length-1,Math.round((px-58)/884*(rows.length-1)))));}}>
 {Array.from({length:5},(_,i)=>{const v=min+(max-min)*i/4;return <g key={i}><line x1="58" x2="942" y1={y(v)} y2={y(v)} stroke="#263c4b" strokeDasharray="3 5"/><text x="45" y={y(v)+4} textAnchor="end">{v}</text></g>;})}
 {Array.from({length:7},(_,i)=>{const n=Math.round(i*(rows.length-1)/6);return <text key={i} x={x(n)} y="254" textAnchor="middle">{clock(rows[n].t)}</text>;})}
 {thresholds&&[metric.min,metric.max].filter(v=>v>=min&&v<=max).map(v=><g key={v}><line x1="58" x2="942" y1={y(v)} y2={y(v)} stroke="#eeb25e" strokeDasharray="7 5"/><text x="940" y={y(v)-6} textAnchor="end" fill="#eeb25e">設定門檻 {v}</text></g>)}
 {zones.map(z=><polyline key={z} points={rows.map((r,i)=>`${x(i)},${y(r[z])}`).join(' ')} stroke={z==='A'?'#5bdfdc':'#a59bff'} fill="none" strokeWidth="2"/>)}
 {!!zones.length&&<><line x1={x(index)} x2={x(index)} y1="35" y2="230" stroke="#a2bdcf" strokeDasharray="3 3"/>{zones.map(z=><circle key={z} cx={x(index)} cy={y(row[z])} r="4" fill={z==='A'?'#5bdfdc':'#a59bff'} stroke="#101c26" strokeWidth="2"/>)}</>}
 {!zones.length&&<text x="490" y="135" textAnchor="middle">請啟用至少一個區域圖例</text>}</svg>
 <div className="env-crosshair"><time>{stamp(row.t)}</time>{zones.map(z=><span key={z}>Zone {z} <b>{row[z].toFixed(1)} {metric.unit}</b></span>)}</div>
 <label className="env-time-slider">選取時間<input aria-label="趨勢讀值時間" type="range" min="0" max={rows.length-1} value={index} onChange={e=>setCursor(Number(e.target.value))}/><button onClick={()=>setCursor(null)}>最新</button></label>
 <div className="env-chart-stats">{[['最低',all.length?Math.min(...all):null],['平均',all.length?all.reduce((a,b)=>a+b,0)/all.length:null],['最高',all.length?Math.max(...all):null],['超標筆數',all.length?all.filter(v=>v<metric.min||v>metric.max).length:null]].map(([label,value])=><div key={label}><span>{label}</span><b>{value===null?'—':label==='超標筆數'?value:value.toFixed(1)} <small>{label==='超標筆數'?'筆':metric.unit}</small></b></div>)}</div>
 <p className="env-note">統計及匯出依目前顯示的區域計算。</p></article>;
}
