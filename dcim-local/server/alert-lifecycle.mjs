export function alertLifecycleMethods({list,put,transaction,audit}){return {updateAlert(id,action,body){return transaction(()=>{
 const old=list('alerts').find(a=>a.id===id);if(!old)throw Error('找不到告警');if((old.revision||0)!==body.revision)throw Error('告警已更新，請重新載入');
 const actor=list('users').find(u=>u.id===body.actorId&&u.enabled&&u.role!=='唯讀');if(!actor)throw Error('請選擇有效維運人員');const note=String(body.note||'').trim();if(!note||note.length>2000)throw Error('請填寫 2000 字內處置說明');
 const row=structuredClone(old),at=new Date().toISOString();
 if(action==='acknowledge'){if(old.state!=='active')throw Error('僅待確認告警可確認');row.state='acknowledged';row.acknowledgedAt=at;}
 else if(action==='resolve'){if(['temperature-rule','sensor-rule'].includes(old.source)&&old.signalState!=='recovered')throw Error('訊號尚未復歸，無法處置結案');if(actor.role!=='管理員'||old.state!=='acknowledged')throw Error('僅管理員可將已確認告警處置結案');if(list('workorders').some(w=>w.alertId===id&&w.state!=='closed'))throw Error('關聯工單尚未結案，請先完成工單');row.state='resolved';row.resolvedAt=at;}
 else if(action==='reopen'){if(actor.role!=='管理員'||old.state!=='resolved')throw Error('僅管理員可重新開啟已結案告警');row.state='active';row.reopenedAt=at;}
 else if(action!=='comment'||old.state==='resolved')throw Error('此狀態無法新增處置紀錄');
 row.revision=(old.revision||0)+1;row.updatedAt=at;row.logs=[...(old.logs||[]),{at,actor:actor.name,action,note}];put.run('alerts',id,JSON.stringify(row));audit('alert.'+action,id);return row;
 });}};}
