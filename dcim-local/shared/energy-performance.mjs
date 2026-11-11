import {dailyEnergy,months} from './history.mjs';
const total=(rows,key)=>rows.reduce((n,r)=>n+r[key],0);
export function energyPerformance(month,baselineMonth,zone='all',targetPercent=5){
 if(!months.includes(month)||!months.includes(baselineMonth)||baselineMonth>=month)throw Error('請選擇早於分析月份的基準月份');
 if(!Number.isFinite(targetPercent)||targetPercent<0||targetPercent>30)throw Error('改善目標須介於 0–30%');
 const a=dailyEnergy(month,zone),b=dailyEnergy(baselineMonth,zone),days=Math.min(a.length,b.length),current=a.slice(0,days),baseline=b.slice(0,days);
 const summarize=rows=>{const facility=total(rows,'facilityKwh'),it=total(rows,'itKwh'),cooling=total(rows,'coolingKwh');return {facility,it,cooling,pue:facility/it,daily:facility/days,coolingIntensity:cooling/it};};
 const actual=summarize(current),base=summarize(baseline),expected=actual.it*base.pue,variance=actual.facility-expected,improvement=(1-actual.pue/base.pue)*100;
 return {month,baselineMonth,zone,days,current,baseline,actual,base,expected,variance,improvement,targetPercent,targetPue:Math.max(1,base.pue*(1-targetPercent/100)),met:actual.pue<=Math.max(1,base.pue*(1-targetPercent/100)),dailyChange:(actual.daily/base.daily-1)*100};
}
export function performanceCsv(r){
 const lines=[['4F 能源基準績效比較（固定模擬資料）'],['區域',r.zone],['分析月份',r.month],['基準月份',r.baselineMonth],['共同日數',r.days],['指標','基準','本期','單位'],['設施用電',r.base.facility,r.actual.facility,'kWh'],['IT 用電',r.base.it,r.actual.it,'kWh'],['每日平均用電',r.base.daily,r.actual.daily,'kWh/day'],['能源加權 PUE',r.base.pue,r.actual.pue,'kWh/kWh'],['冷卻用電／IT 用電',r.base.coolingIntensity,r.actual.coolingIntensity,'kWh/kWh'],['依本期 IT 負載換算的基準設施用電',r.expected,'','kWh'],['本期減換算基準（正值為超耗）',r.variance,'','kWh'],['PUE 改善率（正值為改善）',r.improvement,'','%'],['PUE 改善目標',r.targetPercent,'','%'],['備註','按兩個月份共同日數比較；基準 PUE 乘本期 IT 電量，未校正氣候或設備組成，不代表已驗證節能量。']];
 return '\ufeff'+lines.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
}
