export const workStates={assigned:'已指派',working:'處理中',review:'待審核',closed:'已結案'};
export function advanceWork(old,action,body,users){
 if(body.revision!==old.revision)throw Error('工單已更新，請重新載入');
 const actor=users.find(u=>u.id===body.actorId&&u.enabled);if(!actor)throw Error('請選擇有效處理人員');
 const row=structuredClone(old);let note=String(body.note||'').trim();
 if(note.length>2000)throw Error('紀錄不可超過 2000 字');
 if(['maintenanceApprove','maintenanceReject','maintenanceResubmit'].includes(action)){
  if(old.sourceType!=='maintenance'||old.state!=='assigned'||!note)throw Error('僅待執行維護工單可進行作業審核，並須填寫意見');
  const status=old.maintenanceApproval?.state||'pending';
  if(action==='maintenanceResubmit'){
   if(status!=='rejected'||actor.id!==old.assigneeId)throw Error('僅受派人可重新送審退回的維護計畫');
   row.maintenanceApproval={state:'pending',submittedAt:new Date().toISOString(),submittedBy:actor.id,note};
  }else{
   if(status!=='pending'||actor.id!==old.reviewerId||actor.role!=='管理員')throw Error('僅指定管理員可審核待核准的維護計畫');
   row.maintenanceApproval={state:action==='maintenanceApprove'?'approved':'rejected',at:new Date().toISOString(),actorId:actor.id,note};
  }
 }
 else if(action==='start'){if(old.sourceType==='maintenance'&&old.maintenanceApproval?.state!=='approved')throw Error('維護計畫須經主管核准後才能開始處理');if(old.state!=='assigned'||actor.id!==old.assigneeId)throw Error('僅受派人可開始此工單');row.state='working';}
 else if(action==='submit'){if(old.state!=='working'||actor.id!==old.assigneeId||!note)throw Error('受派人需填寫處理結果後送審');row.state='review';row.resolution=note;}
 else if(action==='approve'||action==='reject'){if(old.state!=='review'||actor.id!==old.reviewerId||!note)throw Error('審核人需填寫意見');row.state=action==='approve'?'closed':'working';}
 else if(action==='reassign'){
  if(actor.role!=='管理員'||!['assigned','working'].includes(old.state)||!note)throw Error('管理員需填寫原因，且僅能重新指派未送審工單');
  const next=users.find(u=>u.id===body.assigneeId&&u.enabled&&u.role!=='唯讀'&&u.id!==old.reviewerId);
  if(!next||next.id===old.assigneeId)throw Error('請選擇不同的有效受派人，且不可與驗收人相同');
  note=`受派人：${users.find(u=>u.id===old.assigneeId)?.name||old.assigneeId} → ${next.name}。${note}`;
  row.assigneeId=next.id;row.state='assigned';row.resolution='';if(old.sourceType==='maintenance')row.maintenanceApproval={state:'pending',note:'重新派工後須重新核准'};
 }
 else if(action==='schedule'){
  if(actor.role!=='管理員'||old.state==='closed'||!note)throw Error('僅管理員可調整未結案工單期限，並需填寫原因');
  const due=validateDue(body.due);if(due===(old.due||''))throw Error('完成期限未變更');
  note=`完成期限：${old.due||'未指定'} → ${due||'未指定'}。${note}`;row.due=due;
 }
 else if(action==='comment'){
  if(old.state==='closed'||!note||!(actor.role==='管理員'||[old.assigneeId,old.reviewerId].includes(actor.id)))throw Error('請由工單處理人員填寫未結案工單紀錄');
 }
 else throw Error('未知工單操作');
 row.revision++;row.updatedAt=new Date().toISOString();row.logs.push({at:row.updatedAt,actor:actor.name,action,note});return row;
}

export function workDetails(input,alert){
 const text=(key,fallback,max=2000)=>{const value=String(input[key]??fallback).trim();if(!value||value.length>max)throw Error('請填寫有效的報修資料：'+key);return value;};
 const priority=input.priority||alert.severity;if(!['critical','warning','info'].includes(priority))throw Error('優先級無效');
 const due=validateDue(input.due);
 return {floor:'4F',area:alert.rackId?.split('-')[1]||'',device:text('device',alert.rackId,120),system:text('system','環控',40),description:text('description',alert.title),reporter:text('reporter','展示操作員',80),vendor:String(input.vendor||'').trim().slice(0,120),due,priority};
}

export function validateDue(value){
 const due=String(value??'');
 if(due&&(!/^\d{4}-\d{2}-\d{2}$/.test(due)||!Number.isFinite(Date.parse(due))||new Date(due).toISOString().slice(0,10)!==due))throw Error('完成日期無效');
 return due;
}
export const workActions={capacityCancel:'取消上架並釋放預留',maintenanceReschedule:'變更維護時段',maintenanceApprove:'核准維護作業',maintenanceReject:'退回維護計畫',maintenanceResubmit:'重新送審維護計畫',install:'建立上架資產',create:'報修登記／主管派工',start:'開始維修',submit:'提交驗收',reject:'退回補件',approve:'驗收結案',reassign:'重新派工',schedule:'調整期限',comment:'處理紀錄'};
export function workCsv(rows,users){
 const name=id=>users.find(u=>u.id===id)?.name||id;
 const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,m=>"'"+m).replace(/"/g,'""')+'"';
 return '\ufeff'+[['工單編號','設備','內容','狀態','受派人','驗收人','完成期限','更新時間'],...rows.map(w=>[w.id,w.rackId,w.title,workStates[w.state],name(w.assigneeId),name(w.reviewerId),w.due||'',w.updatedAt])].map(r=>r.map(cell).join(',')).join('\r\n');
}
