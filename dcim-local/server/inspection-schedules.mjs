import {validateDue} from '../shared/workorders.mjs';
import {taipeiDate} from '../shared/inspection-reports.mjs';
const addDays=(date,n)=>new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export function scheduleMethods({list,put,transaction,audit,create}){
 const save=r=>{put.run('inspectionSchedules',r.id,JSON.stringify(r));return r;};
 return {
 saveInspectionSchedule(body){return transaction(()=>{
 if(!list('users').some(u=>u.id===body.actorId&&u.enabled&&u.role==='管理員'))throw Error('僅管理員可維護排程');
 const old=body.id?list('inspectionSchedules').find(r=>r.id===body.id):null;
 if(body.id&&!old)throw Error('排程不存在');if(old&&old.revision!==body.revision)throw Error('排程已更新，請重新整理');
 if(old){const row=save({...old,enabled:body.enabled===true,revision:old.revision+1});audit('inspection.schedule.updated',row.id);return row;}
 const intervalDays=Number(body.intervalDays),dueDays=Number(body.dueDays);
 if(!Number.isInteger(intervalDays)||intervalDays<1||intervalDays>365||!Number.isInteger(dueDays)||dueDays<0||dueDays>365)throw Error('間隔須為 1–365 天，完成天數須為 0–365 天');
 const nextDate=validateDue(body.nextDate);if(!nextDate)throw Error('請指定首次派工日期');
 // Validate the same fields as a task without retaining a task during schedule creation.
 if(!list('assets').some(a=>a.id===body.assetId)||!list('users').some(u=>u.id===body.assigneeId&&u.enabled&&u.role!=='唯讀'))throw Error('資產或受派人無效');
 if(body.templateId!=='default'&&!list('inspectionTemplates').some(t=>t.id===body.templateId&&t.enabled))throw Error('範本不存在或已停用');
 const title=String(body.title||'').trim();if(!title||title.length>100)throw Error('請填寫 100 字內排程名稱');
 const r=save({id:'IS-'+crypto.randomUUID().slice(0,8),title,assetId:body.assetId,assigneeId:body.assigneeId,templateId:body.templateId,nextDate,intervalDays,dueDays,enabled:true,revision:0,createdAt:new Date().toISOString()});audit('inspection.schedule.created',r.id);return r;
 });},
 dispatchInspections(now=new Date()){
 const today=taipeiDate(now.toISOString());let created=0;
 for(const candidate of list('inspectionSchedules')){
 if(!candidate.enabled||candidate.nextDate>today)continue;
 try{transaction(()=>{const r=list('inspectionSchedules').find(x=>x.id===candidate.id);if(!r.enabled||r.nextDate>today)return;
 const task=create({...r,due:addDays(today,r.dueDays)});task.scheduleId=r.id;task.scheduledDate=r.nextDate;put.run('inspections',task.id,JSON.stringify(task));
 let nextDate=r.nextDate;while(nextDate<=today)nextDate=addDays(nextDate,r.intervalDays);
 save({...r,nextDate,lastTaskId:task.id,lastDispatchedAt:now.toISOString(),error:'',revision:r.revision+1});audit('inspection.schedule.dispatched',r.id);created++;
 });}catch(e){transaction(()=>{const r=list('inspectionSchedules').find(x=>x.id===candidate.id);if(r.error!==e.message)save({...r,error:e.message,revision:r.revision+1});});}
 }
 return {created};
 }
 };
}
