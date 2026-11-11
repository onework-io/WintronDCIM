import {validateEvidence} from './inspection-evidence.mjs';
import {scheduleMethods} from './inspection-schedules.mjs';
import {defaultInspectionTemplate,validateTemplate} from '../shared/inspection-templates.mjs';
import {validateDue} from '../shared/workorders.mjs';
export function inspectionMethods({list,put,transaction,audit}){
 const user=id=>list('users').find(u=>u.id===id&&u.enabled&&u.role!=='唯讀');
 const save=row=>{put.run('inspections',row.id,JSON.stringify(row));return row;};
 function create(body){
 const asset=list('assets').find(a=>a.id===body.assetId),owner=user(body.assigneeId);
 if(!asset||!owner)throw Error('請選擇有效資產與巡檢人員');
 const title=String(body.title||'').trim();if(!title||title.length>100)throw Error('請填寫 100 字內任務名稱');
 const template=!body.templateId||body.templateId==='default'?defaultInspectionTemplate:list('inspectionTemplates').find(t=>t.id===body.templateId&&t.enabled);if(!template)throw Error('範本不存在或已停用');
 const at=new Date().toISOString();const row={id:'IN-'+crypto.randomUUID().slice(0,8),title,assetId:asset.id,assetName:asset.name,rackId:asset.rackId,assigneeId:owner.id,due:validateDue(body.due),state:'pending',revision:0,createdAt:at,updatedAt:at,templateId:template.id,templateName:template.name,templateRevision:template.revision,items:template.items.map((label,i)=>({id:String(i),label,result:'pending',note:''}))};audit('inspection.created',row.id);return save(row);

 }
 return {
 ...scheduleMethods({list,put,transaction,audit,create}),
 inspectionTemplates(){return [defaultInspectionTemplate,...list('inspectionTemplates')];},
 saveInspectionTemplate(body){return transaction(()=>{
 const actor=user(body.actorId);if(actor?.role!=='管理員')throw Error('僅管理員可編輯巡檢範本');
 if(body.id==='default')throw Error('通用範本不可修改，請另存新範本');
 const old=body.id?list('inspectionTemplates').find(t=>t.id===body.id):null;
 if(body.id&&!old)throw Error('範本不存在');if(old&&body.revision!==old.revision)throw Error('範本已更新，請重新載入');
 const fields=validateTemplate(body),at=new Date().toISOString(),row={...fields,id:old?.id||'IT-'+crypto.randomUUID().slice(0,8),revision:(old?.revision??-1)+1,createdAt:old?.createdAt||at,updatedAt:at};
 put.run('inspectionTemplates',row.id,JSON.stringify(row));audit('inspection.template.saved',row.id);return row;
 });},
 createInspection(body){return transaction(()=>create(body));},
 updateInspection(id,action,body){return transaction(()=>{
 const old=list('inspections').find(r=>r.id===id);if(!old)throw Error('巡檢任務不存在');
 if(action==='workorder'&&old.workOrderId)return {inspection:old,workorder:list('workorders').find(w=>w.id===old.workOrderId)};
 if(body.revision!==old.revision)throw Error('巡檢已更新，請重新整理');
 const actor=user(body.actorId);if(!actor||actor.id!==old.assigneeId)throw Error('僅指定巡檢人員可操作');
 const row=structuredClone(old);row.updatedAt=new Date().toISOString();row.revision++;
 if(['save','complete'].includes(action)){
 if(old.state==='completed')throw Error('已完成巡檢不可修改');
 if(!Array.isArray(body.items)||body.items.length!==old.items.length)throw Error('檢查表不完整');
 row.items=old.items.map(item=>{const value=body.items.find(v=>v.id===item.id);if(!value||!['pending','normal','abnormal','na'].includes(value.result))throw Error('檢查結果無效');const note=String(value.note||'').trim();if(note.length>1000)throw Error('備註不可超過 1000 字');if(value.result==='abnormal'&&!note)throw Error('異常項目必須填寫說明');return {...item,result:value.result,note};});
 row.state='working';if(action==='complete'){if(row.items.some(i=>i.result==='pending'))throw Error('請完成所有檢查項目');row.state='completed';row.completedAt=row.updatedAt;}
 }else if(action==='evidence'){
 if(old.state==='completed')throw Error('已完成巡檢不可新增附件');
 if((old.attachments||[]).length>=5)throw Error('每筆巡檢最多 5 張佐證照片');
 const evidence=validateEvidence(body),fileId='IE-'+crypto.randomUUID();
 const {data,...meta}=evidence;put.run('inspectionEvidence',fileId,JSON.stringify({...evidence,id:fileId,inspectionId:id}));
 row.attachments=[...(old.attachments||[]),{...meta,id:fileId,uploadedAt:row.updatedAt,uploadedBy:actor.name}];
 }else if(action==='workorder'){
 const abnormal=row.items.filter(i=>i.result==='abnormal');if(row.state!=='completed'||!abnormal.length)throw Error('完成巡檢且有異常才能轉工單');
 const owner=user(body.assigneeId),reviewer=list('users').find(u=>u.id===body.reviewerId&&u.enabled&&u.role==='管理員');if(!owner||!reviewer||owner.id===reviewer.id)throw Error('請選擇不同的有效受派人與驗收人');
 const at=row.updatedAt;const w={id:'WO-'+crypto.randomUUID().slice(0,8),sourceType:'inspection',inspectionId:id,assetId:row.assetId,rackId:row.rackId,floor:'4F',area:row.rackId.split('-')[1],title:'巡檢異常：'+row.title,description:abnormal.map(i=>i.label+'：'+i.note).join('\n'),device:row.assetName,system:'資產巡檢',priority:'warning',reporter:actor.name,vendor:'',due:validateDue(body.due),assigneeId:owner.id,reviewerId:reviewer.id,state:'assigned',revision:0,createdAt:at,updatedAt:at,resolution:'',logs:[{at,actor:actor.name,action:'create',note:'由巡檢 '+id+' 建立；異常 '+abnormal.length+' 項'}]};put.run('workorders',w.id,JSON.stringify(w));row.workOrderId=w.id;save(row);audit('inspection.workorder.created',id);return {inspection:row,workorder:w};
 }else throw Error('不支援的操作');
 audit('inspection.'+action,id);return save(row);
 });}
 };
}
