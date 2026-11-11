import {validateDue} from './workorders.mjs';
export const outcomeMetrics={power:{name:'設備功率',unit:'kW'},pue:{name:'PUE',unit:'比值'},temperature:{name:'進風溫度',unit:'°C'}};
export function validateOutcome(body){
 if(!outcomeMetrics[body.metric])throw Error('請選擇有效指標');
 if(!Number.isFinite(body.before)||!Number.isFinite(body.after)||body.before<0||body.after<0||body.before>1000000||body.after>1000000)throw Error('量測值須為 0–1,000,000 內有效數字');
 if(body.metric==='pue'&&(body.before<1||body.after<1))throw Error('PUE 不可低於 1');
 const beforeDate=validateDue(body.beforeDate),afterDate=validateDue(body.afterDate);if(!beforeDate||!afterDate||beforeDate>afterDate)throw Error('請填寫有效且先後順序正確的量測日期');
 const conditions=String(body.conditions||'').trim();if(!conditions||conditions.length>1000)throw Error('請填寫 1–1000 字比較條件與說明');
 const comparable=body.comparable===true,delta=body.after-body.before;
 return {metric:body.metric,before:body.before,after:body.after,beforeDate,afterDate,conditions,comparable,delta,reductionPercent:comparable&&body.metric!=='temperature'&&body.before>0?(body.before-body.after)/body.before*100:null};
}

export function outcomeCsv(work){
 const cell=v=>'"'+String(v??'').replace(/^[\s]*[=+@-]/,"'$&").replaceAll('"','""')+'"';
 const rows=[['工單','來源事件','指標','單位','改善前日期','改善前','改善後日期','改善後','差值','可比較','降幅%','比較條件','記錄人','記錄時間'],...(work.outcomes||[]).map(o=>[work.id,work.runId,outcomeMetrics[o.metric]?.name,outcomeMetrics[o.metric]?.unit,o.beforeDate,o.before,o.afterDate,o.after,o.delta,o.comparable?'是':'否',o.reductionPercent??'',o.conditions,o.recordedBy,o.recordedAt])];
 return '\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
