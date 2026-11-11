import {queryData} from './data-query.mjs';
import {sensorReadings,sensorStatus,sensorValue} from './sensors.mjs';
export const operationsTopics=[
 {id:'daily',name:'值班總覽',questions:['目前維運待辦摘要','目前有哪些告警？','查詢 4F-B-07']},
 {id:'work',name:'工單與維護',questions:['有哪些未結案工單？','哪些工單已逾期？','有哪些待驗收工單？','查看維護工單']},
 {id:'inspection',name:'巡檢與履歷',questions:['有哪些逾期巡檢？','查看異常巡檢','查看機櫃維護履歷']},
 {id:'environment',name:'環境與設備',questions:['B 區溫度超過 28°C 的機櫃','查看漏水感測點','查看離線感測點','查詢機櫃資產']},
 {id:'energy',name:'能源與效率',questions:['功率最高前 5 名','4F 目前 PUE 與建議','上月 B 區耗電分析']}
];
const states={assigned:'已指派',working:'處理中',review:'待驗收',closed:'已結案',pending:'待巡檢',completed:'已完成'};
export function resolveScope(question,previous='all'){
 const rack=question.toUpperCase().match(/4F-([AB])-(\d{1,2})\b/);
 if(rack)return `4F-${rack[1]}-${rack[2].padStart(2,'0')}`;
 if(/全區|全部區域|整個\s*4F|4F\s*目前\s*PUE/i.test(question))return 'all';
 return question.toUpperCase().match(/([AB])\s*區/)?.[1]||previous;
}
export function queryOperations(question,data,previous='all',now=Date.now()){
 const q=question.trim(),scope=resolveScope(q,previous),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
 const racks=(data.telemetry?.racks||[]).filter(r=>scope==='all'||r.zone===scope||r.id===scope),ids=new Set(racks.map(r=>r.id));
 const applies=r=>ids.has(r.rackId)||(r.rackIds||r.maintenance?.rackIds||r.placements?.map(p=>p.rackId)||[]).some(id=>ids.has(id));
 const source=`查詢時間 ${new Date(now).toISOString()} · 遙測 ${data.telemetry?.timestamp||'未提供'}`;
 const res=(text,columns=[],rows=[],advice=[],links=[],followups=[])=>({text,columns,rows:rows.slice(0,30),advice,links:links.slice(0,30),followups,context:scope,filter:(scope==='all'?'4F A／B 區':scope)+' · '+(rows.length>30?`共 ${rows.length} 筆，顯示前 30 筆`:'目前紀錄'),source,dataQuery:true});
 if(!racks.length)return res('找不到此機櫃，請選擇 4F A-01～11 或 B-01～22。');
 if(/刪除|修改|關閉|執行|啟動|派工|(?<!未|已)結案工單/.test(q))return res('請開啟對應紀錄，在作業頁面確認操作。',[],[],[],[{kind:'page',id:'workorders',label:'開啟工單管理'}]);
 const operational=/工單|巡檢|維護|履歷|待辦|資產|感測|漏水|離線/.test(q);
 if(operational&&/昨天|昨日|上週|上周|上月|去年|歷史趨勢/.test(q))return res('此查詢尚未支援指定歷史期間，請至對應頁面使用日期篩選。',[],[],[],[{kind:'page',id:/巡檢/.test(q)?'inspections':'workorders',label:'開啟紀錄查詢'}]);
 const works=(data.workorders||[]).filter(applies),tasks=(data.inspections||[]).filter(applies),assets=(data.assets||[]).filter(applies);
 const open=works.filter(w=>w.state!=='closed'&&!w.cancelledAt),late=w=>!!w.due&&w.due<today;
 const person=id=>(data.users||[]).find(u=>u.id===id)?.name||'未指定';
 const workLink=w=>({kind:'work',id:w.id,label:'開啟 '+w.id});
 const taskLink=t=>({kind:'inspection',id:t.id,label:'開啟 '+t.id});
 if(/待辦|值班|摘要/.test(q))return res('已整理目前範圍的維運待辦，建議先處理逾期事項與未確認告警。',['項目','數量'],[['未結案工單',open.length],['完成期限已過工單',open.filter(late).length],['待驗收工單',open.filter(w=>w.state==='review').length],['未完成巡檢',tasks.filter(t=>t.state!=='completed').length],['逾期巡檢',tasks.filter(t=>t.state!=='completed'&&late(t)).length],['待確認告警',(data.alerts||[]).filter(a=>ids.has(a.rackId)&&a.state==='active').length]],['完成期限逾期按台北日期判斷；SLA 回應／結案時數請在工單頁查看。'],[{kind:'page',id:'workorders',label:'工單看板'},{kind:'page',id:'inspections',label:'巡檢管理'}],['哪些工單已逾期？','有哪些逾期巡檢？','目前有哪些告警？']);
 if(/履歷/.test(q)){
 const rows=[...works.map(w=>[w.createdAt?.slice(0,10)||'—','工單',w.id,w.title,w.cancelledAt?'已取消':states[w.state]||w.state]),...tasks.map(t=>[t.createdAt?.slice(0,10)||'—','巡檢',t.id,t.title,states[t.state]||t.state])].sort((a,b)=>b[0].localeCompare(a[0]));
 return res(`找到 ${rows.length} 筆關聯工單與巡檢；位置依建單紀錄。`,['建單日期','類型','編號','名稱','目前狀態'],rows,[],rows.map(r=>({kind:r[1]==='工單'?'work':'inspection',id:r[2],label:'開啟 '+r[2]})),['查詢機櫃資產','有哪些未結案工單？']);
 }
 if(/工單|維護/.test(q)){
 let rows=/已結案/.test(q)?works.filter(w=>w.state==='closed'&&!w.cancelledAt):/全部工單/.test(q)?works:open;
 if(/逾期|超期/.test(q))rows=rows.filter(w=>w.state!=='closed'&&late(w));
 if(/待驗收|待審/.test(q))rows=rows.filter(w=>w.state==='review');
 if(/維護/.test(q))rows=rows.filter(w=>w.sourceType==='maintenance');
 rows=rows.slice().sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));
 return res(`找到 ${rows.length} 張符合條件工單。`,['工單','名稱','狀態','受派人','完成期限'],rows.map(w=>[w.id,w.title,w.cancelledAt?'已取消':states[w.state]||w.state,person(w.assigneeId),w.due||'未指定']),rows.length?['先核對期限與受派人，開啟工單補充處理紀錄或提交驗收。']:['目前條件沒有符合紀錄，可切換全區或查看全部工單。'],rows.map(workLink),['查看全部工單','有哪些待驗收工單？']);
 }
 if(/巡檢/.test(q)){
 let rows=tasks;
 if(/逾期/.test(q))rows=rows.filter(t=>t.state!=='completed'&&late(t));
 else if(/未完成|待巡檢/.test(q))rows=rows.filter(t=>t.state!=='completed');
 if(/異常/.test(q))rows=rows.filter(t=>t.items?.some(i=>i.result==='abnormal'));
 return res(`找到 ${rows.length} 筆巡檢任務。`,['巡檢','設備','狀態','期限','異常項目'],rows.map(t=>[t.id,t.assetName||t.assetId,states[t.state]||t.state,t.due||'未指定',t.items?.filter(i=>i.result==='abnormal').length||0]),['完成巡檢後可在任務頁將異常轉工單，並查看照片佐證。'],rows.map(taskLink),['查看異常巡檢','查看機櫃維護履歷']);
 }
 if(/資產/.test(q))return res(`目前範圍共有 ${assets.length} 項資產。`,['資產','名稱','機櫃','U 位','服務'],assets.map(a=>[a.id,a.name,a.rackId,`U${a.uStart}–${a.uStart+a.uSize-1}`,a.service||'未指定']),[],assets.map(a=>({kind:'asset',id:a.id,label:'資產 '+a.id})),['查看機櫃維護履歷','目前有哪些告警？']);
 if(/感測|漏水|離線/.test(q)){
 let rows=sensorReadings(data.telemetry,now).filter(s=>scope==='all'||s.zone===scope||s.rackId===scope);
 if(/漏水/.test(q))rows=rows.filter(s=>s.id.startsWith('WL-'));
 if(/離線|異常/.test(q))rows=rows.filter(s=>s.status!=='normal');
 return res(`找到 ${rows.length} 個感測點位。`,['Tag','位置','讀值','資料狀態'],rows.map(s=>[s.id,s.location,sensorValue(s),sensorStatus[s.status]]),['資料過期或無資料不代表設備正常；請在系統監測確認最新狀態。'],rows.map(s=>({kind:'sensor',id:s.id,system:s.system,label:'定位 '+s.id})),['目前有哪些告警？','查看漏水感測點']);
 }
 const scoped=scope==='all'?q:`${q} ${scope.length===1?scope+' 區':scope}`;
 const r=queryData(scoped,data);
 // Legacy telemetry replies use the same snapshot; add explicit record navigation.
 return {...r,context:scope,source:r.source?.replace('機房模擬資料','機房遙測'),links:r.rows.filter(row=>/^4F-[AB]-\d{2}$/.test(row[0])).map(row=>({kind:'rack',id:row[0],label:'3D 定位 '+row[0]})),followups:['查詢機櫃資產','查看機櫃維護履歷']};
}
