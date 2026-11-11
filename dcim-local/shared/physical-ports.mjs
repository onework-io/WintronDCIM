import {connections,endpoints} from './topology.mjs';
export const portType=(kind,port)=>kind==='power'?(port<=20?'C13':'C19'):(port<=40?'RJ45':'SFP');
export function physicalRows(assets,config={}){return connections(assets,config).map(r=>({...r,...(config[r.asset.id]||r.asset.physicalConnections||{})}));}
export function validatePhysical(rows){const used=new Set();for(const r of rows)for(const k of ['power','network']){if(!Array.isArray(r[k])||r[k].length>(k==='power'?24:48))throw Error('連線格式無效');for(const l of r[k]){if(!l||typeof l.source!=='string')throw Error('連線格式無效');if(!l.source)continue;const e=endpoints(r.asset.rackId,k).find(e=>e.id===l.source);if(!e||!Number.isInteger(l.port)||l.port<1||l.port>e.limit)throw Error('來源或埠號不符');const key=l.source+':'+l.port;if(used.has(key))throw Error('插座／埠重複占用：'+key);used.add(key);}}return used;}
export function allocatePorts(placements,assets,config={},holds=[],exclude=''){
 const rows=physicalRows(assets,config),held=holds.filter(h=>h.state==='active'&&h.workOrderId!==exclude).flatMap(h=>h.placements.filter(p=>p.physicalConnections).map(p=>({asset:p,...p.physicalConnections})));const used=validatePhysical([...rows,...held]);
 return placements.map(p=>{const result={};for(const kind of ['power','network']){const count=p[kind==='power'?'outlets':'ports']??2,type=p[kind==='power'?'outletType':'networkType']||(kind==='power'?'C13':'RJ45');result[kind]=[];const sources=endpoints(p.rackId,kind);for(let i=0;i<count;i++){const ordered=[sources[i%2],sources[(i+1)%2]];let found;for(const source of ordered){for(let port=1;port<=source.limit;port++)if(portType(kind,port)===type&&!used.has(source.id+':'+port)){found={source:source.id,port};break;}if(found)break;}if(!found)throw Error(`${p.rackId} 沒有可用 ${type} 實體埠`);used.add(found.source+':'+found.port);result[kind].push(found);}}
 if(p.powerRedundancy==='dual'&&new Set(result.power.map(l=>l.source)).size<2)throw Error('雙路供電至少需要兩個不同來源插座');return {...p,physicalConnections:result};});
}
export function assertPorts(assets,config,holds,exclude=''){return validatePhysical([...physicalRows(assets,config),...holds.filter(h=>h.state==='active'&&h.workOrderId!==exclude).flatMap(h=>h.placements.filter(p=>p.physicalConnections).map(p=>({asset:p,...p.physicalConnections})))]);}

export function physicalIssues(rows){try{validatePhysical(rows);return [];}catch(e){return [e.message];}}
