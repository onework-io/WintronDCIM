export const inspectionStates={pending:'待巡檢',working:'巡檢中',completed:'已完成'};
export function taipeiDate(value){if(!value||!Number.isFinite(Date.parse(value)))return '';return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
export function inspectionReport(rows,filters={},now=new Date()){
 const today=taipeiDate(now.toISOString());
 const filtered=rows.filter(r=>{const date=taipeiDate(r.createdAt);return (!filters.from||date>=filters.from)&&(!filters.to||date<=filters.to)&&(!filters.zone||r.rackId?.split('-')[1]===filters.zone)&&(!filters.state||r.state===filters.state);});
 const abnormal=filtered.filter(r=>r.items.some(i=>i.result==='abnormal'));
 return {rows:filtered,total:filtered.length,completed:filtered.filter(r=>r.state==='completed').length,abnormal:abnormal.length,abnormalItems:filtered.reduce((n,r)=>n+r.items.filter(i=>i.result==='abnormal').length,0),unlinked:abnormal.filter(r=>r.state==='completed'&&!r.workOrderId).length,overdue:filtered.filter(r=>r.state!=='completed'&&r.due&&r.due<today).length};
}
const cell=value=>'"'+String(value??'').replace(/^[\s]*[=+@-]/,"'$&").replaceAll('"','""')+'"';
export function inspectionCsv(rows,users){
 const lines=[['任務編號','任務名稱','資產','機櫃','受派人','建立日期（台北）','期限','狀態','完成時間','範本','版本','檢查項目','結果','備註','關聯工單']];
 const results={pending:'未檢查',normal:'正常',abnormal:'異常',na:'不適用'};
 for(const r of rows)for(const item of r.items)lines.push([r.id,r.title,r.assetName,r.rackId,users.find(u=>u.id===r.assigneeId)?.name||r.assigneeId,taipeiDate(r.createdAt),r.due,inspectionStates[r.state],r.completedAt||'',r.templateName||'通用設備巡檢',(r.templateRevision??0)+1,item.label,results[item.result],item.note,r.workOrderId]);
 return '\ufeff'+lines.map(line=>line.map(cell).join(',')).join('\r\n');
}
