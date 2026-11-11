import {validateConnectionTypes,connectionUsage,connectionCapacityIssues} from './connection-capacity.mjs';
export const capacityDefaults={uSize:4,powerKw:1.2,weightKg:35,outlets:2,ports:2,count:2,zone:'all',strategy:'spread',coolingLimitKw:8,coolingReservePct:20,powerRedundancy:'none',outletType:'C13',networkType:'RJ45',zoneCoolingA:80,zoneCoolingB:150};
export function rackCapacity(rack,assets){
 const installed=assets.filter(a=>a.rackId===rack.id),used=new Set();for(const a of installed)for(let u=a.uStart;u<a.uStart+a.uSize;u++)used.add(u);
 const slots=Array.from({length:42},(_,i)=>!used.has(i+1));let longest=0,run=0;for(const free of slots){run=free?run+1:0;longest=Math.max(longest,run);}
 return {connectionUsage:connectionUsage(installed),id:rack.id,zone:rack.zone,slots,usedU:used.size,freeU:42-used.size,longest,power:installed.reduce((s,a)=>s+a.powerKw,0),powerLimit:rack.capacityKw||10,measured:rack.powerKw,temperature:rack.temperature,weight:installed.reduce((s,a)=>s+(a.weightKg??30),0),weightLimit:1000,outlets:installed.reduce((s,a)=>s+(a.outlets??2),0),outletLimit:24,ports:installed.reduce((s,a)=>s+(a.ports??2),0),portLimit:48};
}
export function validateRequest(r){
 for(const [key,min,max,integer] of [['uSize',1,42,true],['count',1,33,true],['powerKw',.01,30,false],['weightKg',1,1000,false],['outlets',1,24,true],['ports',1,48,true]])if(!Number.isFinite(r[key])||r[key]<min||r[key]>max||(integer&&!Number.isInteger(r[key])))throw Error('請輸入有效的 '+key);
 validateAdvanced(r);validateConnectionTypes(r);
 if(!['all','A','B'].includes(r.zone)||!['spread','pack'].includes(r.strategy))throw Error('配置條件無效');
}
export function validateAdvanced(r){
 for(const key of ['zoneCoolingA','zoneCoolingB'])if(r[key]!==undefined&&(!Number.isFinite(r[key])||r[key]<=0||r[key]>10000))throw Error('區域冷卻容量無效');
 if(r.coolingLimitKw!==undefined&&(!Number.isFinite(r.coolingLimitKw)||r.coolingLimitKw<=0||r.coolingLimitKw>100))throw Error('每櫃冷卻容量需大於 0 且不超過 100 kW');
 if(r.coolingReservePct!==undefined&&(!Number.isFinite(r.coolingReservePct)||r.coolingReservePct<0||r.coolingReservePct>50))throw Error('冷卻預留比例需介於 0–50%');
 if(r.powerRedundancy!==undefined&&!['none','dual'].includes(r.powerRedundancy))throw Error('供電備援條件無效');
}
export function advancedCapacity(c,r){validateAdvanced(r);return {powerLimit:c.powerLimit*(r.powerRedundancy==='dual'?.5:1),coolingLimit:r.coolingLimitKw===undefined?null:r.coolingLimitKw*(1-(r.coolingReservePct??0)/100),load:c.power};}
function locate(c,size){for(let i=0;i<=42-size;i++)if(c.slots.slice(i,i+size).every(Boolean))return i+1;return null;}
export function checkPlacement(c,r,uStart){const issues=connectionCapacityIssues(c.connectionUsage,r);const advanced=advancedCapacity(c,r);if(c.power+r.powerKw>advanced.powerLimit+1e-9&&r.powerRedundancy==='dual')issues.push('雙路備援供電餘裕不足');if(advanced.coolingLimit!==null&&c.power+r.powerKw>advanced.coolingLimit+1e-9)issues.push('冷卻容量或預留餘裕不足');if(!Number.isInteger(uStart)||uStart<1||uStart+r.uSize-1>42||!c.slots.slice(uStart-1,uStart-1+r.uSize).every(Boolean))issues.push('連續 U 位不足或重疊');if(c.power+r.powerKw>c.powerLimit+1e-9)issues.push('規劃功率超限');if(c.weight+r.weightKg>c.weightLimit)issues.push('承重不足');if(c.outlets+r.outlets>c.outletLimit)issues.push('電力插座不足');if(c.ports+r.ports>c.portLimit)issues.push('網路埠不足');if(!Number.isFinite(c.temperature)||c.temperature>=28)issues.push('進風溫度異常或缺值');return issues;}
function occupy(c,r,start){const ot=r.outletType||'C13',nt=r.networkType||'RJ45';c.connectionUsage.outlet[ot]+=r.outlets;c.connectionUsage.network[nt]+=r.ports;for(let i=start-1;i<start-1+r.uSize;i++)c.slots[i]=false;c.usedU+=r.uSize;c.freeU-=r.uSize;c.power+=r.powerKw;c.weight+=r.weightKg;c.outlets+=r.outlets;c.ports+=r.ports;}
export function zoneCooling(caps,r,zone){const gross=r['zoneCooling'+zone];const used=caps.filter(c=>c.zone===zone).reduce((s,c)=>s+c.power,0);const limit=gross===undefined?null:gross*(1-(r.coolingReservePct??0)/100);return {zone,used,limit,remaining:limit===null?null:limit-used};}
export function zoneIssues(caps,r,zone){const c=zoneCooling(caps,r,zone);return c.limit!==null&&c.used+r.powerKw>c.limit+1e-9?['Zone '+zone+' cooling capacity exceeded']:[];}
export function planCapacity(racks,assets,request){validateRequest(request);const before=racks.map(r=>rackCapacity(r,assets)),after=structuredClone(before),placements=[];
 for(let n=0;n<request.count;n++){const candidates=after.filter(c=>request.zone==='all'||c.zone===request.zone).map(c=>({c,start:locate(c,request.uSize)})).filter(x=>x.start&&!checkPlacement(x.c,request,x.start).length&&!zoneIssues(after,request,x.c.zone).length).sort((a,b)=>(request.strategy==='spread'?a.c.power/a.c.powerLimit-b.c.power/b.c.powerLimit:b.c.power/b.c.powerLimit-a.c.power/a.c.powerLimit)||a.c.id.localeCompare(b.c.id));if(!candidates.length)break;const {c,start}=candidates[0];placements.push({rackId:c.id,uStart:start,...request,index:n+1});occupy(c,request,start);}
 const exclusions=before.filter(c=>request.zone==='all'||c.zone===request.zone).map(c=>({rackId:c.id,issues:[...checkPlacement(c,request,locate(c,request.uSize)),...zoneIssues(before,request,c.zone)]})).filter(c=>c.issues.length);return {before,after,placements,exclusions,unplaced:request.count-placements.length};
}
export function checkPlan(plan,racks,assets){const caps=racks.map(r=>rackCapacity(r,assets));return plan.placements.map(p=>{const c=caps.find(c=>c.id===p.rackId);const issues=c?[...checkPlacement(c,p,p.uStart),...zoneIssues(caps,p,c.zone)]:['機櫃不存在'];if(c)occupy(c,p,p.uStart);return {...p,issues};});}
