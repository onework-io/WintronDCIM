import {dailyEnergy,months} from './history.mjs';
export const defaultCostSettings={mode:'flat',flatRate:4,peakRate:6,offPeakRate:2,peakHours:8,sharedCost:0,allocation:'it'};
export function validateCostSettings(s){
 if(!s||!['flat','tou'].includes(s.mode)||!['it','racks'].includes(s.allocation))throw Error('請選擇有效費率與分攤方式');
 for(const k of ['flatRate','peakRate','offPeakRate','sharedCost','peakHours'])if(typeof s[k]!=='number'||!Number.isFinite(s[k])||s[k]<0)throw Error('費率、時數及費用須為非負數字');
 if(['flatRate','peakRate','offPeakRate'].some(k=>s[k]>100)||s.sharedCost>10000000||s.peakHours>24)throw Error('費率上限 100 元，尖峰時數上限 24，期間共同費用上限 1,000 萬');
 return Object.fromEntries(Object.keys(defaultCostSettings).map(k=>[k,s[k]]));
}
const cents=n=>Math.round(n*100);
export function energyCost(month,settings){
 if(!months.includes(month))throw Error('無效分析月份');
 const s=validateCostSettings(settings),rate=s.mode==='flat'?s.flatRate:(s.peakRate*s.peakHours+s.offPeakRate*(24-s.peakHours))/24;
 const zones=['A','B'].map(zone=>{const rows=dailyEnergy(month,zone);return {zone,racks:zone==='A'?11:22,days:rows.length,itKwh:rows.reduce((n,r)=>n+r.itKwh,0),facilityKwh:rows.reduce((n,r)=>n+r.facilityKwh,0)};});
 const denominator=zones.reduce((n,z)=>n+(s.allocation==='it'?z.itKwh:z.racks),0),shared=cents(s.sharedCost);let used=0;
 zones.forEach((z,i)=>{z.share=(s.allocation==='it'?z.itKwh:z.racks)/denominator;const allocated=i===zones.length-1?shared-used:Math.round(shared*z.share);used+=allocated;z.energyCost=cents(z.facilityKwh*rate)/100;z.sharedCost=allocated/100;z.total=(cents(z.energyCost)+allocated)/100;z.perRack=z.total/z.racks;z.peakKwh=s.mode==='tou'?z.facilityKwh*s.peakHours/24:0;z.offPeakKwh=s.mode==='tou'?z.facilityKwh-z.peakKwh:0;});
 return {month,settings:s,rate,days:zones[0].days,zones,facilityKwh:zones.reduce((n,z)=>n+z.facilityKwh,0),total:zones.reduce((n,z)=>n+cents(z.total),0)/100,energyCost:zones.reduce((n,z)=>n+cents(z.energyCost),0)/100,sharedCost:shared/100};
}
export function energyCostCsv(r){
 const rows=[['4F 自訂費率電費試算（非正式帳單）'],['月份',r.month],['資料日數',r.days],['模式',r.settings.mode],['單一費率',r.settings.flatRate],['尖峰費率',r.settings.peakRate],['離峰費率',r.settings.offPeakRate],['每日尖峰時數',r.settings.peakHours],['共同費用分攤方式',r.settings.allocation],['說明','分時模式假設每日用電均勻分配至24小時；不含實際需量費、稅額或電力公司費率。共同費用為本資料期間輸入金額，不另按月比例計算。'],['區域','設施kWh','IT kWh','尖峰kWh（估）','離峰kWh（估）','電能費TWD','共同費用TWD','合計TWD','每櫃均攤TWD'],...r.zones.map(z=>[z.zone,z.facilityKwh,z.itKwh,z.peakKwh,z.offPeakKwh,z.energyCost,z.sharedCost,z.total,z.perRack]),['總計',r.facilityKwh,'','','',r.energyCost,r.sharedCost,r.total]];
 return '\ufeff'+rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
}
