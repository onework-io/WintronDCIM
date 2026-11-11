import test from 'node:test';import assert from 'node:assert/strict';import {createStore} from '../server/store.mjs';
test('inspection checklist locks on completion, validates owner and converts abnormal result exactly once',()=>{const s=createStore(':memory:');try{
 assert.throws(()=>s.createInspection({title:'test',assetId:'bad',assigneeId:'U-002'}));
 let r=s.createInspection({title:'每日巡檢',assetId:'AS-0001',assigneeId:'U-002',due:'2026-11-12'});
 const body=()=>({revision:r.revision,actorId:'U-002',items:r.items});
 assert.throws(()=>s.updateInspection(r.id,'complete',body()),/所有/);
 assert.throws(()=>s.updateInspection(r.id,'save',{...body(),actorId:'U-001'}),/指定/);
 r.items=r.items.map((i,n)=>({...i,result:n?'normal':'abnormal',note:''}));assert.throws(()=>s.updateInspection(r.id,'save',body()),/說明/);
 r.items[0].note='固定螺絲鬆動';r=s.updateInspection(r.id,'save',body());assert.equal(r.state,'working');
 assert.throws(()=>s.updateInspection(r.id,'save',{...body(),revision:0}),/更新/);
 r=s.updateInspection(r.id,'complete',body());assert.equal(r.state,'completed');assert.throws(()=>s.updateInspection(r.id,'save',body()),/不可修改/);
 const b={...body(),assigneeId:'U-002',reviewerId:'U-001'};const result=s.updateInspection(r.id,'workorder',b);assert.equal(result.workorder.inspectionId,r.id);assert.match(result.workorder.description,/螺絲/);assert.equal(s.updateInspection(r.id,'workorder',b).workorder.id,result.workorder.id);assert.equal(s.list('workorders').length,1);
 }finally{s.db.close();}});
test('normal inspection cannot create an abnormal workorder',()=>{const s=createStore(':memory:');try{let r=s.createInspection({title:'正常巡檢',assetId:'AS-0002',assigneeId:'U-002'});r=s.updateInspection(r.id,'complete',{revision:0,actorId:'U-002',items:r.items.map(i=>({...i,result:'normal'}))});assert.throws(()=>s.updateInspection(r.id,'workorder',{revision:r.revision,actorId:'U-002'}),/有異常/);assert.equal(s.list('workorders').length,0);}finally{s.db.close();}});

test('template versions persist and tasks retain snapshots after template edits or disabling',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const dir=mkdtempSync(join(tmpdir(),'inspection-template-'));const path=join(dir,'test.sqlite');let s=createStore(path);
 try{const input={name:'伺服器巡檢',items:['風扇狀態','電源狀態'],actorId:'U-001'};
 assert.throws(()=>s.saveInspectionTemplate({...input,actorId:'U-002'}),/管理員/);assert.throws(()=>s.saveInspectionTemplate({...input,items:['重複','重複']}),/重複/);assert.throws(()=>s.saveInspectionTemplate({...input,items:[]}),/1–20/);assert.throws(()=>s.saveInspectionTemplate({...input,id:'default'}),/不可修改/);
 let t=s.saveInspectionTemplate(input);const task=s.createInspection({title:'風扇檢查',assetId:'AS-0001',assigneeId:'U-002',templateId:t.id});assert.equal(task.items.length,2);
 t=s.saveInspectionTemplate({...t,actorId:'U-001',items:['修改後項目']});assert.throws(()=>s.saveInspectionTemplate({...t,revision:0,actorId:'U-001'}),/已更新/);
 assert.equal(s.list('inspections')[0].items[0].label,'風扇狀態');assert.equal(s.list('inspections')[0].templateRevision,0);
 t=s.saveInspectionTemplate({...t,enabled:false,actorId:'U-001'});assert.throws(()=>s.createInspection({title:'停用測試',assetId:'AS-0001',assigneeId:'U-002',templateId:t.id}),/停用/);
 s.db.close();s=createStore(path);assert.equal(s.inspectionTemplates().find(x=>x.id===t.id).enabled,false);assert.equal(s.list('inspections')[0].items.length,2);
 }finally{s.db.close();rmSync(dir,{recursive:true,force:true});}
});
