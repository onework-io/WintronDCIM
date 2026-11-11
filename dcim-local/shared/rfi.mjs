import {demandAnalysis} from './demand.mjs';
// Isolated RFI simulator: never sends commands to equipment or an LLM.
export const scenarios={normal:'需量超標／正常降載',hot:'A 區高溫保護',offline:'B 區設備離線',failure:'B 區命令失敗／自動回復'};
export const stateNames={new:'待分析',analyzed:'待檢查',ready:'待模擬執行',active:'降載觀察中',restoring:'分批復載中',completed:'已完成',failed:'執行失敗／已回復',cancelled:'已取消'};
const round=v=>Math.round(v*10)/10;
export function createRun(scenario='normal',id='demo',at=new Date().toISOString(),source=null){
 if(!Object.hasOwn(scenarios,scenario))throw Error('未知情境');
 let context=null;if(source){if(!Number.isFinite(source.contract)||!Number.isFinite(source.warning))throw Error('需量來源參數不完整');const a=demandAnalysis(source.month,source.contract,source.warning),row=a.rows.find(x=>x.date===source.date&&x.time===source.time);if(!row||row.excess<=0)throw Error('請選擇有效的超約時段');context={...row,month:source.month,contract:a.contract,warning:a.warning};}
 const baseline=context?Math.ceil(context.kw*10)/10:252,threshold=context?Math.floor(context.contract*context.warning/100*10)/10:240,contract=context?.contract??250;
 return {baseline,recoveryBaseline:context?round(Math.max(80,Math.min(baseline-34,threshold-10))):218,sourceDemand:context,id,scenario,createdAt:at,state:'new',revision:0,minute:0,threshold,contract,minimum:32,maxTemperature:28,cooldown:5,selected:['AC-A-02','AC-B-02'],units:['A','B'].flatMap(z=>[1,2].map(n=>({id:`AC-${z}-0${n}`,zone:z,power:20,reduction:n===2?8:0,priority:z==='A'?1:2,online:!(scenario==='offline'&&z==='B'&&n===2),temperature:scenario==='hot'&&z==='A'?29.2:z==='A'?25.1:25.8,shed:false,restored:false}))),logs:[{at,minute:0,event:'建立情境',detail:scenarios[scenario]}],history:[{minute:0,demand:baseline}],checks:[],lastRestore:null};
}
export const baselineDemand=run=>run.baseline??252;
export const recoveryDemand=run=>run.recoveryBaseline??218;
export function demand(run){const base=run.minute>=10?recoveryDemand(run):baselineDemand(run);return round(base-run.units.filter(u=>u.shed).reduce((s,u)=>s+u.reduction,0));}
export function checkPlan(run){const chosen=run.units.filter(u=>run.selected.includes(u.id)),reduction=chosen.reduce((s,u)=>s+u.reduction,0);return [
 {name:'已選取可調節空調',pass:chosen.length>0&&chosen.every(u=>u.reduction>0),detail:`${chosen.length} 台，預估降低 ${reduction} kW`},
 {name:'通訊及遠端可用',pass:chosen.every(u=>u.online),detail:chosen.filter(u=>!u.online).map(u=>u.id+' 離線').join('、')||'選取設備均回報可用'},
 ...['A','B'].map(z=>({name:`${z} 區進風溫度保護`,pass:Math.max(...run.units.filter(u=>u.zone===z).map(u=>u.temperature))<=run.maxTemperature,detail:`${Math.max(...run.units.filter(u=>u.zone===z).map(u=>u.temperature))} °C / 上限 ${run.maxTemperature} °C`})),
 ...['A','B'].map(z=>{const remaining=40-chosen.filter(u=>u.zone===z).reduce((s,u)=>s+u.reduction,0);return {name:`${z} 區最低冷卻配置`,pass:remaining>=run.minimum,detail:`調節後 ${remaining} / 最低 ${run.minimum} kW（空調輸入功率代理值）`};}),
 {name:'預測需量回到安全門檻',pass:baselineDemand(run)-reduction<=run.threshold,detail:`${baselineDemand(run)-reduction} kW / 安全門檻 ${run.threshold} kW`}
 ];}
