import {validateConnectionTypes,connectionUsage,connectionCapacityIssues} from '../shared/connection-capacity.mjs';
import {validateLifecycle} from '../shared/lifecycle.mjs';
export const zones=['A','B'];
export const rackIds=[...Array.from({length:11},(_,i)=>`4F-A-${String(i+1).padStart(2,'0')}`),...Array.from({length:22},(_,i)=>`4F-B-${String(i+1).padStart(2,'0')}`)];
export const systems={power:'電力',ups:'UPS',pdu:'PDU',cooling:'空調',fire:'消防',network:'網通',access:'門禁',environment:'環境'};
export function validateAsset(candidate,assets,ignoreId){
 validateLifecycle(candidate);validateConnectionTypes(candidate);
 if(!candidate.name?.trim())throw Error('請輸入資產名稱');
 if(!['server','switch','storage'].includes(candidate.type))throw Error('無效的設備類型');
 if(!rackIds.includes(candidate.rackId))throw Error('機櫃不存在');
 if(!Number.isInteger(candidate.uStart)||!Number.isInteger(candidate.uSize)||candidate.uStart<1||candidate.uSize<1||candidate.uStart+candidate.uSize-1>42)throw Error('U 位必須位於 1–42，且不可超出機櫃');
 const end=candidate.uStart+candidate.uSize-1;
 if(assets.some(a=>a.id!==ignoreId&&a.rackId===candidate.rackId&&a.uStart<=end&&a.uStart+a.uSize-1>=candidate.uStart))throw Error('U 位與既有設備重疊');
 if(!Number.isFinite(candidate.powerKw)||candidate.powerKw<0||candidate.powerKw>30)throw Error('額定功率需介於 0–30 kW');
 for(const [key,label,limit,integer] of [['weightKg','重量',1000,false],['outlets','電力插座',24,true],['ports','網路埠',48,true]]){
 const v=candidate[key];if(v!==undefined&&(!Number.isFinite(v)||v<0||v>limit||(integer&&!Number.isInteger(v))))throw Error(label+'數值無效');
 }
 const peers=assets.filter(a=>a.id!==ignoreId&&a.rackId===candidate.rackId);
 const connectorIssues=connectionCapacityIssues(connectionUsage(peers),candidate);if(connectorIssues.length)throw Error(connectorIssues.join('、'));
 for(const [key,label,limit,fallback] of [['powerKw','額定功率',10,0],['weightKg','承重',1000,30],['outlets','電力插座',24,2],['ports','網路埠',48,2]]){
 const total=peers.reduce((sum,a)=>sum+(a[key]??fallback),candidate[key]??fallback);
 if(total>limit+1e-9)throw Error('機櫃'+label+'超限：'+total+'／'+limit);
 }
 return true;
}
export function telemetry(t=Date.now()){
 const phase=t/22000;
 const racks=rackIds.map((id,i)=>({id,zone:id.split('-')[1],powerKw:+(3.8+(i%7)*.48+Math.sin(phase+i)*.12).toFixed(2),temperature:+(22+(i%5)*.55+Math.sin(phase/2+i)*.3+(id==='4F-B-07'?6.1:0)).toFixed(1),humidity:Math.round(43+(i%5)+Math.sin(phase+i)),capacityKw:10,health:id==='4F-B-07'?'critical':id==='4F-A-03'?'warning':'normal'}));
 const itPower=+racks.reduce((s,r)=>s+r.powerKw,0).toFixed(2);const facilityPower=+(itPower*1.38).toFixed(2);
 return {source:'simulation',timestamp:new Date(t).toISOString(),racks,itPower,facilityPower,pue:+(facilityPower/itPower).toFixed(2),voltage:380.2,current:+(facilityPower*1000/(Math.sqrt(3)*380.2*.98)).toFixed(1),powerFactor:.98,upsRuntimeMinutes:42,batteryPercent:98,temperature:+(racks.reduce((s,r)=>s+r.temperature,0)/33).toFixed(1),humidity:45,coolingLoadKw:+(facilityPower-itPower).toFixed(1),accessToday:128,inside:6};
}
export function seed(){
 const assets=[];
 for(const [i,rackId] of rackIds.entries()){
  for(let j=0;j<5;j++)assets.push({id:`AS-${String(i*5+j+1).padStart(4,'0')}`,name:j===4?'ToR 網路交換器':j===3?'儲存陣列':`運算節點 ${j+1}`,type:j===4?'switch':j===3?'storage':'server',rackId,uStart:[1,7,15,23,39][j],uSize:[4,4,4,6,2][j],powerKw:[.7,.8,1.1,1.5,.25][j],manufacturer:j===4?'Network Demo':'AIDC Lab',model:j===4?'SW-48P':'Compute R740',serial:`SIM-${i+1}-${j+1}`,service:j<3?'核心應用服務':j===3?'資料備份':'網路連接',owner:'資訊維運組',warrantyUntil:'2028-12-31'});
 }
 const now=Date.now();const alerts=[
 ['AL-001','critical','environment','4F-B-07','機櫃進風溫度超出門檻','進風溫度 > 28°C'],
 ['AL-002','warning','ups','4F-A-03','UPS-A 電池健康度預警','健康度低於設定值'],
 ['AL-003','warning','access','4F-B-01','B 區門禁授權遭拒','模擬無效識別卡'],
 ['AL-004','info','network','4F-A-01','核心交換器介面狀態變更','模擬埠連線事件'],
 ['AL-005','warning','cooling','4F-B-12','精密空調回風溫度偏高','回風溫度 > 32°C'],
 ['AL-006','info','power','4F-A-06','電力品質例行檢核完成','模擬週期檢核']
 ].map(([id,severity,system,rackId,title,condition],i)=>({id,severity,system,rackId,title,condition,state:'active',occurredAt:new Date(now-i*8*60000).toISOString(),acknowledgedAt:null,source:'simulation'}));
 return {assets,alerts,users:[{id:'U-001',name:'本地管理員',email:'admin@dcim.local',role:'管理員',enabled:true},{id:'U-002',name:'維運人員',email:'operator@dcim.local',role:'維運',enabled:true},{id:'U-003',name:'唯讀訪客',email:'viewer@dcim.local',role:'唯讀',enabled:true}]};
}
