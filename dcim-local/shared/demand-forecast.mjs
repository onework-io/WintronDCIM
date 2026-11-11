// Integrates minute-average kW samples; never treats instantaneous power as interval demand.
export function forecastDemand(samples,{elapsed,contract,mode='recent'}){
 if(!Number.isInteger(elapsed)||elapsed<1||elapsed>15||!Number.isFinite(contract)||contract<=0||!['recent','average'].includes(mode))throw Error('預測參數無效');
 const seen=samples.slice(0,elapsed);if(seen.length!==elapsed||seen.some(v=>!Number.isFinite(v)||v<0))throw Error('分鐘資料不足或缺值');
 const energy=seen.reduce((s,v)=>s+v,0)/60,tail=mode==='recent'?seen.slice(-3):seen,remainingPower=tail.reduce((s,v)=>s+v,0)/tail.length,remaining=15-elapsed;
 const projectedKwh=energy+remainingPower*remaining/60,forecastKw=projectedKwh*4,energyBudget=contract/4-energy;
 return {elapsed,energy,remainingPower,forecastKw,remaining,availableKw:remaining?Math.max(0,energyBudget*60/remaining):null,requiredReduction:remaining?Math.max(0,remainingPower-energyBudget*60/remaining):0,alreadyExceeded:energy>contract/4,complete:remaining===0};
}
export function minuteScenario(intervalKw){return Array.from({length:15},(_,i)=>intervalKw*(.86+i*.02));}
