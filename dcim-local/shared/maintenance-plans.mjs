import {validateWindow} from './maintenance-window.mjs';
export function saveMaintenancePlan(plans,input,{id='',newId,at=new Date().toISOString()}={}){
 const name=String(input.name||'').trim();if(!name||name.length>100||!Array.isArray(input.racks)||!input.racks.length)throw Error('請填寫 100 字內方案名稱並選擇至少一座機櫃');
 const old=id?plans.find(p=>p.id===id):null;if(id&&!old)throw Error('方案已不存在，請另存新方案');
 if(!id&&plans.length>=20)throw Error('已達 20 個方案，請先刪除不需要的方案');
 if(!id&&(!newId||plans.some(p=>p.id===newId)))throw Error('方案識別碼無效');
 const row={id:id||newId,name,racks:[...new Set(input.racks)],window:validateWindow(input.window),at:old?.at||at,updatedAt:at};
 return {row,plans:old?plans.map(p=>p.id===id?row:p):[row,...plans]};
}
