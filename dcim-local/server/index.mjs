import {handleApi} from './api.mjs';
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
  if(p.startsWith('/api/'))return await handleApi(req,res,{store,telemetry,streams,port});
  if(req.method!=='GET')return send(res,405,{error:'Method not allowed'});
  const dist=resolve(root,'dist');let file=resolve(dist,'.'+decodeURIComponent(p));if(file!==dist&&!file.startsWith(dist+'/'))return send(res,403,{error:'路徑不允許'});
  if(!existsSync(file)||statSync(file).isDirectory())file=resolve(dist,'index.html');
  if(!existsSync(file))return send(res,404,{error:'開發介面位於 http://127.0.0.1:5173；正式版請先 npm run build'});
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(readFileSync(file));
 }catch(e){send(res,400,{error:e.message||'操作失敗'});}
});server.listen(port,'127.0.0.1',()=>console.log(`AIDC API / local app: http://127.0.0.1:${port}`));
process.on('SIGTERM',()=>{clearInterval(timer);clearInterval(inspectionTimer);clearInterval(slaTimer);for(const r of streams)r.end();server.close(()=>{store.db.close();process.exit(0);});});
