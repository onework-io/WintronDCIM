import {createHash,randomUUID} from 'node:crypto';
import {validateWindow,windowConflicts} from '../shared/maintenance-window.mjs';
import {maintenanceImpact} from '../shared/maintenance-impact.mjs';
export function maintenanceWorkMethods({list,put,transaction,audit}){return {createMaintenanceWork(input){return transaction(()=>{
 const p=input.plan;if(!p||typeof p.name!=='string'||!p.name.trim()||p.name.length>100||!Array.isArray(p.racks)||!p.racks.length||p.racks.length>33||p.racks.some(r=>typeof r!=='string'||!/^4F-(A-(0[1-9]|1[01])|B-(0[1-9]|1[0-9]|2[0-2]))$/.test(r)))throw Error('請填寫方案名稱並選取有效的 4F 機櫃');
 const window=validateWindow(p.window);if(!window.start||!window.note)throw Error('請填寫完整維護時段與作業說明');
 const racks=[...new Set(p.racks)].sort(),users=list('users'),owner=users.find(u=>u.id===input.assigneeId&&u.enabled&&u.role!=='唯讀'),reviewer=users.find(u=>u.id===input.reviewerId&&u.enabled&&u.role==='管理員');if(!owner||!reviewer||owner.id===reviewer.id)throw Error('請選擇不同的有效受派人與管理員驗收人');
 const fingerprint=createHash('sha256').update(JSON.stringify({racks,window})).digest('hex');const existing=list('workorders').find(w=>w.maintenanceFingerprint===fingerprint);if(existing)return existing;
 const conflicts=windowConflicts(window,racks,list('workorders').filter(w=>w.sourceType==='maintenance'&&w.state!=='closed').map(w=>({id:w.id,racks:w.rackIds,window:w.maintenancePlan.window})));if(conflicts.length)throw Error('同櫃維護時段與工單重疊：'+conflicts.map(w=>w.id).join('、'));
 const impact=maintenanceImpact(list('assets'),racks),at=new Date().toISOString(),plan={name:p.name.trim(),racks,window,assets:impact.assets,services:impact.services,powerKw:impact.powerKw,capturedAt:at};
 const row={id:'WO-'+randomUUID().slice(0,8),sourceType:'maintenance',maintenanceApproval:{state:'pending'},maintenanceFingerprint:fingerprint,maintenancePlan:plan,rackId:racks[0],rackIds:racks,floor:'4F',area:[...new Set(racks.map(r=>r.split('-')[1]))].join('/'),title:'維護計畫：'+plan.name,device:racks.length+' 座機櫃',system:'計畫維護',description:`維護範圍：${racks.join('、')}\n台北時間：${window.start} — ${window.end}\n涉及資產：${impact.assets.length} 台／服務：${impact.services.length} 項\n${window.note}`,priority:'info',reporter:'維護規劃',vendor:'',due:window.end.slice(0,10),assigneeId:owner.id,reviewerId:reviewer.id,state:'assigned',revision:0,createdAt:at,updatedAt:at,resolution:'',logs:[{at,actor:'維護規劃',action:'create',note:'已保存維護範圍、時段與建單時資產快照。'}]};put.run('workorders',row.id,JSON.stringify(row));audit('maintenance.workorder.created',row.id);return row;
 });}};}

export function rescheduleMaintenance(old,body,users,works){
 if(body.revision!==old.revision)throw Error('工單已更新，請重新載入');
 const actor=users.find(u=>u.id===body.actorId&&u.enabled&&u.role==='管理員');
 if(!actor||old.sourceType!=='maintenance'||old.state!=='assigned'||old.logs.some(l=>l.action==='start'))throw Error('僅管理員可變更尚未開始的維護時段');
 const reason=String(body.note||'').trim();if(!reason||reason.length>2000)throw Error('請填寫 2000 字內變更原因');
 const previous=old.maintenancePlan.window,window=validateWindow({start:body.start,end:body.end,note:previous.note});
 if(!window.start)throw Error('請填寫完整維護時段');
 if(previous.start===window.start&&previous.end===window.end)throw Error('維護時段未變更');
 const conflicts=windowConflicts(window,old.rackIds,works.filter(w=>w.id!==old.id&&w.sourceType==='maintenance'&&w.state!=='closed').map(w=>({id:w.id,racks:w.rackIds,window:w.maintenancePlan.window})));
 if(conflicts.length)throw Error('同櫃維護時段與工單重疊：'+conflicts.map(w=>w.id).join('、'));
 const row=structuredClone(old),at=new Date().toISOString();row.originalMaintenanceWindow??=structuredClone(previous);
 row.maintenancePlan.window=window;row.maintenanceApproval={state:'pending',note:'維護時段已變更，須重新核准'};
 row.maintenanceFingerprint=createHash('sha256').update(JSON.stringify({racks:[...old.rackIds].sort(),window})).digest('hex');
 row.due=window.end.slice(0,10);row.description=`維護範圍：${old.rackIds.join('、')}\n台北時間：${window.start} — ${window.end}\n涉及資產：${row.maintenancePlan.assets.length} 台／服務：${row.maintenancePlan.services.length} 項\n${window.note}`;
 row.revision++;row.updatedAt=at;row.logs.push({at,actor:actor.name,action:'maintenanceReschedule',note:`時段：${previous.start} — ${previous.end} → ${window.start} — ${window.end}（台北時間）。完成期限同步為 ${row.due}。${reason}`});return row;
}
