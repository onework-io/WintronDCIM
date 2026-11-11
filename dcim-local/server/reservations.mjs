import {checkPlan} from '../shared/capacity.mjs';
import {reservedAssets} from '../shared/reservations.mjs';
export function assertHeldLimits(reservations,assets,racks,excludeWorkId='',rackIds=null){
 const active=reservations.filter(r=>r.state==='active'&&r.workOrderId!==excludeWorkId);
 for(const hold of active){if(rackIds&&!hold.placements.some(p=>rackIds.includes(p.rackId)||((p.zoneCoolingA!==undefined||p.zoneCoolingB!==undefined)&&rackIds.some(id=>id.split('-')[1]===p.rackId.split('-')[1]))))continue;const others=reservedAssets(active.filter(r=>r.id!==hold.id));const issues=checkPlan({placements:hold.placements},racks,[...assets,...others]).flatMap(p=>p.issues.filter(i=>i!=='進風溫度異常或缺值'));if(issues.length)throw Error(`會影響預留 ${hold.id}：${issues[0]}`);}
}
export function reservationMethods({list,put,transaction,audit}){return {
 releaseReservation(id,body){return transaction(()=>{const user=list('users').find(u=>u.id===body.actorId&&u.enabled&&u.role==='管理員');if(!user)throw Error('僅管理員可釋放預留');const old=list('reservations').find(r=>r.id===id);if(!old)throw Error('預留不存在');if(body.revision!==old.revision)throw Error('預留狀態已更新，請重新載入');if(old.state!=='active')throw Error('此預留已結束');const reason=String(body.reason||'').trim();if(!reason||reason.length>500)throw Error('請填寫 500 字內釋放原因');const row={...old,state:'released',revision:old.revision+1,endedAt:new Date().toISOString(),releasedBy:user.id,reason};put.run('reservations',id,JSON.stringify(row));audit('capacity.reservation.released',id);return row;});}
};}
