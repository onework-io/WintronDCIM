import test from 'node:test';import assert from 'node:assert/strict';import {notificationFeed} from '../shared/notifications.mjs';import {createStore} from '../server/store.mjs';
const users=[{id:'admin',enabled:true,role:'管理員'},{id:'op',enabled:true,role:'維運'},{id:'other',enabled:true,role:'維運'}];
test('notification priority and Taiwan date boundaries, scope and resolution',()=>{
 const row={id:'I',state:'pending',due:'2026-11-11',items:[],assigneeId:'op'};const input={users,inspections:[row],workorders:[]};
 assert.equal(notificationFeed(input,'op',new Date('2026-11-10T16:00:00Z'))[0].kind,'due');
 assert.equal(notificationFeed(input,'op',new Date('2026-11-11T16:00:00Z'))[0].kind,'overdue');assert.equal(notificationFeed(input,'other').length,0);
 input.inspections=[{...row,state:'completed',items:[{result:'abnormal'}]}];assert.equal(notificationFeed(input,'admin')[0].kind,'abnormal');input.inspections[0].workOrderId='W';assert.equal(notificationFeed(input,'admin').length,0);
 input.workorders=[{id:'W',state:'review',reviewerId:'admin',assigneeId:'op'}];assert.equal(notificationFeed(input,'admin')[0].kind,'review');assert.equal(notificationFeed(input,'op').length,0);input.workorders[0].state='closed';assert.equal(notificationFeed(input,'admin').length,0);
});
test('read state is per user, idempotent, persistent and cannot mark invisible notification',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const dir=mkdtempSync(join(tmpdir(),'notification-'));let s=createStore(join(dir,'db'));
 try{const task=s.createInspection({title:'通知任務',assetId:'AS-0001',assigneeId:'U-002'});const id=s.notifications('U-002').find(n=>n.targetId===task.id).id;
 const feed=s.readNotifications({userId:'U-002',ids:[id]});assert.ok(feed[0].readAt);const at=feed[0].readAt;assert.equal(s.readNotifications({userId:'U-002',ids:[id]})[0].readAt,at);assert.equal(s.notifications('U-001')[0].readAt,null);assert.throws(()=>s.readNotifications({userId:'U-003',ids:[id]}));assert.throws(()=>s.readNotifications({userId:'U-002',ids:['invalid']}));
 s.db.close();s=createStore(join(dir,'db'));assert.equal(s.notifications('U-002')[0].readAt,at);assert.equal(s.list('notificationReads').length,1);
 }finally{s.db.close();rmSync(dir,{recursive:true,force:true});}
});
