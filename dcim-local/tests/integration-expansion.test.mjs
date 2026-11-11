import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../server/store.mjs';
import {forecastDemand,minuteScenario} from '../shared/demand-forecast.mjs';
import {validateSensorRule,evaluateSensorRule,ruleTags} from '../shared/sensor-rule.mjs';
import {planCapacity,checkPlan,capacityDefaults} from '../shared/capacity.mjs';
import {assertHeldLimits} from '../server/reservations.mjs';

test('demand forecast conserves interval energy and handles exhausted budget and missing data',()=>{
 const samples=minuteScenario(250),full=forecastDemand(samples,{elapsed:15,contract:250});
 assert.ok(Math.abs(full.forecastKw-250)<1e-9);assert.equal(full.availableKw,null);assert.equal(full.complete,true);
 assert.equal(forecastDemand(Array(15).fill(500),{elapsed:10,contract:250}).alreadyExceeded,true);
 assert.throws(()=>forecastDemand([null],{elapsed:1,contract:250}));
 assert.throws(()=>forecastDemand(samples,{elapsed:0,contract:250}));
 assert.notEqual(forecastDemand(samples,{elapsed:10,contract:250}).forecastKw,forecastDemand(samples,{elapsed:10,contract:250,mode:'average'}).forecastKw);
});
test('zone cooling is cumulative across racks and revalidated against other rack changes',()=>{
 const racks=['01','02'].map(n=>({id:'4F-A-'+n,zone:'A',capacityKw:10,temperature:22,powerKw:0}));
 const request={...capacityDefaults,zoneCoolingA:2.5,count:3,powerKw:1};
 const p=planCapacity(racks,[],request);assert.equal(p.placements.length,2);assert.equal(p.unplaced,1);
 const asset={id:'other',rackId:'4F-A-02',powerKw:2,uStart:30,uSize:1};
 assert.ok(checkPlan({placements:[p.placements[0]]},racks,[asset])[0].issues.some(x=>x.includes('cooling')));
 const h={id:'h',state:'active',workOrderId:'w',placements:[p.placements[0]]};
 assert.throws(()=>assertHeldLimits([h],[asset],racks,'',['4F-A-02']));
});
test('physical topology mapping rejects wrong rack, duplicate asset, unauthorized actor and stale revision',()=>{
 const s=createStore(':memory:');try{const a=s.list('assets').find(a=>a.type==='switch'),node='TOR-'+a.rackId+'-A';
 const body={nodeId:node,assetId:a.id,actorId:'U-001',revision:0,note:'test'};
 const m=s.saveTopologyMapping(body);assert.equal(m.assetId,a.id);assert.equal(m.revision,1);
 assert.throws(()=>s.saveTopologyMapping(body));
 assert.throws(()=>s.saveTopologyMapping({...body,nodeId:node.slice(0,-1)+'B'}));
 assert.throws(()=>s.saveTopologyMapping({...body,nodeId:'TOR-4F-B-22-A'}));
 assert.throws(()=>s.saveTopologyMapping({...body,nodeId:'CORE-A',actorId:'U-003'}));
 assert.equal(s.saveTopologyMapping({nodeId:'UPS-A',actorId:'U-001',revision:0,name:'Facility UPS A',serial:'UPS-001',note:'test'}).history.length,1);
 }finally{s.db.close();}
});
test('humidity and leak rules preserve debounce, hysteresis and missing-data behavior',()=>{
 const config=validateSensorRule({metric:'humidityLow',zone:'A',enabled:true,trigger:35,recover:40,triggerSeconds:6,recoverSeconds:6});let state={};
 const step=(at,value)=>{const r=evaluateSensorRule(config,{at:at*1000,value},state);state=r.state;return r;};
 step(0,30);assert.equal(step(6,30).events[0].type,'trigger');step(9,45);step(12,null);assert.equal(step(18,45).active,true);assert.equal(step(24,45).events[0].type,'recover');
 assert.equal(ruleTags('temperature','all').length,32);assert.equal(ruleTags('humidityHigh','all').length,33);
 assert.throws(()=>validateSensorRule({...config,recover:30}));
});
test('multi-sensor engine persists one event per episode and requires recovery for closure',()=>{
 const s=createStore(':memory:');try{const config=s.saveSensorRule({metric:'leak',zone:'A',enabled:true,trigger:1,recover:0,triggerSeconds:6,recoverSeconds:6,actorId:'U-001',reason:'test'});
 assert.throws(()=>s.saveSensorRule({...config,id:undefined,reason:'duplicate',actorId:'U-001'}));
 const sample=(sec,wet)=>({timestamp:new Date(1800000000000+sec*1000).toISOString(),racks:[],sensorOverrides:{'WL-A-01':wet?'漏水':'乾燥'}});
 for(const sec of [0,3,6,9])s.processSensorRules(sample(sec,true));
 const rows=()=>s.list('alerts').filter(a=>a.source==='sensor-rule');assert.equal(rows().length,1);assert.equal(rows()[0].signalState,'active');
 assert.throws(()=>s.updateAlert(rows()[0].id,'resolve',{revision:0,actorId:'U-001',note:'test'}));
 assert.throws(()=>s.saveSensorRule({...config,triggerSeconds:0,actorId:'U-001',reason:'active change'}));
 for(const sec of [12,15,18])s.processSensorRules(sample(sec,false));assert.equal(rows()[0].signalState,'recovered');assert.equal(rows()[0].state,'active');
 s.processSensorRules(sample(18,true));assert.equal(rows().length,1);
 for(const sec of [21,24,27])s.processSensorRules(sample(sec,true));assert.equal(rows().length,1);assert.equal(rows()[0].occurrenceCount,2);
 }finally{s.db.close();}
});
