export function departmentMethods({list,put,transaction,audit}){return {transferDepartmentAssets(body){return transaction(()=>{
 const actor=list('users').find(u=>u.id===body.actorId&&u.enabled&&u.role==='管理員');if(!actor)throw Error('僅管理員可批次移轉');
 if(typeof body.requestId!=='string'||!/^DT-[a-f0-9-]{36}$/.test(body.requestId))throw Error('移轉識別碼無效');
 const previous=list('departmentTransfers').find(r=>r.id===body.requestId);if(previous)return previous;
 const target=body.departmentId===''?null:list('departments').find(d=>d.id===body.departmentId&&d.enabled);if(body.departmentId!==''&&!target)throw Error('目標部門不存在或已停用');
 const reason=String(body.reason||'').trim();if(!reason||reason.length>500)throw Error('請填寫 1–500 字移轉原因');
 if(!Array.isArray(body.assets)||!body.assets.length||body.assets.length>500||new Set(body.assets.map(a=>a.id)).size!==body.assets.length)throw Error('請選擇 1–500 台不同資產');
 const current=list('assets'),departments=list('departments');
 const changes=body.assets.map(a=>{const row=current.find(r=>r.id===a.id);if(!row)throw Error('資產不存在：'+a.id);if((row.departmentId||'')!==a.departmentId)throw Error('資產歸屬已變更，請重新預覽：'+a.id);if((row.departmentId||'')===body.departmentId)throw Error('資產已屬於目標部門：'+a.id);return {row,fromId:row.departmentId||'',fromName:departments.find(d=>d.id===row.departmentId)?.name||'未指定部門'};});
 const at=new Date().toISOString(),record={id:body.requestId,actorId:actor.id,actorName:actor.name,at,reason,toId:body.departmentId,toName:target?.name||'未指定部門',assets:changes.map(c=>({id:c.row.id,name:c.row.name,rackId:c.row.rackId,fromId:c.fromId,fromName:c.fromName}))};
 for(const c of changes)put.run('assets',c.row.id,JSON.stringify({...c.row,departmentId:body.departmentId}));put.run('departmentTransfers',record.id,JSON.stringify(record));audit('department.assets.transferred',record.id);return record;
 });},saveDepartment(body){return transaction(()=>{
 if(!list('users').some(u=>u.id===body.actorId&&u.enabled&&u.role==='管理員'))throw Error('僅管理員可維護部門');
 const old=body.id?list('departments').find(d=>d.id===body.id):null;if(body.id&&!old)throw Error('部門不存在');if(old&&body.revision!==old.revision)throw Error('部門已更新，請重新整理');
 const name=String(body.name||'').trim(),contact=String(body.contact||'').trim();if(!name||name.length>80||contact.length>120)throw Error('部門名稱限 1–80 字，聯絡窗口限 120 字');
 if(list('departments').some(d=>d.id!==old?.id&&d.name.toLocaleLowerCase()===name.toLocaleLowerCase()))throw Error('部門名稱重複');
 const enabled=body.enabled!==false;if(!enabled&&old&&list('assets').some(a=>a.departmentId===old.id))throw Error('仍有歸屬資產，請先移轉後再停用');
 const row={id:old?.id||'DEP-'+crypto.randomUUID().slice(0,8),name,contact,enabled,revision:(old?.revision??-1)+1,updatedAt:new Date().toISOString()};put.run('departments',row.id,JSON.stringify(row));audit('department.saved',row.id);return row;
 });}};}
