export const defaultSla={critical:{response:1,resolve:8},warning:{response:4,resolve:24},info:{response:8,resolve:72}};
export function validateSla(input){for(const key of Object.keys(defaultSla)){const p=input?.[key];if(!p||!Number.isFinite(p.response)||!Number.isFinite(p.resolve)||p.response<=0||p.resolve<p.response||p.resolve>720)throw Error('各級回應時數須大於 0，結案時數須不小於回應且不超過 720 小時');}return structuredClone(input);}
export function workSla(w,settings=defaultSla,now=Date.now()){
 if(w.cancelledAt)return {status:'cancelled',label:'已取消（不計 SLA）',responseHours:null,resolveHours:null};
 const created=Date.parse(w.createdAt),policy=settings[w.priority]||settings.warning;
 const event=action=>(w.logs||[]).filter(l=>l.action===action).map(l=>Date.parse(l.at)).filter(t=>Number.isFinite(t)&&t>=created).sort((a,b)=>a-b)[0];
 const started=event('start'),closed=w.state==='closed'?event('approve'):undefined;
 const responseDeadline=created+policy.response*3600000,contractDeadline=created+policy.resolve*3600000;
 const due=w.due?Date.parse(w.due+'T23:59:59.999+08:00'):NaN,resolveDeadline=Number.isFinite(due)?Math.min(contractDeadline,due):contractDeadline;
 if(!Number.isFinite(created)||(w.state==='closed'&&!Number.isFinite(closed)))return {status:'unknown',label:'歷程不足',responseHours:null,resolveHours:null};
 const responseEnd=started??closed??now,resolveEnd=closed??now;
 const responseLate=responseEnd>responseDeadline,resolveLate=resolveEnd>resolveDeadline;
 const remaining=Math.min(...[started===undefined&&closed===undefined?responseDeadline:Infinity,closed===undefined?resolveDeadline:Infinity])-now;
 const status=responseLate||resolveLate?'breached':closed!==undefined?'met':remaining<=2*3600000?'soon':'normal';
 return {status,label:{breached:'SLA 超時',met:'SLA 達標',soon:'2 小時內到期',normal:'SLA 正常'}[status],responseHours:started===undefined?null:(started-created)/3600000,resolveHours:closed===undefined?null:(closed-created)/3600000,responseLate,resolveLate,responseDeadline,resolveDeadline,remainingHours:closed===undefined?remaining/3600000:null};
}
