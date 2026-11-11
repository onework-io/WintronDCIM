export function taipeiDate(now=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&value>='1900-01-01'&&value<='9999-12-31'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function validateLifecycle(asset){
 for(const [key,label] of [['commissionedOn','啟用日期'],['warrantyUntil','保固到期日'],['replacementOn','預定汰換日']]){const v=asset[key];if(v!==undefined&&v!==''&&!validDate(v))throw Error(label+'格式無效');}
 if(asset.commissionedOn&&asset.warrantyUntil&&asset.commissionedOn>asset.warrantyUntil)throw Error('保固到期日不可早於啟用日期');
 if(asset.commissionedOn&&asset.replacementOn&&asset.commissionedOn>asset.replacementOn)throw Error('預定汰換日不可早於啟用日期');
}
export const lifecycleLabels={expired:'已過保',soon:'保固即將到期',covered:'保固有效',unknown:'未登錄保固'};
export function lifecycle(asset,today=taipeiDate(),horizon=90){
 const days=v=>validDate(v)?Math.round((Date.parse(v)-Date.parse(today))/86400000):null;
 const warrantyDays=days(asset.warrantyUntil),replacementDays=days(asset.replacementOn);
 return {...asset,warrantyDays,replacementDays,warrantyState:warrantyDays===null?'unknown':warrantyDays<0?'expired':warrantyDays<=horizon?'soon':'covered',replacementDue:replacementDays!==null&&replacementDays<=horizon};
}
