import {dailyEnergy} from './history.mjs';
export function demandAnalysis(month,contract=250,warning=90){
 if(!Number.isFinite(contract)||contract<=0||contract>10000)throw Error('契約容量須大於 0 且不超過 10000 kW');
 if(!Number.isFinite(warning)||warning<1||warning>100)throw Error('預警比例須介於 1–100%');
 const rows=dailyEnergy(month,'all').flatMap(day=>{
 const weights=Array.from({length:96},(_,i)=>1+.16*Math.sin((i-24)*Math.PI/48)+.045*Math.sin(i*.7));
 const sum=weights.reduce((a,b)=>a+b,0);
 return weights.map((w,i)=>{const kwh=day.facilityKwh*w/sum,kw=kwh*4;return {date:day.date,time:`${String(Math.floor(i/4)).padStart(2,'0')}:${String(i%4*15).padStart(2,'0')}`,kwh,kw,excess:Math.max(0,kw-contract),state:kw>contract?'超約':kw>=contract*warning/100?'預警':'正常'};});
 });
 const peak=rows.reduce((a,b)=>!a||b.kw>a.kw?b:a,null),over=rows.filter(r=>r.excess>0);
 return {rows,peak,over,contract,warning,overHours:over.length/4,excessKwh:over.reduce((s,r)=>s+r.excess/4,0)};
}
export function demandCsv(r){return '\ufeff'+[['日期（台北）','區間起始','區間分鐘','用電 kWh','平均需量 kW','契約 kW','超約 kW','狀態','來源'],...r.rows.map(x=>[x.date,x.time,15,x.kwh.toFixed(3),x.kw.toFixed(3),r.contract,x.excess.toFixed(3),x.state,'模擬分時曲線'])].map(x=>x.join(',')).join('\r\n');}
