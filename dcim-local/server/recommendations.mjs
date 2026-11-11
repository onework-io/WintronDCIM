import {validateOutcome} from '../shared/recommendation-outcome.mjs';
import {recommendations} from '../shared/recommendations.mjs';
import {validateDue} from '../shared/workorders.mjs';
export function recommendationMethods({list,put,transaction,audit}){return {recordRecommendationOutcome(id,body){return transaction(()=>{
 const row=list('workorders').find(w=>w.id===id);if(!row||row.sourceType!=='recommendation'||row.state!=='closed')throw Error('僅已結案的建議工單可記錄成效');
 const actor=list('users').find(u=>u.id===body.actorId&&u.enabled&&u.role!=='唯讀');if(!actor||!(actor.role==='管理員'||actor.id===row.assigneeId||actor.id===row.reviewerId))throw Error('請由工單承辦或管理員記錄成效');
 if(body.revision!==row.revision)throw Error('工單已更新，請重新整理');if((row.outcomes||[]).length>=20)throw Error('每張工單最多 20 筆成效紀錄');
 const outcome={...validateOutcome(body),id:'OC-'+crypto.randomUUID(),recordedAt:new Date().toISOString(),recordedBy:actor.name};row.outcomes=[...(row.outcomes||[]),outcome];row.revision++;row.updatedAt=outcome.recordedAt;
 put.run('workorders',id,JSON.stringify(row));audit('recommendation.outcome.recorded',id);return row;
 });},adoptRecommendation(body){return transaction(()=>{
 const recommendation=recommendations.find(r=>r.id===body.recommendationId),run=list('rfi').find(r=>r.id===body.runId);
 if(!recommendation||!run)throw Error('建議或來源事件不存在');
 const actor=list('users').find(u=>u.id===body.actorId&&u.enabled&&u.role!=='唯讀');if(!actor)throw Error('請選擇有效採納人員');
 const existing=list('workorders').find(w=>w.sourceType==='recommendation'&&w.recommendationId===recommendation.id&&w.runId===run.id);if(existing)return existing;
 const owner=list('users').find(u=>u.id===body.assigneeId&&u.enabled&&u.role!=='唯讀'),reviewer=list('users').find(u=>u.id===body.reviewerId&&u.enabled&&u.role==='管理員');
 if(!owner||!reviewer||owner.id===reviewer.id)throw Error('請指定不同的有效受派人及管理員驗收人');
 const at=new Date().toISOString(),row={id:'WO-'+crypto.randomUUID().slice(0,8),sourceType:'recommendation',recommendationId:recommendation.id,runId:run.id,recommendationSnapshot:{...recommendation,runState:run.state,runRevision:run.revision,adoptedAt:at,adoptedBy:actor.name},title:'建議採納：'+recommendation.title,description:recommendation.basis+'\n\n建議處置：'+recommendation.advice,device:recommendation.device,rackId:'4F-'+recommendation.area,floor:'4F',area:recommendation.area,system:recommendation.system,priority:'warning',reporter:actor.name,vendor:'',due:validateDue(body.due),assigneeId:owner.id,reviewerId:reviewer.id,state:'assigned',revision:0,createdAt:at,updatedAt:at,resolution:'',logs:[{at,actor:actor.name,action:'create',note:'採納固定分析建議；來源事件 '+run.id+'，未執行設備控制'}]};
 put.run('workorders',row.id,JSON.stringify(row));audit('recommendation.adopted',row.id);return row;
 });}};}
