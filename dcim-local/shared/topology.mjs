export const topologyKinds={power:'供電拓樸',network:'網路拓樸'};
export function endpoints(rackId,kind){return ['A','B'].map(route=>({id:`${kind==='power'?'PDU':'TOR'}-${rackId}-${route}`,name:`${kind==='power'?'PDU':'ToR'} ${route} 路`,upstream:`${kind==='power'?'UPS':'CORE'}-${route}`,rackId,route,limit:kind==='power'?24:48}));}
export function connections(assets,overrides={}){
 const ordered=[...assets].sort((a,b)=>a.id.localeCompare(b.id));
 return ordered.map(a=>{const index=ordered.filter(x=>x.rackId===a.rackId).findIndex(x=>x.id===a.id);const fallback=Object.fromEntries(['power','network'].map(kind=>[kind,endpoints(a.rackId,kind).map(e=>({source:e.id,port:index+1}))]));return {asset:a,...(overrides[a.id]||a.physicalConnections||fallback)};});
}
export function connectionIssues(rows){
 const issues=[],used=new Map();
 for(const row of rows)for(const kind of ['power','network']){
 const links=row[kind];if(!Array.isArray(links)||links.length!==2){issues.push(`${row.asset.id} ${kind} 連線格式錯誤`);continue;}
 const sources=new Set();
 for(const link of links){if(!link?.source)continue;const endpoint=endpoints(row.asset.rackId,kind).find(e=>e.id===link.source);
 if(!endpoint||!Number.isInteger(link.port)||link.port<1||link.port>endpoint.limit){issues.push(`${row.asset.id} ${link.source} 埠位或機櫃不符`);continue;}
 if(sources.has(link.source))issues.push(`${row.asset.id} 重複使用同一來源 ${link.source}`);sources.add(link.source);
 const key=`${kind}:${link.source}:${link.port}`;if(used.has(key))issues.push(`${link.source} 埠 ${link.port} 由 ${used.get(key)} 與 ${row.asset.id} 重複占用`);else used.set(key,row.asset.id);
 }}return issues;
}
export function saveConnections(assets,overrides,assetId,input){
 if(!assets.some(a=>a.id===assetId))throw Error('資產已不存在');
 const config={};for(const kind of ['power','network']){if(!Array.isArray(input[kind])||input[kind].length!==2)throw Error('請提供兩組路徑');config[kind]=input[kind].map(l=>({source:typeof l?.source==='string'?l.source:'',port:l?.source?Number(l.port):0}));}
 const snapshot=Object.fromEntries(connections(assets,overrides).map(r=>[r.asset.id,{power:r.power,network:r.network}]));const next={...overrides,...snapshot,[assetId]:config};const issues=connectionIssues(connections(assets,next));if(issues.length)throw Error(issues[0]);return next;
}
export function topologyImpact(rows,kind,unavailable){return rows.map(row=>{const links=Array.isArray(row[kind])?row[kind].filter(l=>l?.source):[];const valid=endpoints(row.asset.rackId,kind);let affected=0,remaining=0;for(const link of links){const e=valid.find(e=>e.id===link.source);if(!e)continue;if(e.id===unavailable||e.upstream===unavailable)affected++;else remaining++;}return {asset:row.asset,links,affected,remaining,status:!links.length?'unmapped':!affected?'unaffected':remaining?'partial':'lost'};});}
export function topologyCsv(rows){const cell=v=>'"'+String(v??'').replace(/^\s*[=+@-]/,"'$&").replaceAll('"','""')+'"';return '\ufeff'+[['資產ID','名稱','機櫃','服務','系統','路徑','來源','埠位'],...rows.flatMap(r=>['power','network'].flatMap(k=>(r[k]||[]).map((l,i)=>[r.asset.id,r.asset.name,r.asset.rackId,r.asset.service,topologyKinds[k],i+1,l.source||'未配置',l.source?l.port:''])))].map(r=>r.map(cell).join(',')).join('\r\n');}
