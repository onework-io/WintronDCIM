import {validDate,taipeiDate} from './lifecycle.mjs';
import {validateWindow,windowConflicts} from './maintenance-window.mjs';
export function maintenanceCalendar(plans,start=taipeiDate()){
 if(!validDate(start))throw Error('請選擇有效的起始日期');
 const scheduled=plans.filter(p=>{try{return validateWindow(p.window).minutes!==null;}catch{return false;}});
 const dayAt=n=>new Date(Date.parse(start+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
 return {unscheduled:plans.length-scheduled.length,days:Array.from({length:7},(_,i)=>{const date=dayAt(i),from=date+'T00:00',to=dayAt(i+1)+'T00:00';return {date,entries:scheduled.filter(p=>p.window.start<to&&p.window.end>from).sort((a,b)=>a.window.start.localeCompare(b.window.start)||a.id.localeCompare(b.id)).map(p=>({...p,from:p.window.start<from?from:p.window.start,to:p.window.end>to?to:p.window.end,continuesBefore:p.window.start<from,continuesAfter:p.window.end>to,conflicts:windowConflicts(p.window,p.racks,scheduled.filter(x=>x.id!==p.id)).map(x=>x.id)}))};})};
}
