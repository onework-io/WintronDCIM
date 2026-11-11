import {workSla,defaultSla} from './work-sla.mjs';
export function slaNotices(work,settings=defaultSla,now=Date.now()){
 if(work.state==='closed')return [];
 const s=workSla(work,settings,now);if(s.status==='unknown')return [];
 return [['response',s.responseDeadline,s.responseHours===null],['resolve',s.resolveDeadline,true]].filter(([,deadline,pending])=>pending&&deadline-now<=2*3600000).map(([phase,deadline])=>{
 const late=now>deadline,escalated=now-deadline>=2*3600000;
 const stage=escalated?'escalated':late?'breached':'soon';
 return {phase,deadline,stage,kind:'sla',label:`SLA ${phase==='response'?'回應':'結案'}${escalated?'超時升級':late?'超時':'即將到期'}`,priority:escalated?4:late?3:2,lateHours:Math.max(0,(now-deadline)/3600000)};
 });
}
