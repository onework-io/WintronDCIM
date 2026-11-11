import test from 'node:test';import assert from 'node:assert/strict';
import {capacityDefaults,planCapacity,checkPlan,rackCapacity} from '../shared/capacity.mjs';
import {seed,telemetry} from '../server/domain.mjs';
test('capacity respects contiguous U and all resource limits and excludes hot racks',()=>{const {assets}=seed(),racks=telemetry(0).racks;const r=planCapacity(racks,assets,capacityDefaults);assert.equal(r.placements.length,2);assert.notEqual(r.placements[0].rackId,r.placements[1].rackId);assert.ok(r.placements.every(p=>p.rackId!=='4F-B-07'));assert.ok(checkPlan(r,racks,assets).every(p=>!p.issues.length));assert.equal(rackCapacity(racks[0],assets).longest,10);const tooBig=planCapacity(racks,assets,{...capacityDefaults,uSize:11});assert.equal(tooBig.placements.length,0);assert.equal(planCapacity(racks,assets,{...capacityDefaults,powerKw:30}).placements.length,0);assert.equal(planCapacity(racks,assets,{...capacityDefaults,weightKg:1000}).placements.length,0);assert.equal(planCapacity(racks,assets,{...capacityDefaults,outlets:24}).placements.length,0);assert.equal(planCapacity(racks,assets,{...capacityDefaults,ports:48}).placements.length,0);assert.throws(()=>planCapacity(racks,assets,{...capacityDefaults,count:1.5}));});
test('pack strategy shares a rack and rechecking detects newly installed assets',()=>{const {assets}=seed(),racks=telemetry(0).racks;const result=planCapacity(racks,assets,{...capacityDefaults,strategy:'pack',zone:'A',coolingLimitKw:10});assert.equal(result.placements[0].rackId,result.placements[1].rackId);const p=result.placements[0];const changed=[...assets,{id:'new',rackId:p.rackId,uStart:p.uStart,uSize:p.uSize,powerKw:8}];const checked=checkPlan(result,racks,changed);assert.ok(checked[0].issues.includes('連續 U 位不足或重疊'));assert.ok(checked[0].issues.includes('規劃功率超限'));assert.ok(result.placements.every(p=>p.rackId.startsWith('4F-A')));});

test('capacity transfer validates current assets, deduplicates and keeps plan through review',async()=>{
 const {createStore}=await import('../server/store.mjs');const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const dir=mkdtempSync(join(tmpdir(),'capacity-transfer-'));const store=createStore(join(dir,'db.sqlite'));
 try{const assets=store.list('assets'),plan=planCapacity(telemetry().racks,assets,capacityDefaults);plan.request=capacityDefaults;const body={plan,name:'上架測試',assigneeId:'U-002',reviewerId:'U-001',due:'2026-11-12'};
 assert.throws(()=>store.createCapacityWork({...body,reviewerId:'U-002'}));assert.throws(()=>store.createCapacityWork({...body,plan:{...plan,placements:plan.placements.slice(0,1)}}));
 const a=plan.placements[0];const asset=store.saveAsset({name:'衝突設備',type:'server',rackId:a.rackId,uStart:a.uStart,uSize:a.uSize,powerKw:1});assert.throws(()=>store.createCapacityWork(body),/衝突/);store.deleteAsset(asset.id);
 let w=store.createCapacityWork(body);assert.equal(w.sourceType,'capacity');assert.equal(w.capacityPlan.placements.length,2);assert.equal(store.createCapacityWork(body).id,w.id);assert.equal(store.list('workorders').length,1);
 for(const [action,actorId,note] of [['start','U-002','開始上架'],['submit','U-002','依配置完成'],['approve','U-001','驗收通過']])w=store.updateWork(w.id,action,{revision:w.revision,actorId,note,installAssets:true});assert.equal(w.state,'closed');assert.equal(w.capacityPlan.placements[0].rackId,a.rackId);assert.equal(store.list('assets').length,assets.length+2);assert.equal(w.installedAssetIds.length,2);const installed=store.list('assets').find(a=>a.id===w.installedAssetIds[0]);const {weightKg,outlets,ports,sourceWorkOrderId,...edit}=installed;const edited=store.saveAsset({...edit,name:'已更新設備名稱'},installed.id);assert.equal(edited.weightKg,35);assert.equal(edited.sourceWorkOrderId,w.id);assert.equal(rackCapacity(telemetry().racks.find(r=>r.id===a.rackId),store.list('assets')).weight,185);assert.throws(()=>store.updateWork(w.id,'approve',{revision:w.revision,actorId:'U-001',note:'再次驗收',installAssets:true}));assert.equal(store.list('assets').length,assets.length+2);
 }finally{store.db.close();rmSync(dir,{recursive:true,force:true});}
});

test('installation rechecks conflicts atomically and preserves review state until resolved',async()=>{
 const {createStore}=await import('../server/store.mjs');const store=createStore(':memory:');
 try{const original=store.list('assets'),plan=planCapacity(telemetry().racks,original,capacityDefaults);plan.request=capacityDefaults;
 let w=store.createCapacityWork({plan,name:'競爭上架',assigneeId:'U-002',reviewerId:'U-001'});
 for(const action of ['start','submit'])w=store.updateWork(w.id,action,{revision:w.revision,actorId:'U-002',note:'配置檢查'});
 const p=plan.placements[1],blocker=store.saveAsset({name:'先上架設備',type:'server',rackId:p.rackId,uStart:p.uStart,uSize:p.uSize,powerKw:1});
 const approve={revision:w.revision,actorId:'U-001',note:'完成驗收',installAssets:true};
 assert.throws(()=>store.updateWork(w.id,'approve',approve),/衝突/);
 assert.equal(store.list('assets').length,original.length+1);assert.equal(store.list('workorders')[0].revision,w.revision);assert.equal(store.list('workorders')[0].state,'review');assert.ok(!store.list('assets').some(a=>a.sourceWorkOrderId===w.id));
 store.deleteAsset(blocker.id);assert.throws(()=>store.updateWork(w.id,'approve',{...approve,installAssets:false}),/驗收並建立資產/);
 w=store.updateWork(w.id,'approve',approve);assert.equal(w.state,'closed');assert.equal(store.list('assets').filter(a=>a.sourceWorkOrderId===w.id).length,2);
 }finally{store.db.close();}
});
