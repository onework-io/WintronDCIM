import {physicalIssues} from './physical-ports.mjs';
import {connectionIssues} from './topology.mjs';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
export function parseTopologyBackup(text){
 if(new TextEncoder().encode(text).length>2_000_000)throw Error('備份不可超過 2 MB');
 let raw;try{raw=JSON.parse(text);}catch{throw Error('無法讀取 JSON 備份');}
 const rows=Array.isArray(raw)?raw:raw?.format==='aidc-topology-versions'&&raw.schema===1?raw.versions:null;
 if(!Array.isArray(rows)||!rows.length||rows.length>100)throw Error('備份須包含 1–100 個版本');
 return rows.map((v,index)=>{
  if(!object(v)||v.schema!==1||typeof v.name!=='string'||!v.name.trim()||v.name.length>100||typeof v.at!=='string'||!Number.isFinite(Date.parse(v.at))||!object(v.configs))throw Error(`第 ${index+1} 個版本格式無效`);
  const entries=Object.entries(v.configs);if(entries.length>2000)throw Error('版本資產數量過多');
  const configs=Object.fromEntries(entries.map(([id,c])=>{
   if(!id||id.length>100||['__proto__','constructor','prototype'].includes(id)||!object(c)||!/^4F-(A-(0[1-9]|1[01])|B-(0[1-9]|1[0-9]|2[0-2]))$/.test(c.rackId))throw Error('資產或機櫃格式無效');
   const normalized={rackId:c.rackId};for(const kind of ['power','network']){
    if(!Array.isArray(c[kind])||c[kind].length>(kind==='power'?24:48))throw Error('連線須包含兩組路徑');
    normalized[kind]=c[kind].map(l=>{if(!object(l)||typeof l.source!=='string'||!Number.isInteger(l.port)||(!l.source&&l.port!==0))throw Error('連線格式無效');return {source:l.source,port:l.port};});
   }return [id,normalized];
  }));
  const issues=physicalIssues(Object.entries(configs).map(([id,c])=>({asset:{id,rackId:c.rackId},...c})));if(issues.length)throw Error(`「${v.name}」：${issues[0]}`);
  return {schema:1,name:v.name.trim(),at:new Date(v.at).toISOString(),configs};
 });
}
export function importTopologyVersions(existing,parsed){
 if(!parsed.length)throw Error('請選擇至少一個版本');
 if(existing.filter(v=>!v.archived).length+parsed.length>30)throw Error('使用中版本將超過 30 個，請先封存舊版本');
 if(existing.length+parsed.length>100)throw Error('本機版本總數將超過 100 個');
 return [...parsed.map(v=>({...structuredClone(v),id:crypto.randomUUID(),importedAt:new Date().toISOString()})),...existing];
}