export function transition(input,action,body={},at=new Date().toISOString()){
 const r=structuredClone(input);const allow=(...states)=>{if(!states.includes(r.state))throw Error('此階段不可執行該操作');};
 const log=(event,detail)=>r.logs.push({at,minute:r.minute,event,detail});
 if(action==='analyze'){allow('new','analyzed','ready');r.state='analyzed';r.checks=[];log('GenAI 分析',`基準需量 ${baselineDemand(r)} kW，安全門檻 ${r.threshold} kW；可調節 AC-A-02、AC-B-02，各 8 kW。需降低 ${round(Math.max(0,baselineDemand(r)-r.threshold))} kW，方案必須通過條件檢查。`);}
 else if(action==='plan'){allow('analyzed','ready');if(!Array.isArray(body.selected)||new Set(body.selected).size!==body.selected.length||body.selected.some(id=>!r.units.some(u=>u.id===id&&u.reduction>0)))throw Error('空調選取無效');r.selected=body.selected;r.state='analyzed';r.checks=[];log('調整方案',r.selected.join('、')||'未選取設備');}
 else if(action==='check'){allow('analyzed','ready');r.checks=checkPlan(r);r.state=r.checks.every(c=>c.pass)?'ready':'analyzed';log('條件檢查',r.state==='ready'?'全部通過':'未通過；禁止執行，請查看檢查結果');}
 else if(action==='execute'){allow('ready');if(body.confirmed!==true)throw Error('請先確認模擬執行方案');r.checks=checkPlan(r);if(!r.checks.every(c=>c.pass))throw Error('條件已失效，禁止執行');for(const u of r.units.filter(u=>r.selected.includes(u.id)).sort((a,b)=>a.priority-b.priority)){log('模擬命令送出',`${u.id} 輸入功率 20 → 12 kW`);if(r.scenario==='failure'&&u.zone==='B'){log('命令失敗',`${u.id} 回授逾時；停止後續命令`);for(const v of r.units.filter(v=>v.shed)){v.shed=false;log('失敗回復',`${v.id} 恢復 20 kW；回授成功`);}r.state='failed';break;}u.shed=true;log('命令回授',`${u.id} 已降載至 12 kW`);r.state='active';}r.history.push({minute:r.minute,demand:demand(r)});}
 else if(action==='advance'){allow('active','restoring');r.minute+=5;r.history.push({minute:r.minute,demand:demand(r)});log('推進模擬時間',r.minute>=10?`尖峰負載回落，未降載基準需量為 ${recoveryDemand(r)} kW`:'降載後需量維持，冷卻代理值與溫度未越限');}
 else if(action==='restore'){allow('active','restoring');const u=r.units.find(u=>u.shed);if(!u)throw Error('沒有待復載設備');if(r.minute<10)throw Error('需量尚未回落，請先觀察至模擬第 10 分鐘');if(r.lastRestore!==null&&r.minute-r.lastRestore<r.cooldown)throw Error('尚未滿足 5 分鐘分批復載等待時間');if(demand(r)+u.reduction>r.threshold)throw Error('復載後需量超過安全門檻');u.shed=false;u.restored=true;r.lastRestore=r.minute;r.state=r.units.some(v=>v.shed)?'restoring':'completed';log('分批復載',`${u.id} 已恢復 20 kW；回授成功`);r.history.push({minute:r.minute,demand:demand(r)});if(r.state==='completed')log('事件完成',`所有空調恢復；需量 ${recoveryDemand(r)} kW`);}
 else if(action==='cancel'){allow('new','analyzed','ready');r.state='cancelled';log('取消情境','尚未執行降載');}
 else throw Error('未知操作');
 r.revision++;r.updatedAt=at;return r;
}
