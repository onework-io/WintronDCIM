import {serviceName} from './service-impact.mjs';
export function maintenanceImpact(assets,rackIds){
 const selected=new Set(rackIds),affected=assets.filter(a=>selected.has(a.rackId));
 const services=[...new Set(affected.map(serviceName))].sort().map(name=>{const all=assets.filter(a=>serviceName(a)===name),inside=affected.filter(a=>serviceName(a)===name);return {name,total:all.length,affected:inside.length,outside:all.length-inside.length,racks:[...new Set(inside.map(a=>a.rackId))]};});
 return {assets:affected,services,racks:[...new Set(affected.map(a=>a.rackId))],powerKw:affected.reduce((n,a)=>n+(a.powerKw||0),0)};
}
export function maintenanceCsv(result,title,window={}){const cell=v=>'"'+String(v??'').replace(/^\s*[=+@-]/,"'$&").replaceAll('"','""')+'"';return '\ufeff'+[['方案','資產ID','名稱','服務','機櫃','起始U','高度U','額定功率kW','預定開始（台北）','預定結束（台北）','作業說明'],...result.assets.map(a=>[title,a.id,a.name,serviceName(a),a.rackId,a.uStart,a.uSize,a.powerKw,window.start,window.end,window.note])].map(r=>r.map(cell).join(',')).join('\r\n');}
export function compareMaintenance(assets,leftRacks,rightRacks){
 const left=maintenanceImpact(assets,leftRacks),right=maintenanceImpact(assets,rightRacks),leftIds=new Set(left.assets.map(a=>a.id)),rightIds=new Set(right.assets.map(a=>a.id));
 const rows=assets.filter(a=>leftIds.has(a.id)||rightIds.has(a.id)).map(asset=>({asset,scope:leftIds.has(asset.id)?rightIds.has(asset.id)?'both':'left':'right'}));
 const services=[...new Set([...left.services,...right.services].map(s=>s.name))].sort().map(name=>({name,left:left.services.find(s=>s.name===name)?.affected||0,right:right.services.find(s=>s.name===name)?.affected||0}));
 return {left,right,rows,services,common:rows.filter(r=>r.scope==='both').length,leftOnly:rows.filter(r=>r.scope==='left').length,rightOnly:rows.filter(r=>r.scope==='right').length};
}
export function comparisonCsv(result,leftName,rightName){const cell=v=>'"'+String(v??'').replace(/^\s*[=+@-]/,"'$&").replaceAll('"','""')+'"';return '\ufeff'+[['方案 A','方案 B','資產ID','名稱','服務','機櫃','範圍'],...result.rows.map(({asset:a,scope})=>[leftName,rightName,a.id,a.name,serviceName(a),a.rackId,{both:'共同涉及',left:'僅方案 A',right:'僅方案 B'}[scope]])].map(row=>row.map(cell).join(',')).join('\r\n');}
