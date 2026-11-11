export const serviceName=a=>String(a.service||'').trim()||'未指定服務';
export function serviceImpact(assets,alerts,{service='',zone='all',query='',onlyRisk=false}={}){
 const candidates=assets.filter(a=>(!service||serviceName(a)===service)&&(zone==='all'||a.rackId.split('-')[1]===zone)&&[a.name,a.id,a.rackId].join(' ').toLowerCase().includes(query.toLowerCase()));
 const unresolved=alerts.filter(a=>['active','acknowledged'].includes(a.state));
 const rows=candidates.map(asset=>{const direct=unresolved.filter(a=>a.assetId===asset.id),nearby=unresolved.filter(a=>!a.assetId&&a.rackId===asset.rackId);return {asset,direct,nearby};}).filter(r=>!onlyRisk||r.direct.length+r.nearby.length>0);
 const relevant=[...new Map(rows.flatMap(r=>[...r.direct,...r.nearby]).map(a=>[a.id,a])).values()];
 return {rows,alerts:relevant,racks:[...new Set(rows.map(r=>r.asset.rackId))],riskCount:rows.filter(r=>r.direct.length+r.nearby.length>0).length,powerKw:rows.reduce((n,r)=>n+(r.asset.powerKw||0),0)};
}
export function serviceImpactCsv(result){const cell=v=>'"'+String(v??'').replace(/^\s*[=+@-]/,"'$&").replaceAll('"','""')+'"';return '\ufeff'+[['資產ID','名稱','服務','機櫃','直接設備告警','同櫃待評估告警','額定功率kW'],...result.rows.map(r=>[r.asset.id,r.asset.name,serviceName(r.asset),r.asset.rackId,r.direct.map(a=>a.id).join(' / '),r.nearby.map(a=>a.id).join(' / '),r.asset.powerKw])].map(row=>row.map(cell).join(',')).join('\r\n');}
