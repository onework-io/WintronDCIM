import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRun,transition,demand} from '../shared/rfi.mjs';
import {createStore} from '../server/store.mjs';
const ready=scenario=>transition(transition(createRun(scenario),'analyze'),'check');
test('normal workflow blocks early restoration, spaces restores and completes without shed equipment',()=>{
 let r=ready('normal');assert.equal(r.state,'ready');assert.throws(()=>transition(r,'execute'),/確認/);
 r=transition(r,'execute',{confirmed:true});assert.equal(demand(r),236);assert.throws(()=>transition(r,'execute',{confirmed:true}),/階段/);assert.throws(()=>transition(r,'restore'),/回落/);
 r=transition(transition(r,'advance'),'advance');assert.equal(demand(r),202);
 r=transition(r,'restore');assert.equal(r.state,'restoring');assert.equal(demand(r),210);assert.throws(()=>transition(r,'restore'),/等待/);
 r=transition(transition(r,'advance'),'restore');assert.equal(r.state,'completed');assert.equal(demand(r),218);assert.ok(r.units.every(u=>!u.shed));assert.throws(()=>transition(r,'restore'),/階段/);
});
test('high temperature, offline equipment and insufficient shedding cannot execute',()=>{
 for(const scenario of ['hot','offline']){const r=ready(scenario);assert.equal(r.state,'analyzed');assert.ok(r.checks.some(c=>!c.pass));assert.throws(()=>transition(r,'execute',{confirmed:true}),/階段/);}
 let r=transition(ready('normal'),'plan',{selected:['AC-A-02']});r=transition(r,'check');assert.equal(r.state,'analyzed');assert.ok(r.checks.some(c=>!c.pass));
 assert.throws(()=>transition(r,'plan',{selected:['AC-A-01']}),/無效/);
});
test('failed command rolls back already shed units and ends the run',()=>{const r=transition(ready('failure'),'execute',{confirmed:true});assert.equal(r.state,'failed');assert.ok(r.units.every(u=>!u.shed));assert.equal(demand(r),252);assert.ok(r.logs.some(l=>l.event==='失敗回復'));});
test('RFI persists across restart, rejects stale revisions and parallel active runs',()=>{
 const dir=mkdtempSync(join(tmpdir(),'rfi-'));let store;
 try{const path=join(dir,'test.sqlite');store=createStore(path);let r=store.createRfi('normal');assert.throws(()=>store.createRfi('hot'),/目前情境/);r=store.updateRfi(r.id,'analyze',{revision:0});assert.throws(()=>store.updateRfi(r.id,'cancel',{revision:0}),/已更新/);store.db.close();store=createStore(path);assert.equal(store.list('rfi')[0].state,'analyzed');r=store.updateRfi(r.id,'cancel',{revision:1});assert.equal(r.state,'cancelled');assert.equal(store.createRfi('hot').scenario,'hot');}finally{store?.db.close();rmSync(dir,{recursive:true,force:true});}
});

test('historical demand context is recalculated and insufficient cooling is blocked',()=>{
 const source={month:'2026-10',date:'2026-10-31',time:'11:45',contract:250,warning:90,kw:1};
 let r=createRun('normal','history',undefined,source);assert.ok(r.baseline>270);assert.equal(r.threshold,225);assert.equal(r.contract,250);assert.ok(r.sourceDemand.kw>270);
 r=transition(transition(r,'analyze'),'check');assert.equal(r.state,'analyzed');assert.equal(r.checks.at(-1).pass,false);assert.throws(()=>transition(r,'execute',{confirmed:true}));
 assert.throws(()=>createRun('normal','invalid',undefined,{...source,time:'99:00'}));assert.throws(()=>createRun('normal','invalid',undefined,{...source,contract:1000}));
});
test('historical demand event completes with dynamic baseline and retained source',()=>{
 let r=createRun('normal','history',undefined,{month:'2026-10',date:'2026-10-31',time:'11:45',contract:270,warning:98});
 r=transition(transition(r,'analyze'),'check');assert.equal(r.state,'ready');r=transition(r,'execute',{confirmed:true});assert.equal(demand(r),Math.round((r.baseline-16)*10)/10);
 r=transition(transition(r,'advance'),'advance');r=transition(r,'restore');r=transition(transition(r,'advance'),'restore');assert.equal(r.state,'completed');assert.equal(demand(r),r.recoveryBaseline);assert.equal(r.sourceDemand.time,'11:45');
});
