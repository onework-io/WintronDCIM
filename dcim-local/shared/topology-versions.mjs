import {physicalIssues} from './physical-ports.mjs';
import {connections,connectionIssues} from './topology.mjs';
export function captureTopology(assets,overrides,name){
 if(!String(name||'').trim()||name.length>100)throw Error('請填寫 100 字內版本名稱');
 return {id:crypto.randomUUID(),name:name.trim(),at:new Date().toISOString(),schema:1,configs:Object.fromEntries(connections(assets,overrides).map(r=>[r.asset.id,{rackId:r.asset.rackId,power:structuredClone(r.power),network:structuredClone(r.network)}]))};
}
export function previewTopology(assets,overrides,version){
 if(version?.schema!==1||!version.configs||typeof version.configs!=='object'||Array.isArray(version.configs))throw Error('版本格式無效');
 const current=connections(assets,overrides),next={},changes=[],warnings=[];
 for(const row of current){const old=version.configs[row.asset.id];next[row.asset.id]={power:row.power,network:row.network};if(!old){warnings.push(`${row.asset.id} 為版本建立後新增，保留目前連線`);continue;}
 if(old.rackId!==row.asset.rackId){warnings.push(`${row.asset.id} 已移櫃，保留目前連線`);continue;}
 for(const kind of ['power','network']){if(!Array.isArray(old[kind])||old[kind].length>(kind==='power'?24:48)||old[kind].some(l=>!l||typeof l.source!=='string'||!Number.isInteger(l.port)))throw Error('版本連線格式無效');
 for(let i=0;i<Math.max(row[kind].length,old[kind].length);i++){if(JSON.stringify(row[kind][i])!==JSON.stringify(old[kind][i]))changes.push({id:row.asset.id,name:row.asset.name,rackId:row.asset.rackId,kind,route:i+1,before:row[kind][i],after:old[kind][i]});}
 next[row.asset.id][kind]=structuredClone(old[kind]);}
 }
 for(const id of Object.keys(version.configs))if(!assets.some(a=>a.id===id))warnings.push(`${id} 已刪除，略過`);
 return {next,changes,warnings,issues:physicalIssues(connections(assets,next))};
}
