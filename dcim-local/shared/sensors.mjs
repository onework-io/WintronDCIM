export const sensorSystems={power:'電力',ups:'UPS',pdu:'PDU',cooling:'空調',fire:'消防',network:'網通',access:'門禁',environment:'環境'};
export function sensorReadings(t,now=Date.now(),connected=true){
 if(!t)return [];
 const age=now-Date.parse(t.timestamp),fresh=connected&&Number.isFinite(age)&&age>=-5000&&age<15000,rows=[];
 const add=(id,name,system,zone,position,value,unit='',range=null,rackId=null)=>{if(Object.hasOwn(t.sensorOverrides||{},id))value=t.sensorOverrides[id];const valid=typeof value==='number'?Number.isFinite(value):typeof value==='string';const status=!valid?'unknown':!fresh?'stale':(value==='漏水'||value==='離線'||range&&(value<range[0]||value>range[1]))?'alarm':'normal';rows.push({id,name,system,zone,position,rackId,value:valid?value:null,unit,range,status,timestamp:t.timestamp,location:rackId?`${rackId} · ${name}`:`4F ${zone} 區 · ${name}`});};
 for(const r of t.racks||[]){const short=r.id.replace('4F-','');add('TT-'+short,'機櫃進風溫度','environment',r.zone,null,r.temperature,'°C',[18,28],r.id);add('RH-'+short,'機櫃相對濕度','environment',r.zone,null,r.humidity,'% RH',[40,60],r.id);add('PDU-'+short,'機櫃供電功率','pdu',r.zone,null,r.powerKw,'kW',[0,10],r.id);}
 add('PM-4F-V','總表線電壓','power','A',[-7,1.8,-5],t.voltage,'V',[360,400]);add('PM-4F-I','總表電流','power','A',[-7,2.6,-5],t.current,'A',[0,500]);add('PM-4F-KW','設施總功率','power','A',[-7,3.4,-5],t.facilityPower,'kW',[0,300]);
 for(const z of ['A','B']){const a=z==='A',x=a?-5:-31,zp=a?-5:5;
 add('UPS-'+z+'-BAT','UPS 電池電量','ups',z,[x,2,zp],t.batteryPercent,'%',[20,100]);add('UPS-'+z+'-RT','UPS 預估續航','ups',z,[x,3,zp],t.upsRuntimeMinutes,'min',[10,240]);
 const rack=(t.racks||[]).find(r=>r.id===`4F-${z}-01`);
 add('AC-'+z+'-SAT','空調送風溫度','cooling',z,[a?-2.8:-27.7,2,a?-7.6:7.5],rack?.temperature===undefined?null:+(rack.temperature-2).toFixed(1),'°C',[16,26]);
 add('AC-'+z+'-RAT','空調回風溫度','cooling',z,[a?7.2:-9.6,2,a?-7.6:7.5],rack?.temperature===undefined?null:+(rack.temperature+6).toFixed(1),'°C',[20,35]);
 add('WL-'+z+'-01','冷通道漏水','environment',z,[a?2:-18,.25,a?-4:7.5],'乾燥');add('SD-'+z+'-01','煙霧偵測','fire',z,[a?2:-18,3.2,a?-5:5],'正常');add('CR-'+z+'-01','機房門磁','access',z,[a?-3.7:-28.5,1.5,a?-2:8],'關閉');
 add('SW-'+z+'-LINK','交換器連線','network',z,null,'連線','',null,`4F-${z}-01`);
 }
 return rows;
}
export const sensorStatus={normal:'正常',alarm:'超限',stale:'資料過期／離線',unknown:'無資料'};
export function sensorValue(s){return s?.value==null?'—':`${s.value}${s.unit?' '+s.unit:''}`;}
