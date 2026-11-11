import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import {createStoreFromDatabase} from '../server/store-core.mjs';
import {handleApi} from '../server/api.mjs';
import {telemetry as baseTelemetry} from '../server/domain.mjs';
import {adaptDatabase,openArchive,archiveRequest} from './database.mjs';
export async function installDemoRuntime(){
 const SQL=await initSqlJs({locateFile:()=>wasmUrl});
 const archive=await openArchive();
 let session=sessionStorage.getItem('dcim-public-session');
 if(!session){session=crypto.randomUUID();sessionStorage.setItem('dcim-public-session',session);}
 const bytes=await archiveRequest(archive,session);
 const database=new SQL.Database(bytes||undefined),store=createStoreFromDatabase(adaptDatabase(database));
 const persist=()=>archiveRequest(archive,session,database.export());
 const telemetry=()=>({...baseTelemetry(),sensorOverrides:store.sensorRuleOverrides()});
 store.dispatchInspections();store.syncSlaEvents();await persist();
 const originalFetch=window.fetch.bind(window),OriginalEventSource=window.EventSource;
 let queue=Promise.resolve();
 window.fetch=(input,options)=>{
  const url=new URL(input instanceof Request?input.url:String(input),location.href);
  if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))return originalFetch(input,options);
  const task=async()=>{
   const request=new Request(url,input instanceof Request?input:undefined);
   const method=(options?.method||request.method).toUpperCase();
   const body=options?.body??(['GET','HEAD'].includes(method)?'':await request.text());
   const req={url:url.pathname+url.search,method,headers:{},async *[Symbol.asyncIterator](){if(body)yield body;}};
   let status=200,headers={},payload;
   const res={writeHead(s,h){status=s;headers=h;},end(value){payload=value;}};
   await handleApi(req,res,{store,telemetry,streams:new Set(),port:0,publicDemo:true});
   if(!['GET','HEAD'].includes(method)||url.pathname==='/api/sla-events'){
    try{await persist();}catch(error){return Response.json({error:'瀏覽器儲存空間不足，變更尚未持久保存。請釋放空間後重試。'},{status:507});}
   }
   return new Response(payload,{status,headers});
  };
  const response=queue.then(task);queue=response.catch(()=>{});return response;
 };
 class DemoEvents extends EventTarget{
  constructor(){super();this.readyState=0;this.closed=false;
   const emit=()=>{if(this.closed)return;try{const sample=telemetry();store.processAlertTelemetry(sample);store.processSensorRules(sample);sample.alertEvents=store.list('alerts');const event=new MessageEvent('message',{data:JSON.stringify(sample)});this.onmessage?.(event);this.dispatchEvent(event);}catch(error){this.onerror?.(new Event('error'));}};
   queueMicrotask(()=>{if(this.closed)return;this.readyState=1;this.onopen?.(new Event('open'));emit();});this.timer=setInterval(emit,3000);
  }
  close(){this.closed=true;this.readyState=2;clearInterval(this.timer);}
 }
 window.EventSource=class extends DemoEvents{constructor(url,options){if(new URL(url,location.href).pathname!=='/api/events')return new OriginalEventSource(url,options);super();}};
 setInterval(()=>{queue=queue.then(async()=>{store.dispatchInspections();store.syncSlaEvents();await persist();}).catch(error=>console.error('展示資料儲存失敗',error));},30000);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persist().catch(console.error);});
}
