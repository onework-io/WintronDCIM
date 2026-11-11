import test from 'node:test';import assert from 'node:assert/strict';import {createStore} from '../server/store.mjs';
const body={title:'週巡檢',assetId:'AS-0001',assigneeId:'U-002',actorId:'U-001',templateId:'default',intervalDays:7,dueDays:1,nextDate:'2026-11-01'};
test('scheduler coalesces missed cycles, atomically advances and does not duplicate',()=>{const s=createStore(':memory:');try{
 assert.throws(()=>s.saveInspectionSchedule({...body,actorId:'U-002'}),/管理員/);assert.throws(()=>s.saveInspectionSchedule({...body,intervalDays:0}),/間隔/);
 const r=s.saveInspectionSchedule(body);assert.equal(s.dispatchInspections(new Date('2026-11-10T16:00:00Z')).created,1);
 const task=s.list('inspections')[0];assert.equal(task.scheduleId,r.id);assert.equal(task.due,'2026-11-12');assert.equal(task.scheduledDate,'2026-11-01');
 const updated=s.list('inspectionSchedules')[0];assert.equal(updated.nextDate,'2026-11-15');assert.equal(s.dispatchInspections(new Date('2026-11-11T01:00:00Z')).created,0);
 assert.throws(()=>s.saveInspectionSchedule({...r,actorId:'U-001',enabled:false}),/已更新/);
 s.saveInspectionSchedule({...updated,actorId:'U-001',enabled:false});assert.equal(s.dispatchInspections(new Date('2026-11-16T00:00:00Z')).created,0);
 }finally{s.db.close();}});
test('disabled template prevents dispatch without advancing or partial task; resumes after repair',()=>{const s=createStore(':memory:');try{
 const t=s.saveInspectionTemplate({actorId:'U-001',name:'網路',items:['連線']});s.saveInspectionSchedule({...body,templateId:t.id});const disabled=s.saveInspectionTemplate({...t,actorId:'U-001',enabled:false});
 assert.equal(s.dispatchInspections(new Date('2026-11-11T00:00:00Z')).created,0);assert.equal(s.list('inspections').length,0);assert.equal(s.list('inspectionSchedules')[0].nextDate,body.nextDate);assert.match(s.list('inspectionSchedules')[0].error,/停用/);
 s.saveInspectionTemplate({...disabled,actorId:'U-001',enabled:true});assert.equal(s.dispatchInspections(new Date('2026-11-11T00:00:00Z')).created,1);assert.equal(s.list('inspectionSchedules')[0].error,'');
 }finally{s.db.close();}});
test('schedule and last dispatch persist across database restart',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const dir=mkdtempSync(join(tmpdir(),'schedule-'));let s=createStore(join(dir,'db.sqlite'));
 try{s.saveInspectionSchedule(body);s.dispatchInspections(new Date('2026-11-11T00:00:00Z'));s.db.close();s=createStore(join(dir,'db.sqlite'));assert.equal(s.dispatchInspections(new Date('2026-11-11T01:00:00Z')).created,0);assert.equal(s.list('inspections').length,1);assert.equal(s.list('inspectionSchedules')[0].lastTaskId,s.list('inspections')[0].id);}finally{s.db.close();rmSync(dir,{recursive:true,force:true});}
});
