import {validateWindow,windowConflicts} from './maintenance-window.mjs';
export function exportPlans(plans){return JSON.stringify({format:'aidc-maintenance',version:1,exportedAt:new Date().toISOString(),plans},null,2);}
export function previewPlans(text,current,validRacks){
 if(text.length>200000)throw Error('備份檔案超過 200 KB');
 let data;try{data=JSON.parse(text);}catch{throw Error('無法讀取 JSON 備份檔');}
 if(data?.format!=='aidc-maintenance'||data.version!==1||!Array.isArray(data.plans)||!data.plans.length||data.plans.length>20)throw Error('備份格式或版本不正確，需包含 1–20 個方案');
 if(current.length+data.plans.length>20)throw Error('匯入後將超過 20 個方案，請先整理既有方案');
 const rows=data.plans.map((p,i)=>{
 if(!p||typeof p.name!=='string'||!p.name.trim()||p.name.trim().length>100||!Array.isArray(p.racks)||!p.racks.length||p.racks.some(r=>typeof r!=='string'||!validRacks.includes(r)))throw Error(`第 ${i+1} 個方案名稱或機櫃無效；僅接受目前 4F A／B 區機櫃`);
 if(p.window!==undefined&&(!p.window||typeof p.window!=='object'||Array.isArray(p.window)))throw Error(`第 ${i+1} 個方案時段格式無效`);
 return {name:p.name.trim(),racks:[...new Set(p.racks)],window:validateWindow(p.window)};
 });
 return rows.map((p,i)=>({...p,conflicts:windowConflicts(p.window,p.racks,[...current,...rows.filter((_,j)=>j!==i)]).map(x=>x.name)}));
}
export function importPlans(text,current,validRacks,{id=()=>crypto.randomUUID(),at=new Date().toISOString()}={}){
 const rows=previewPlans(text,current,validRacks),ids=new Set(current.map(p=>p.id));
 const added=rows.map(({conflicts,...p})=>{const next=id();if(!next||ids.has(next))throw Error('方案識別碼重複，請重新匯入');ids.add(next);return {...p,id:next,at,updatedAt:at};});
 return [...added,...current];
}
