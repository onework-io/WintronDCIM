import {demoEnergyHistory} from '../shared/energy.mjs';
import { createServer } from 'node:http';
import { readFileSync,existsSync,statSync } from 'node:fs';
import { resolve,extname,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.mjs';
import { telemetry as baseTelemetry,systems } from './domain.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const store=createStore(process.env.DCIM_DB||resolve(root,'data/dcim.sqlite'));const port=Number(process.env.PORT||3001);const streams=new Set();
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const telemetry=()=>({...baseTelemetry(),sensorOverrides:store.sensorRuleOverrides()});
const broadcast=()=>{const sample=telemetry();try{if((store.processAlertTelemetry(sample)||0)+store.processSensorRules(sample))sample.alertEvents=store.list('alerts');}catch(e){console.error('Alert rule:',e.message);}for(const r of streams)r.write(`data: ${JSON.stringify(sample)}\n\n`);};
const timer=setInterval(broadcast,3000);timer.unref();
const dispatch=()=>{try{store.dispatchInspections();}catch(e){console.error('Inspection scheduler:',e.message);}};
dispatch();const inspectionTimer=setInterval(dispatch,60000);inspectionTimer.unref();
const syncSla=()=>{try{store.syncSlaEvents();}catch(e){console.error('SLA tracker:',e.message);}};
syncSla();const slaTimer=setInterval(syncSla,30000);slaTimer.unref();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.glb':'model/gltf-binary','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');
 const host=req.headers.host||'';if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))return send(res,403,{error:'此 MVP 僅限本地存取'});
 const url=new URL(req.url,`http://${host}`);const p=url.pathname;
 try{
  if(req.method==='GET'&&p==='/api/department-transfers')return send(res,200,store.list('departmentTransfers').sort((a,b)=>b.at.localeCompare(a.at)));
  if(req.method==='GET'&&p==='/api/sla-events'){store.syncSlaEvents();return send(res,200,store.slaEvents(url.searchParams.get('userId')));}
  if(req.method==='GET'&&p==='/api/notifications')return send(res,200,store.notifications(url.searchParams.get('userId')));
  const evidence=p.match(/^\/api\/inspection-evidence\/(IE-[a-f0-9-]+)$/);
  if(req.method==='GET'&&evidence){const file=store.list('inspectionEvidence').find(f=>f.id===evidence[1]);if(!file)return send(res,404,{error:'附件不存在'});res.writeHead(200,{'Content-Type':file.mime,'Content-Length':file.size,'Cache-Control':'no-store','Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(file.name)}`});res.end(Buffer.from(file.data,'base64'));return;}
  if(req.method==='GET'&&p==='/api/inspections/schedules')return send(res,200,store.list('inspectionSchedules'));
  if(req.method==='GET'&&p==='/api/inspections/templates')return send(res,200,store.inspectionTemplates());
  if(req.method==='GET'&&p==='/api/inspections')return send(res,200,store.list('inspections'));
  if(req.method==='GET'&&p==='/api/capacity/snapshot')return send(res,200,{assets:store.list('assets'),racks:telemetry().racks,reservations:store.list('reservations')});
  if(req.method==='GET'&&p==='/api/workorders')return send(res,200,store.list('workorders'));
  if(req.method==='GET'&&p==='/api/alert-rules/live')return send(res,200,store.liveAlertStatus());
  if(req.method==='GET'&&p==='/api/sensor-rules')return send(res,200,store.sensorRules());
  if(req.method==='GET'&&p==='/api/topology/connections')return send(res,200,store.physicalTopology());
  if(req.method==='GET'&&p==='/api/topology/mappings')return send(res,200,store.topologyMappings());
  if(req.method==='GET'&&p==='/api/settings/sla')return send(res,200,store.slaSettings());
  if(req.method==='GET'&&p==='/api/security-logs')return send(res,200,store.securityLogs());
  if(req.method==='GET'&&p==='/api/health')return send(res,200,{ok:true,mode:'simulation',storage:'SQLite',localOnly:true});
  if(req.method==='GET'&&p==='/api/bootstrap')return send(res,200,{assets:store.list('assets'),departments:store.list('departments'),alerts:store.list('alerts'),users:store.list('users'),systems,energySettings:store.energySettings(),energyHistory:demoEnergyHistory(),telemetry:telemetry(),audit:store.auditLog()});
  if(req.method==='GET'&&p==='/api/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(`data: ${JSON.stringify(telemetry())}\n\n`);streams.add(res);req.on('close',()=>streams.delete(res));return;}
  if(req.method==='GET'&&p==='/api/rfi')return send(res,200,store.list('rfi').sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));
  if(req.method==='GET'&&p==='/api/telemetry')return send(res,200,telemetry());
  if(['POST','PATCH','DELETE'].includes(req.method)){
   const origin=req.headers.origin;
   if(origin&&!['http://127.0.0.1:5173','http://localhost:5173',`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(origin))return send(res,403,{error:'來源不允許'});
   const bodyLimit=/^\/api\/inspections\/[^/]+\/evidence$/.test(p)?2900000:100000;
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>bodyLimit)return send(res,413,{error:'資料過大'});}
   const body=raw?JSON.parse(raw):{};
   const slaEvent=p.match(/^\/api\/sla-events\/([^/]+)\/ack$/);if(req.method==='POST'&&slaEvent){store.syncSlaEvents();return send(res,200,store.acknowledgeSlaEvent(slaEvent[1],body));}
   if(req.method==='POST'&&p==='/api/department-transfers')return send(res,200,store.transferDepartmentAssets(body));
   if(req.method==='POST'&&p==='/api/departments')return send(res,200,store.saveDepartment(body));
   if(req.method==='POST'&&p==='/api/recommendations/adopt')return send(res,200,store.adoptRecommendation(body));
   if(req.method==='POST'&&p==='/api/notifications/read')return send(res,200,store.readNotifications(body));
   if(req.method==='POST'&&p==='/api/inspections/schedules')return send(res,200,store.saveInspectionSchedule(body));
   if(req.method==='POST'&&p==='/api/inspections/templates')return send(res,200,store.saveInspectionTemplate(body));
   if(req.method==='POST'&&p==='/api/inspections')return send(res,201,store.createInspection(body));
   const inspection=p.match(/^\/api\/inspections\/([^/]+)\/([^/]+)$/);if(inspection&&req.method==='POST')return send(res,200,store.updateInspection(inspection[1],inspection[2],body));
   const reservation=p.match(/^\/api\/capacity\/reservations\/([^/]+)\/release$/);if(req.method==='POST'&&reservation)return send(res,200,store.releaseReservation(reservation[1],body));
   const lifecycle=p.match(/^\/api\/alerts\/([^/]+)\/lifecycle\/([^/]+)$/);if(lifecycle&&req.method==='POST')return send(res,200,store.updateAlert(lifecycle[1],lifecycle[2],body));
   if(req.method==='POST'&&p==='/api/alert-rules/live')return send(res,200,store.saveLiveAlertRule(body));
   if(req.method==='POST'&&p==='/api/maintenance/workorder')return send(res,201,store.createMaintenanceWork(body));
   if(req.method==='POST'&&p==='/api/capacity/workorder')return send(res,201,store.createCapacityWork(body));
   if(req.method==='POST'&&p==='/api/workorders')return send(res,201,store.createWork(body));
   const outcome=p.match(/^\/api\/recommendations\/([^/]+)\/outcomes$/);if(outcome&&req.method==='POST')return send(res,200,store.recordRecommendationOutcome(outcome[1],body));
   const work=p.match(/^\/api\/workorders\/([^/]+)\/([^/]+)$/);if(work&&req.method==='POST')return send(res,200,store.updateWork(work[1],work[2],body));
   if(req.method==='POST'&&p==='/api/rfi')return send(res,201,store.createRfi(body.scenario,body.sourceDemand));
   const rfi=p.match(/^\/api\/rfi\/([^/]+)\/([^/]+)$/);if(rfi&&req.method==='POST')return send(res,200,store.updateRfi(rfi[1],rfi[2],body));
   if(req.method==='POST'&&p==='/api/sensor-rules')return send(res,200,store.saveSensorRule(body));
   if(req.method==='POST'&&p==='/api/sensor-rules/scenario')return send(res,200,store.injectSensorRule(body));
   if(req.method==='POST'&&p==='/api/topology/connections')return send(res,200,store.savePhysicalTopology(body));
   if(req.method==='POST'&&p==='/api/topology/mappings')return send(res,200,store.saveTopologyMapping(body));
   if(req.method==='POST'&&p==='/api/settings/sla')return send(res,200,store.saveSlaSettings(body));
   if(req.method==='PATCH'&&p==='/api/settings/energy')return send(res,200,store.saveEnergySettings(body));
   if(req.method==='POST'&&p==='/api/assets')return send(res,201,store.saveAsset(body));
   let m=p.match(/^\/api\/assets\/([^/]+)$/);
   if(m&&req.method==='PATCH')return send(res,200,store.saveAsset(body,decodeURIComponent(m[1])));
   if(m&&req.method==='DELETE'){store.deleteAsset(decodeURIComponent(m[1]));return send(res,200,{ok:true});}
   m=p.match(/^\/api\/alerts\/([^/]+)\/ack$/);if(m&&req.method==='POST')return send(res,200,store.ack(m[1]));
   if(req.method==='POST'&&p==='/api/users')return send(res,201,store.saveUser(body));
   m=p.match(/^\/api\/users\/([^/]+)$/);if(m&&req.method==='PATCH')return send(res,200,store.saveUser(body,m[1]));
  }
  if(p.startsWith('/api/'))return send(res,404,{error:'找不到此 API'});
  if(req.method!=='GET')return send(res,405,{error:'Method not allowed'});
  const dist=resolve(root,'dist');let file=resolve(dist,'.'+decodeURIComponent(p));if(file!==dist&&!file.startsWith(dist+'/'))return send(res,403,{error:'路徑不允許'});
  if(!existsSync(file)||statSync(file).isDirectory())file=resolve(dist,'index.html');
  if(!existsSync(file))return send(res,404,{error:'開發介面位於 http://127.0.0.1:5173；正式版請先 npm run build'});
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(readFileSync(file));
 }catch(e){send(res,400,{error:e.message||'操作失敗'});}
});server.listen(port,'127.0.0.1',()=>console.log(`AIDC API / local app: http://127.0.0.1:${port}`));
process.on('SIGTERM',()=>{clearInterval(timer);clearInterval(inspectionTimer);clearInterval(slaTimer);for(const r of streams)r.end();server.close(()=>{store.db.close();process.exit(0);});});
