import {physicalTopologyMethods} from './physical-topology.mjs';
import {allocatePorts,assertPorts,physicalRows} from '../shared/physical-ports.mjs';
import {sensorRuleMethods} from './sensor-rules.mjs';
import {topologyMappingMethods} from './topology-mapping.mjs';
import {slaEventMethods} from './sla-events.mjs';
import {liveAlertMethods} from './live-alert-rules.mjs';
import {alertLifecycleMethods} from './alert-lifecycle.mjs';
import {maintenanceWorkMethods,rescheduleMaintenance} from './maintenance-work.mjs';
import {reservedAssets} from '../shared/reservations.mjs';
import {reservationMethods,assertHeldLimits} from './reservations.mjs';
import {departmentMethods} from './departments.mjs';
import {recommendationMethods} from './recommendations.mjs';
import {notificationMethods} from './notifications.mjs';
import {inspectionMethods} from './inspections.mjs';
import {createHash} from '../shared/identity.mjs';
import {checkPlan,validateRequest} from '../shared/capacity.mjs';
import {validateDue} from '../shared/workorders.mjs';
import {workDetails} from '../shared/workorders.mjs';
import {advanceWork} from '../shared/workorders.mjs';
import {createRun,transition} from '../shared/rfi.mjs';
import {defaultEnergySettings,validateEnergySettings} from '../shared/energy.mjs';
import { seed,validateAsset,telemetry } from './domain.mjs';
export function createStoreFromDatabase(db){
 db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(kind,id)); CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,at TEXT NOT NULL,action TEXT NOT NULL,entity TEXT NOT NULL);');
 const put=db.prepare('INSERT INTO records(kind,id,data) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data');
 const list=kind=>db.prepare('SELECT data FROM records WHERE kind=? ORDER BY id').all(kind).map(r=>JSON.parse(r.data));
 if(!list('assets').length&&!db.prepare('SELECT 1 FROM records WHERE kind=?').get('meta')){const initial=seed();db.exec('BEGIN');try{for(const [kind,rows] of Object.entries(initial))for(const row of rows)put.run(kind,row.id,JSON.stringify(row));put.run('meta','seeded','{}');db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
 if(!list('settings').some(r=>r.id==='physical-topology'))put.run('settings','physical-topology',JSON.stringify({id:'physical-topology',revision:0,config:Object.fromEntries(physicalRows(list('assets')).map(r=>[r.asset.id,{power:r.power,network:r.network}]))}));
 const audit=(action,id)=>db.prepare('INSERT INTO audit(at,action,entity) VALUES(?,?,?)').run(new Date().toISOString(),action,id);
 function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}
 return {db,list,...physicalTopologyMethods({list,put,transaction,audit}),...sensorRuleMethods({list,put,transaction,audit}),...topologyMappingMethods({list,put,transaction,audit}),...slaEventMethods({list,put,transaction,audit}),...liveAlertMethods({list,put,transaction,audit}),...alertLifecycleMethods({list,put,transaction,audit}),...maintenanceWorkMethods({list,put,transaction,audit}),...reservationMethods({list,put,transaction,audit}),...departmentMethods({list,put,transaction,audit}),...recommendationMethods({list,put,transaction,audit}),...notificationMethods({list,put,transaction,audit}),...inspectionMethods({list,put,transaction,audit}),
 createWork(input){return transaction(()=>{const alert=list('alerts').find(a=>a.id===input.alertId);if(!alert)throw Error('找不到來源告警');if(alert.state==='resolved')throw Error('告警處置已結案，請先重新開啟事件');if(list('workorders').some(w=>w.alertId===alert.id&&w.state!=='closed'))throw Error('此告警已有進行中的工單');const users=list('users');const assignee=users.find(u=>u.id===input.assigneeId&&u.enabled&&u.role!=='唯讀'),reviewer=users.find(u=>u.id===input.reviewerId&&u.enabled&&u.role==='管理員');if(!assignee||!reviewer||assignee.id===reviewer.id)throw Error('請選擇不同的有效受派人與管理員審核人');const details=workDetails(input,alert);const at=new Date().toISOString();const row={...details,id:'WO-'+crypto.randomUUID().slice(0,8),alertId:alert.id,rackId:alert.rackId,title:alert.title,priority:details.priority,assigneeId:assignee.id,reviewerId:reviewer.id,state:'assigned',revision:0,createdAt:at,updatedAt:at,resolution:'',logs:[{at,actor:'展示操作員',action:'create',note:'由告警 '+alert.id+' 建立並指派'}]};put.run('workorders',row.id,JSON.stringify(row));audit('workorder.created',row.id);return row;});},
 createCapacityWork(input){return transaction(()=>{
 const plan=input.plan;if(!plan||!Array.isArray(plan.placements)||!plan.placements.length||plan.placements.length>33)throw Error('容量方案無效');
 validateRequest(plan.request);if(plan.placements.length!==plan.request.count)throw Error('請先完成全部設備配置後再轉工單');
 let placements=plan.placements.map((p,i)=>{if(!p||typeof p.rackId!=='string'||(plan.request.zone!=='all'&&p.rackId.split('-')[1]!==plan.request.zone))throw Error('機櫃區域與方案不符');return {...plan.request,rackId:p.rackId,uStart:p.uStart,index:i+1};});
 const planName=String(input.name||'').trim();if(!planName||planName.length>100)throw Error('請填寫方案名稱');
 const users=list('users'),assignee=users.find(u=>u.id===input.assigneeId&&u.enabled&&u.role!=='唯讀'),reviewer=users.find(u=>u.id===input.reviewerId&&u.enabled&&u.role==='管理員');if(!assignee||!reviewer||assignee.id===reviewer.id)throw Error('受派人與驗收人必須有效且不同');
 const due=validateDue(input.due);
 const fingerprint=createHash('sha256').update(JSON.stringify(placements.map(p=>[p.rackId,p.uStart,p.uSize,p.powerKw,p.weightKg,p.outlets,p.ports,p.coolingLimitKw??null,p.coolingReservePct??null,p.powerRedundancy??null,p.outletType??'C13',p.networkType??'RJ45',p.zoneCoolingA??null,p.zoneCoolingB??null]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))))).digest('hex');
 const existing=list('workorders').find(w=>w.capacityFingerprint===fingerprint&&!w.cancelledAt);if(existing)return existing;
 const holds=list('reservations');const baseAssets=[...list('assets'),...reservedAssets(holds)];const checked=checkPlan({placements},telemetry().racks,baseAssets);const conflicts=checked.filter(p=>p.issues.length);if(conflicts.length)throw Error('方案衝突：'+conflicts.map(p=>p.rackId+' '+p.issues.join('、')).join('；'));
 assertHeldLimits(holds,[...list('assets'),...placements],telemetry().racks,'',placements.map(p=>p.rackId));
 if(input.reserveCapacity===true)placements=allocatePorts(placements,list('assets'),list('settings').find(x=>x.id==='physical-topology')?.config||{},holds);
 const at=new Date().toISOString(),row={id:'WO-'+crypto.randomUUID().slice(0,8),sourceType:'capacity',capacityFingerprint:fingerprint,capacityPlan:{name:planName,placements,checkedAt:at,assumptions:'既有每設備30kg、2插座、2埠；每櫃1000kg、24插座、48埠；冷卻及備援依配置條件複檢；資源預留狀態請見預留紀錄；驗收時重新檢查並建立資產'},rackId:placements[0].rackId,rackIds:[...new Set(placements.map(p=>p.rackId))],floor:'4F',area:[...new Set(placements.map(p=>p.rackId.split('-')[1]))].join('/'),title:'上架計畫：'+planName,device:'新增設備 '+placements.length+' 台',system:'IT 上架',description:placements.map(p=>`設備 ${p.index}：${p.rackId} U${p.uStart}–${p.uStart+p.uSize-1}，${p.powerKw} kW，${p.weightKg} kg，${p.outlets} 個 ${p.outletType||'C13'} 插座／${p.ports} 個 ${p.networkType||'RJ45'} 網路埠`).join('\n'),priority:'info',reporter:'容量規劃',vendor:'',due,assigneeId:assignee.id,reviewerId:reviewer.id,state:'assigned',revision:0,createdAt:at,updatedAt:at,resolution:'',logs:[{at,actor:'容量規劃',action:'create',note:'方案已與伺服器最新資產比對；新增 '+placements.length+' 台設備。驗收上架時重新檢查並建立資產。'}]};
 if(input.reserveCapacity===true){const hold={id:'RS-'+crypto.randomUUID().slice(0,8),name:planName,workOrderId:row.id,placements,state:'active',revision:0,createdAt:at,createdBy:assignee.id};row.reservationId=hold.id;put.run('reservations',hold.id,JSON.stringify(hold));audit('capacity.reservation.created',hold.id);}
 put.run('workorders',row.id,JSON.stringify(row));audit('capacity.workorder.created',row.id);return row;
 });},
 updateWork(id,action,body){return transaction(()=>{const old=list('workorders').find(w=>w.id===id);if(!old)throw Error('工單不存在');if(action==='capacityCancel'){const actor=list('users').find(u=>u.id===body.actorId&&u.enabled&&u.role==='管理員'),note=String(body.note||'').trim();if(!actor||old.sourceType!=='capacity'||old.state==='closed'||old.installedAssetIds?.length||body.revision!==old.revision||!note||note.length>2000)throw Error('僅管理員可取消未結案上架工單，並須填寫原因及最新版本');const at=new Date().toISOString(),cancelled={...old,state:'closed',cancelledAt:at,updatedAt:at,revision:old.revision+1,resolution:'取消上架：'+note,logs:[...old.logs,{at,actor:actor.name,action:'capacityCancel',note}]};for(const h of list('reservations').filter(h=>h.workOrderId===id&&h.state==='active'))put.run('reservations',h.id,JSON.stringify({...h,state:'released',revision:h.revision+1,endedAt:at,reason:'取消上架：'+note,releasedBy:actor.id}));put.run('workorders',id,JSON.stringify(cancelled));audit('capacity.cancelled',id);return cancelled;}const row=action==='maintenanceReschedule'?rescheduleMaintenance(old,body,list('users'),list('workorders')):advanceWork(old,action,body,list('users'));
 if(action==='approve'&&old.sourceType==='capacity'){
 if(body.installAssets!==true)throw Error('請使用「驗收並建立資產」完成上架工單');
 let placements=old.capacityPlan?.placements;if(!placements?.length||old.installedAssetIds?.length)throw Error('上架配置無效或已完成');
 const assets=list('assets'),conflicts=checkPlan({placements},telemetry().racks,[...assets,...reservedAssets(list('reservations'),id)]).filter(p=>p.issues.length);
 if(conflicts.length)throw Error('驗收上架衝突：'+conflicts.map(p=>p.rackId+' '+p.issues.join('、')).join('；')+'。請退回補件或排除衝突。');
 assertHeldLimits(list('reservations'),[...assets,...placements],telemetry().racks,id,placements.map(p=>p.rackId));
 const activeHold=list('reservations').find(h=>h.workOrderId===id&&h.state==='active');const topology=list('settings').find(x=>x.id==='physical-topology')||{id:'physical-topology',revision:0,config:{}};
 if(!activeHold?.placements.every(p=>p.physicalConnections))placements=allocatePorts(placements,assets,topology.config,list('reservations'),id);
 else placements=activeHold.placements;
 const installed=placements.map((p,i)=>({id:'AS-'+crypto.randomUUID().slice(0,8),name:old.capacityPlan.name+' · 設備 '+(i+1),type:'server',rackId:p.rackId,uStart:p.uStart,uSize:p.uSize,powerKw:p.powerKw,weightKg:p.weightKg,outlets:p.outlets,ports:p.ports,outletType:p.outletType||'C13',networkType:p.networkType||'RJ45',physicalConnections:p.physicalConnections,sourceWorkOrderId:id,installedAt:row.updatedAt,manufacturer:'',model:'',serial:'',owner:'資訊維運組',service:'待設定',warrantyUntil:''}));
 const config=Object.fromEntries(physicalRows(assets,topology.config).map(r=>[r.asset.id,{power:r.power,network:r.network}]));for(const a of installed)config[a.id]=a.physicalConnections;assertPorts([...assets,...installed],config,list('reservations'),id);put.run('settings',topology.id,JSON.stringify({...topology,revision:topology.revision+1,config}));
 for(const asset of installed){validateAsset(asset,assets);assets.push(asset);put.run('assets',asset.id,JSON.stringify(asset));audit('asset.installed',asset.id);}
 const hold=list('reservations').find(r=>r.workOrderId===id&&r.state==='active');if(hold){put.run('reservations',hold.id,JSON.stringify({...hold,state:'consumed',revision:hold.revision+1,endedAt:row.updatedAt}));audit('capacity.reservation.consumed',hold.id);}
 row.installedAssetIds=installed.map(a=>a.id);row.installedAt=row.updatedAt;
 row.logs.push({at:row.updatedAt,actor:list('users').find(u=>u.id===body.actorId).name,action:'install',note:'完成容量複檢並建立資產：'+row.installedAssetIds.join('、')});
 }
 put.run('workorders',id,JSON.stringify(row));audit('workorder.'+action,id);return row;});},
 createRfi(scenario,sourceDemand=null){return transaction(()=>{if(list('rfi').some(r=>!['completed','failed','cancelled'].includes(r.state)))throw Error('請先完成或取消目前情境');const row=createRun(scenario,'RFI-'+crypto.randomUUID().slice(0,8),new Date().toISOString(),sourceDemand);put.run('rfi',row.id,JSON.stringify(row));audit('rfi.created',row.id);return row;});},
 updateRfi(id,action,body){return transaction(()=>{const old=list('rfi').find(r=>r.id===id);if(!old)throw Error('找不到展示情境');if(body.revision!==old.revision)throw Error('情境已更新，請重新載入後再操作');const row=transition(old,action,body);put.run('rfi',id,JSON.stringify(row));audit('rfi.'+action,id);return row;});},
 energySettings:()=>list('settings').find(s=>s.id==='energy')||{id:'energy',...defaultEnergySettings},
 saveEnergySettings(input){return transaction(()=>{const row={id:'energy',...validateEnergySettings(input)};put.run('settings','energy',JSON.stringify(row));audit('energy.settings.updated','4F');return row;});},
 securityLogs:()=>db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 500').all(),
 auditLog:()=>db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 50').all(),
 saveAsset(input,id){return transaction(()=>{if(id&&!list('assets').some(a=>a.id===id))throw Error('找不到資產');const row={...(id?list('assets').find(a=>a.id===id):{}),...input,id:id||`AS-${crypto.randomUUID().slice(0,8)}`,uStart:Number(input.uStart),uSize:Number(input.uSize),powerKw:Number(input.powerKw)};if(row.departmentId&&!list('departments').some(d=>d.id===row.departmentId&&d.enabled))throw Error('請選擇有效且啟用的部門');const previous=list('assets').find(a=>a.id===id);validateAsset(row,[...list('assets'),...reservedAssets(list('reservations'))],id);assertHeldLimits(list('reservations'),[...list('assets').filter(a=>a.id!==id),row],telemetry().racks,'',[row.rackId]);const topo=list('settings').find(x=>x.id==='physical-topology');const cfg={...(topo?.config||{})};if(!previous||previous.rackId!==row.rackId||['outlets','ports','outletType','networkType'].some(k=>previous[k]!==row[k])){delete cfg[row.id];row.physicalConnections=allocatePorts([row],list('assets').filter(a=>a.id!==id),cfg,list('reservations'))[0].physicalConnections;cfg[row.id]=row.physicalConnections;if(topo)put.run('settings',topo.id,JSON.stringify({...topo,revision:topo.revision+1,config:cfg}));}assertPorts([...list('assets').filter(a=>a.id!==id),row],cfg,list('reservations'));put.run('assets',row.id,JSON.stringify(row));audit(id?'asset.updated':'asset.created',row.id);return row;});},
 deleteAsset(id){return transaction(()=>{const r=db.prepare('DELETE FROM records WHERE kind=? AND id=?').run('assets',id);if(!r.changes)throw Error('找不到資產');audit('asset.deleted',id);});},
 ack(id){return transaction(()=>{const a=list('alerts').find(a=>a.id===id);if(!a)throw Error('找不到告警');if(a.state==='active'){a.state='acknowledged';a.acknowledgedAt=new Date().toISOString();a.revision=(a.revision||0)+1;a.logs=[...(a.logs||[]),{at:a.acknowledgedAt,actor:'本地操作員',action:'acknowledge',note:'快捷確認告警'}];put.run('alerts',id,JSON.stringify(a));audit('alert.acknowledged',id);}return a;});},
 saveUser(input,id){return transaction(()=>{if(!input.name?.trim()||!/^\S+@\S+\.\S+$/.test(input.email||''))throw Error('請填寫姓名與有效電子郵件');if(!['管理員','維運','唯讀'].includes(input.role))throw Error('角色無效');if(id&&!list('users').some(u=>u.id===id))throw Error('找不到使用者');if(list('users').some(u=>u.id!==id&&u.email===input.email))throw Error('電子郵件已存在');const row={id:id||`U-${crypto.randomUUID().slice(0,8)}`,name:input.name.trim(),email:input.email,role:input.role,enabled:input.enabled!==false};put.run('users',row.id,JSON.stringify(row));audit('demo-user.saved',row.id);return row;});}
 };
}
