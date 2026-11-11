import {demand,stateNames,baselineDemand} from './rfi.mjs';
export function answerQuestion(question,run){
 const q=question.trim(),reduction=run.units.filter(u=>run.selected.includes(u.id)).reduce((n,u)=>n+u.reduction,0);
 const source=`${run.id} · T+${run.minute} 分 · ${stateNames[run.state]}`;
 const reply=(text,action='control')=>({text,action,source});
 if(/報告|紀錄|記錄|摘要/.test(q))return reply(`事件目前為「${stateNames[run.state]}」。目前需量 ${demand(run)} kW，累積 ${run.logs.length} 筆操作紀錄。${run.state==='completed'?'空調均已復載，可查看完整事件報告。':'流程尚未完成，報告會顯示目前進度。'}`,'report');
 if(/復載|恢復|還原/.test(q))return reply(`復載需等到模擬 T+10 分鐘、尖峰負載回落後，一次恢復一台，兩台間隔至少 5 個模擬分鐘。\n目前 T+${run.minute} 分鐘，狀態為「${stateNames[run.state]}」，仍有 ${run.units.filter(u=>u.shed).length} 台降載中。請在操作頁檢查並執行復載；對話不會直接送出控制命令。`);
 if(/節省|節能|節費|多少錢/.test(q))return reply(`目前選取方案可降低 ${reduction} kW。若維持 15 分鐘，理論減少 ${(reduction*.25).toFixed(1)} kWh；以展示電價 6 元／kWh 試算，能源費差額為 ${(reduction*.25*6).toFixed(1)} 元。\n這是方案估算，未計入復載反彈與效率變化，不是實際節費成果。`);
 if(/保養|健康|維修|濾網/.test(q))return reply('獨立保養示例：AC-B-02 同工況基準 18 kW，量測 20 kW，偏離 11.1%；運轉 1,820 小時，距展示保養點 2,000 小時尚有 180 小時。\n建議人工檢查濾網、風道及感測器校正。可於「分析建議採納與追蹤」建立檢查工單。',null);
 if(/尖離峰|電價|排程|離峰/.test(q))return reply('展示假設尖峰 6 元／kWh、離峰 2 元／kWh。將 8 kW 非必要額外運轉移轉 1 小時，能源費差額可為 32 元。\n可優先調整保養測試與備援演練時段，基本冷卻持續運轉。此為假設費率，未套用現行電價或變更任何排程。',null);
 if(/溫度|高溫|離線|條件|安全|失敗|阻擋/.test(q))return reply(`A 區 ${run.units.find(u=>u.zone==='A').temperature}°C，B 區 ${run.units.find(u=>u.zone==='B').temperature}°C；展示溫度上限為 28°C。\n${run.scenario==='hot'?'A 區已超溫，應阻擋降載。':run.scenario==='offline'?'AC-B-02 離線，無法執行完整方案。':run.scenario==='failure'?'此情境預設 B 區命令失敗，將停止並回復已降載設備。':'需確認所選設備在線、兩區溫度及最低冷卻配置均通過。'}\n每區至少保留 32 kW 空調輸入功率代理值。這不等於製冷能力，僅用於展示條件檢查。`);
 if(/需量|超標|降載|卸載|方案|分析|目前|狀態|執行/.test(q))return reply(`目前事件「${stateNames[run.state]}」，模擬需量 ${demand(run)} kW。初始需量 ${baselineDemand(run)} kW，安全門檻 ${run.threshold} kW，需降低 ${Math.max(0,baselineDemand(run)-run.threshold).toFixed(1)} kW。\n目前方案選取 ${run.selected.join('、')||'無設備'}，預估降低 ${reduction} kW，初始負載下預估為 ${(baselineDemand(run)-reduction).toFixed(1)} kW。僅調節空調，保留基本冷卻，不卸載 IT 設備。\n${run.state==='completed'?'此事件已完成，以上為原方案回顧；可建立新情境再次展示。':'下一步請到操作頁進行條件檢查與方案確認。對話不會直接執行降載。'}`);
 return reply('目前展示對話支援：需量原因、降載方案、條件檢查、節能試算、復載、設備保養與事件報告。\n這個問題尚無對應的模擬分析。你可以問「目前需量為什麼超標？」或「降載能節省多少？」。',null);
}
