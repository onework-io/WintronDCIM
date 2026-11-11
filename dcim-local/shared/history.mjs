// Reproducible demonstration dataset; no physical meters.
export const historyCutoff='2026-11-10';
export const months=Array.from({length:11},(_,i)=>`2026-${String(i+1).padStart(2,'0')}`).reverse();
const round=n=>Math.round(n*100)/100;
export function dailyEnergy(month,zone='all',daysLimit=31){
 if(!/^202[56]-(0[1-9]|1[0-2])$/.test(month)||month>'2026-11'||!['all','A','B'].includes(zone))throw Error('無效的月份或區域');
 const [y,m]=month.split('-').map(Number),days=Math.min(new Date(Date.UTC(y,m,0)).getUTCDate(),month==='2026-11'?10:31,daysLimit);
 return Array.from({length:days},(_,i)=>{let it=0,cooling=0,other=0;for(const z of zone==='all'?['A','B']:[zone]){const load=(z==='A'?1250:2500)*(1+.025*Math.sin((i+1)*.7)+.012*(m-6));it+=load;cooling+=load*(.24+(z==='B'&&month>='2026-10'?.075:0));other+=load*.09;}return {date:`${month}-${String(i+1).padStart(2,'0')}`,itKwh:round(it),coolingKwh:round(cooling),otherKwh:round(other),facilityKwh:round(it+cooling+other)};});
}
function sum(rows){const total=k=>round(rows.reduce((n,r)=>n+r[k],0));const it=total('itKwh'),facility=total('facilityKwh');return {it,facility,cooling:total('coolingKwh'),other:total('otherKwh'),pue:facility/it,days:rows.length,daily:facility/rows.length};}
export function analyzeEnergy(month='2026-10',zone='all'){
 const [y,m]=month.split('-').map(Number),previous=new Date(Date.UTC(y,m-2,1)).toISOString().slice(0,7),current=dailyEnergy(month,zone),limit=month==='2026-11'?current.length:31,prior=dailyEnergy(previous,zone,limit),a=sum(current),b=sum(prior);
 const delta=round((a.daily/b.daily-1)*100),coolingDelta=round((a.cooling/a.days-b.cooling/b.days)),share=round(a.cooling/a.facility*100);
 const text=`${month} ${zone==='all'?'4F A／B 區':zone+' 區'}，${a.days} 天累積用電 ${a.facility.toFixed(2)} kWh，能源加權 PUE ${a.pue.toFixed(3)}。日均用電較 ${previous} ${delta>=0?'增加':'減少'} ${Math.abs(delta)}%。冷卻用電占比 ${share}%，冷卻日均差額 ${coolingDelta} kWh。`;
 const advice=[coolingDelta>100?'冷卻用電增加較明顯，優先檢查送回風、冷通道封閉與空調排程。':'持續追蹤 IT 負載與冷卻用電比例，確認運轉變化。','先核對電表與同工況資料，再判斷改善原因；此資料集的 B 區自 10 月起預設冷卻耗能增加，並非模型推論的故障。','建立改善前後相同期間的比較，避免直接將不同天數的總用電當成效率變化。'];
 return {month,zone,previous,current,prior,summary:a,baseline:b,delta,coolingDelta,text,advice,periodNote:month==='2026-11'?'本月僅 1–10 日，與上月 1–10 日比較':'完整月份；不同天數以日均值比較',source:`固定模擬日資料 · 截止 ${historyCutoff} · 非真實歷史電表`};
}
