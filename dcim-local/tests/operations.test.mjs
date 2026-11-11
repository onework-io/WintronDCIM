import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {analyzeEnergy} from '../shared/history.mjs';
import {createStore} from '../server/store.mjs';
import {queryData} from '../shared/data-query.mjs';
import {telemetry,seed} from '../server/domain.mjs';
test('monthly dataset reconciles zones and partial months use same period',()=>{
 const all=analyzeEnergy('2026-10'),a=analyzeEnergy('2026-10','A'),b=analyzeEnergy('2026-10','B');assert.ok(Math.abs(all.summary.facility-a.summary.facility-b.summary.facility)<1);assert.equal(all.summary.pue,all.summary.facility/all.summary.it);assert.ok(b.delta>a.delta);const partial=analyzeEnergy('2026-11');assert.equal(partial.current.length,10);assert.equal(partial.prior.length,10);assert.throws(()=>analyzeEnergy('2026-12'));
 const reply=queryData('上月 B 區耗電分析',{...seed(),telemetry:telemetry()});assert.match(reply.text,/2026-10 B 區/);assert.equal(reply.rows[0][1],b.summary.facility);
});
test('work order requires assignment, feedback and review; persists and rejects duplicate/stale actions',()=>{
 const dir=mkdtempSync(join(tmpdir(),'dcim-work-')),path=join(dir,'test.sqlite');let store=createStore(path);
 try{assert.throws(()=>store.createWork({alertId:'AL-001',assigneeId:'U-002',reviewerId:'U-001',due:'2026-02-30'}));let w=store.createWork({alertId:'AL-001',assigneeId:'U-002',reviewerId:'U-001',device:'冷通道 B-07',description:'進風異常，請檢查封板',vendor:'空調維護班',due:'2026-11-12',priority:'critical'});assert.equal(w.device,'冷通道 B-07');assert.equal(w.vendor,'空調維護班');assert.equal(w.area,'B');assert.equal(w.due,'2026-11-12');const act=(action,actorId,note='')=>store.updateWork(w.id,action,{revision:w.revision,actorId,note});assert.throws(()=>store.createWork({alertId:'AL-001',assigneeId:'U-002',reviewerId:'U-001'}));assert.throws(()=>act('start','U-001'));w=act('start','U-002');assert.throws(()=>act('submit','U-002'));w=act('submit','U-002','已檢查風道');assert.throws(()=>act('approve','U-002','通過'));w=act('reject','U-001','請補測溫度');assert.equal(w.state,'working');w=act('submit','U-002','已補測');w=act('approve','U-001','審核通過');assert.equal(w.state,'closed');assert.throws(()=>store.updateWork(w.id,'start',{revision:0,actorId:'U-002'}));assert.equal(store.list('alerts').find(a=>a.id==='AL-001').state,'active');store.db.close();store=createStore(path);assert.equal(store.list('workorders')[0].state,'closed');assert.equal(store.list('workorders')[0].logs.length,6);}finally{store.db.close();rmSync(dir,{recursive:true,force:true});}
});

test('handover and deadline changes enforce roles, retain history and persist',()=>{
 const dir=mkdtempSync(join(tmpdir(),'dcim-handover-')),path=join(dir,'test.sqlite');let store=createStore(path);
 try{const next=store.saveUser({name:'第二維運班',email:'shift2@example.test',role:'維運'});let w=store.createWork({alertId:'AL-002',assigneeId:'U-002',reviewerId:'U-001'});
 const act=(action,actorId,note,extra={})=>store.updateWork(w.id,action,{revision:w.revision,actorId,note,...extra});
 assert.throws(()=>act('schedule','U-002','延後',{due:'2026-11-12'}));assert.throws(()=>act('schedule','U-001','日期錯誤',{due:'2026-02-30'}));assert.throws(()=>act('schedule','U-001','',{due:'2026-11-12'}));
 w=act('schedule','U-001','設定維修期限',{due:'2026-11-12'});assert.equal(w.due,'2026-11-12');assert.match(w.logs.at(-1).note,/未指定 → 2026-11-12/);
 w=act('start','U-002','開始檢查');w=act('comment','U-002','已完成第一項檢查');assert.equal(w.state,'working');assert.throws(()=>act('comment','U-003','不允許'));
 assert.throws(()=>act('reassign','U-001','交班',{assigneeId:'U-001'}));assert.throws(()=>act('reassign','U-002','交班',{assigneeId:next.id}));
 w=act('reassign','U-001','改由晚班接手',{assigneeId:next.id});assert.equal(w.state,'assigned');assert.equal(w.assigneeId,next.id);assert.match(w.logs.at(-1).note,/第二維運班/);assert.throws(()=>act('start','U-002','原受派人不可繼續'));
 w=act('start',next.id,'接手');w=act('submit',next.id,'完成');assert.throws(()=>act('reassign','U-001','送審中不可改派',{assigneeId:'U-002'}));w=act('approve','U-001','通過');assert.throws(()=>act('schedule','U-001','已結案不可修改',{due:'2026-11-13'}));assert.throws(()=>act('comment',next.id,'已結案不可新增'));
 store.db.close();store=createStore(path);const saved=store.list('workorders').find(x=>x.id===w.id);assert.equal(saved.assigneeId,next.id);assert.equal(saved.due,'2026-11-12');assert.ok(saved.logs.some(l=>l.action==='comment'));
 }finally{store.db.close();rmSync(dir,{recursive:true,force:true});}
});
test('work CSV quotes multiline values and neutralizes formula cells',async()=>{
 const {workCsv}=await import('../shared/workorders.mjs');const csv=workCsv([{id:'WO-1',title:'=SUM(1,2)',rackId:'4F-B-07',state:'assigned',assigneeId:'U1',reviewerId:'U2',updatedAt:'now'}],[{id:'U1',name:'A,"B"\nC'}]);assert.ok(csv.startsWith('\ufeff'));assert.match(csv,/"'=SUM\(1,2\)"/);assert.ok(csv.includes('"A,""B""\nC"'));
});
