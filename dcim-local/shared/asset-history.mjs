export function assetHistory(asset,{inspections=[],workorders=[],transfers=[]}){
 if(!asset)return [];
 const rows=[];
 for(const i of inspections.filter(i=>i.assetId===asset.id))rows.push({id:'inspection:'+i.id,type:'inspection',ref:i.id,at:i.createdAt,title:i.title,state:i.state,detail:`${i.rackId} · 異常 ${i.items.filter(x=>x.result==='abnormal').length} 項`,rackId:i.rackId});
 for(const w of workorders.filter(w=>w.assetId===asset.id||w.id===asset.sourceWorkOrderId))rows.push({id:'workorder:'+w.id,type:'workorder',ref:w.id,at:w.createdAt,title:w.title,state:w.state,detail:w.resolution||w.description||'',rackId:w.rackId||asset.rackId});
 for(const t of transfers){const a=t.assets.find(a=>a.id===asset.id);if(a)rows.push({id:'transfer:'+t.id,type:'transfer',ref:t.id,at:t.at,title:'部門資產移轉',state:'completed',detail:`${a.fromName} → ${t.toName} · ${t.reason} · ${t.actorName}`,rackId:a.rackId});}
 if(asset.installedAt)rows.push({id:'installed:'+asset.id,type:'installed',ref:asset.sourceWorkOrderId||'',at:asset.installedAt,title:'設備上架',state:'completed',detail:asset.sourceWorkOrderId?'來源工單 '+asset.sourceWorkOrderId:'資產上架紀錄',rackId:asset.rackId});
 return rows.sort((a,b)=>String(b.at).localeCompare(String(a.at))||a.id.localeCompare(b.id));
}
export function historyCsv(rows){const cell=v=>'"'+String(v??'').replace(/^\s*[=+@-]/,"'$&").replaceAll('"','""')+'"';return '\ufeff'+[['時間ISO','類型','紀錄ID','標題','狀態','紀錄機櫃','內容'],...rows.map(r=>[r.at,r.type,r.ref,r.title,r.state,r.rackId,r.detail])].map(row=>row.map(cell).join(',')).join('\r\n');}
