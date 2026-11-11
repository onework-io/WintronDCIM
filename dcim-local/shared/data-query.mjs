import {analyzeEnergy} from './history.mjs';
// Read-only, deterministic interpretation for the local RFI demonstration.
export function queryData(question,data){
 const q=question.trim(),t=data.telemetry;
 const result=(text,columns=[],rows=[],advice=[],filter='4F A／B 區 · 最新快照')=>({text,columns,rows,advice,filter,source:`機房模擬資料 · ${t.timestamp}`,action:null,dataQuery:true});
 if(/本月|上月|月報|2026-\d{2}/.test(q)&&/能耗|用電|耗電|PUE|月報|能源/i.test(q)){
 const month=q.match(/2026-\d{2}/)?.[0]||(/上月/.test(q)?'2026-10':'2026-11'),z=q.toUpperCase().match(/([AB])\s*區/)?.[1]||'all';
 try{const r=analyzeEnergy(month,z);return {...result(r.text,['指標','本期','比較期'],[['累積用電 kWh',r.summary.facility,r.baseline.facility],['日均用電 kWh',r.summary.daily.toFixed(2),r.baseline.daily.toFixed(2)],['能源加權 PUE',r.summary.pue.toFixed(3),r.baseline.pue.toFixed(3)]],r.advice,r.month+' · '+(z==='all'?'A／B 區':z+' 區')+' · '+r.periodNote),source:r.source};}catch{return result('此月份沒有展示歷史資料；可查詢 2026-01 至 2026-11。');}
 }
 if(/昨天|昨日|上週|上周|上個月|去年|趨勢|歷史/.test(q))return result('目前對話查詢提供最新快照，未接入此期間的歷史查詢。請改問目前讀值；歷史問題不會以即時數據代替。');
 if(/刪除|修改|設定為|關閉|啟動|執行/.test(q))return result('此處僅查詢數據並提供建議，不修改資料或控制設備。空調操作請使用「決策分析」及方案確認流程。');
 const rackMatch=q.toUpperCase().match(/4F-([AB])-([0-9]{1,2})\b/),rackId=rackMatch?`4F-${rackMatch[1]}-${rackMatch[2].padStart(2,'0')}`:null;
 const zoneMatch=q.toUpperCase().match(/(?:ZONE\s*([AB])|([AB])\s*區)/),zone=zoneMatch?.[1]||zoneMatch?.[2];
 const racks=t.racks.filter(r=>(!rackId||r.id===rackId)&&(!zone||r.zone===zone));
 const scope=rackId|| (zone?`4F ${zone} 區`:'4F A／B 區');
 if(!racks.length)return result('指定機櫃或區域沒有資料，請確認範圍為 4F A-01～11、B-01～22。',[],[],[],scope);
 if(/告警|警報/.test(q)){
 const all=/全部|已確認/.test(q),rows=data.alerts.filter(a=>racks.some(r=>r.id===a.rackId)&&(all||a.state==='active'));
 return result(`找到 ${rows.length} 筆${all?'':'待處理'}告警。`,['告警 ID','機櫃','嚴重度','事件','處理狀態'],rows.map(a=>[a.id,a.rackId,({critical:'嚴重',warning:'警告',info:'提示'})[a.severity]||a.severity,a.title,a.state==='active'?'待處理':'已確認']),rows.length?['優先檢視嚴重告警及其感測器讀值，確認現場狀況後再處理。','已確認僅表示處理狀態，不代表設備異常已消失。']:['此篩選未找到告警；仍需搭配感測器讀值判斷。'],`${scope} · ${all?'全部狀態':'僅待處理告警'}`);
 }
 if(/PUE|能源|能耗|總功率/i.test(q)){
 if(zone||rackId)return result('目前只有整個 4F 的設施與 IT 功率計量，無法計算指定區域或機櫃的 PUE。請查詢「4F 目前 PUE 與建議」。',[],[],[],scope);
 const target=data.energySettings?.pueTarget??null;
 return result(`目前 4F 功率比值 PUE 為 ${t.pue.toFixed(2)}，由設施功率 ÷ IT 功率計算；不是期間能耗加權 PUE。`,['指標','數值','單位'],[['設施總功率',t.facilityPower.toFixed(2),'kW'],['IT 設備功率',t.itPower.toFixed(2),'kW'],['非 IT 功率差額',(t.facilityPower-t.itPower).toFixed(2),'kW'],['即時 PUE',t.pue.toFixed(2),'比值']],['先核對設施與 IT 電表的計量邊界及時間同步。','非 IT 差額不等於空調耗電；取得空調分表後再判斷節能潛力。']);
 }
 if(/漏水/.test(q))return result('目前對話資料來源未包含漏水感測點，無法據此判定漏水狀態。請至環境監測查看展示資訊，後續可接入感測點查詢。',[],[],['沒有資料不應解讀為「無漏水」。'],scope);
 const metric=/濕度/.test(q)?'humidity':/功率|用電|負載/.test(q)?'powerKw':/溫度|高溫|最熱/.test(q)?'temperature':null;
 if(!metric&&!rackId)return result('可查詢機櫃溫度、濕度、功率排行、指定機櫃、告警及整個 4F 的即時 PUE。請加入條件，例如「B 區溫度超過 28°C 的機櫃」。');
 const unit=metric==='powerKw'?'kW':metric==='humidity'?'% RH':'°C',name=metric==='powerKw'?'功率':metric==='humidity'?'濕度':'溫度';
 const bound=q.match(/(超過|高於|大於|低於|小於|>=|<=|>|<)\s*(\d+(?:\.\d+)?)/),limit=Number(q.match(/(?:前|TOP\s*)(\d+)/i)?.[1]||5),rank=/最高|最低|排行|最熱|前\d|TOP/i.test(q),low=/最低/.test(q);
 if(bound&&!metric)return result('請指定篩選指標，例如「溫度超過 28°C」或「功率高於 5 kW」。');
 let selected=racks.slice();
 if(bound){const n=Number(bound[2]);selected=selected.filter(r=>bound[1]==='>='?r[metric]>=n:bound[1]==='<='?r[metric]<=n:/低於|小於|</.test(bound[1])?r[metric]<n:r[metric]>n);}
 if(metric)selected.sort((a,b)=>(low?1:-1)*(b[metric]-a[metric]));
 const count=selected.length;if(rank)selected=selected.slice(0,Math.max(1,Math.min(33,limit)));
 const hot=selected.filter(r=>r.temperature>28),highest=selected[0];
 return result(`找到 ${count} 座符合條件機櫃${rank?`，顯示${low?'最低':'最高'} ${selected.length} 座`:''}。`,['機櫃','溫度 °C','濕度 % RH','功率 kW'],selected.map(r=>[r.id,r.temperature,r.humidity,r.powerKw]),selected.length?(hot.length?[`${hot.map(r=>r.id).join('、')} 進風溫度超過展示門檻 28°C。建議確認感測器、冷通道封閉及送風狀態。`]:['本次結果未見進風溫度超過展示門檻 28°C；仍應持續觀察。']).concat(metric==='powerKw'?[`最高功率 ${highest.id} 為 ${highest.powerKw} kW；檢查負載分配及容量餘裕，勿直接卸載 IT 設備。`]:[]):['此條件沒有結果，可調整區域或門檻；不代表其他區域沒有異常。'],`${scope} · 最新快照${metric?` · ${name}${bound?` ${bound[1]} ${bound[2]} ${unit}`:''}`:''}${rank?` · ${low?'升冪':'降冪'}前 ${selected.length} 座`:''}`);
}
