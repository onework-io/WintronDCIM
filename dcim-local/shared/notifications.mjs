import {slaNotices} from './sla-notifications.mjs';
import {defaultSla} from './work-sla.mjs';
import {taipeiDate} from './inspection-reports.mjs';
export function notificationFeed({inspections,workorders,users,reads=[],slaSettings=defaultSla},userId,now=new Date()){
 const user=users.find(u=>u.id===userId&&u.enabled);if(!user)throw Error('請選擇有效使用者');
 const today=taipeiDate(now.toISOString()),out=[];
 const add=(r,type,kind,label,priority)=>{const id=[type,r.id,kind,r.due||''].join(':');const read=reads.find(x=>x.userId===userId&&x.notificationId===id);out.push({id,type,targetId:r.id,title:r.title,rackId:r.rackId,kind,label,priority,due:r.due||'',readAt:read?.readAt||null});};
 for(const r of inspections){if(user.role!=='管理員'&&r.assigneeId!==userId)continue;
 if(r.state==='completed'){if(!r.workOrderId&&r.items.some(i=>i.result==='abnormal'))add(r,'inspection','abnormal','巡檢異常待轉工單',2);continue;}
 if(r.due&&r.due<today)add(r,'inspection','overdue','巡檢逾期',3);
 else if(r.due===today)add(r,'inspection','due','巡檢今日到期',2);
 else if(r.state==='pending')add(r,'inspection','pending','巡檢待執行',1);
 }
 for(const r of workorders){if(r.state==='closed')continue;
 for(const notice of slaNotices(r,slaSettings,now.getTime())){const recipient=notice.phase==='response'?r.assigneeId:(r.state==='review'?r.reviewerId:r.assigneeId);if(user.role!=='管理員'&&recipient!==userId)continue;const id=['workorder',r.id,'sla',notice.phase,notice.stage,notice.deadline].join(':');const read=reads.find(x=>x.userId===userId&&x.notificationId===id);out.push({...notice,id,type:'workorder',targetId:r.id,title:r.title,rackId:r.rackId,due:new Date(notice.deadline).toISOString(),readAt:read?.readAt||null});}
 const target=r.state==='review'?r.reviewerId:r.assigneeId;if(user.role!=='管理員'&&target!==userId)continue;
 if(r.due&&r.due<today)add(r,'workorder','overdue','工單逾期',3);
 else if(r.state==='review')add(r,'workorder','review','工單待驗收',2);
 else if(r.due===today)add(r,'workorder','due','工單今日到期',2);
 else if(r.state==='assigned')add(r,'workorder','assigned','工單待處理',1);
 }
 return out.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
}
