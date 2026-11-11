import {slaNotices} from '../shared/sla-notifications.mjs';
import {defaultSla} from '../shared/work-sla.mjs';
export function slaEventMethods({list,put,transaction,audit}){
 const users=()=>list('users');
 const viewer=id=>{const u=users().find(u=>u.id===id&&u.enabled);if(!u)throw Error('請選擇有效人員');return u;};
 const visible=(row,u)=>u.role==='管理員'||row.recipientIds.includes(u.id);
 return {
 syncSlaEvents(at=new Date().toISOString()){return transaction(()=>{const now=Date.parse(at);if(!Number.isFinite(now))throw Error('無效檢查時間');const cfg=list('settings').find(s=>s.id==='work-sla'),rules=cfg?.rules||defaultSla,existing=list('slaEvents'),active=new Set();let changes=0;
 const save=r=>{put.run('slaEvents',r.id,JSON.stringify(r));changes++;};
 for(const w of list('workorders'))for(const notice of slaNotices(w,rules,now)){
 const key=JSON.stringify([w.id,notice.phase,notice.deadline]);active.add(key);const row=existing.find(r=>r.key===key&&r.state==='active');
 const recipient=notice.phase==='response'?w.assigneeId:w.state==='review'?w.reviewerId:w.assigneeId;
 if(!row){const r={id:'SLA-'+crypto.randomUUID(),key,workOrderId:w.id,title:w.title,rackId:w.rackId,phase:notice.phase,deadline:new Date(notice.deadline).toISOString(),stage:notice.stage,state:'active',firstObservedAt:at,lastChangedAt:at,ruleRevision:cfg?.revision||0,recipientIds:[recipient].filter(Boolean),currentRecipientId:recipient,revision:0,acknowledgedAt:null,logs:[{at,action:'observed',stage:notice.stage,note:'首次觀察到此 SLA 狀態'}]};save(r);audit('sla.event.observed',r.id);}
 else if(row.stage!==notice.stage||row.currentRecipientId!==recipient){const r=structuredClone(row);if(r.stage!==notice.stage){r.stage=notice.stage;r.acknowledgedAt=null;r.logs.push({at,action:'stage',stage:notice.stage,note:'SLA 狀態變更，需重新確認'});}if(r.currentRecipientId!==recipient){r.currentRecipientId=recipient;r.recipientIds=[...new Set([...r.recipientIds,recipient].filter(Boolean))];r.acknowledgedAt=null;r.logs.push({at,action:'reassigned',note:'通知對象更新為 '+recipient});}r.revision++;r.lastChangedAt=at;save(r);audit('sla.event.updated',r.id);}
 }
 for(const old of existing.filter(r=>r.state==='active'&&!active.has(r.key))){const w=list('workorders').find(w=>w.id===old.workOrderId);const reason=!w?'工單已不存在':w.state==='closed'?'工單已結案':old.phase==='response'&&(w.logs||[]).some(l=>l.action==='start')?'已開始處理，回應目標停止追蹤':'期限或規則變更，不再符合此提醒';const r={...old,state:'ended',endedAt:at,lastChangedAt:at,endReason:reason,revision:old.revision+1,logs:[...old.logs,{at,action:'ended',note:reason}]};save(r);audit('sla.event.ended',r.id);}
 return changes;});},
 slaEvents(userId){const u=viewer(userId);return list('slaEvents').filter(r=>visible(r,u)).sort((a,b)=>b.lastChangedAt.localeCompare(a.lastChangedAt));},
 acknowledgeSlaEvent(id,body){return transaction(()=>{const u=viewer(body.actorId),old=list('slaEvents').find(r=>r.id===id);if(!old||!visible(old,u))throw Error('事件不存在或無權查看');if(u.role==='唯讀'||(u.role!=='管理員'&&u.id!==old.currentRecipientId))throw Error('僅目前處理人員或管理員可確認');if(old.state!=='active')throw Error('此追蹤已結束');if(old.revision!==body.revision)throw Error('事件已變更，請重新整理');const note=String(body.note||'').trim();if(!note||note.length>1000)throw Error('請填寫 1–1000 字處理說明');if(old.acknowledgedAt)throw Error('本階段已確認');const at=new Date().toISOString(),r={...old,acknowledgedAt:at,revision:old.revision+1,lastChangedAt:at,logs:[...old.logs,{at,action:'acknowledged',actor:u.name,actorId:u.id,note}]};put.run('slaEvents',id,JSON.stringify(r));audit('sla.event.acknowledged',id);return r;});}
 };
}
