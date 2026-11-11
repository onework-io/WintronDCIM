export function topologyMappingMethods({list,put,transaction,audit}){return {topologyMappings:()=>list('topologyMappings'),saveTopologyMapping(body){return transaction(()=>{
 const actor=list('users').find(u=>u.id===body.actorId&&u.enabled&&u.role==='管理員');if(!actor)throw Error('需要管理員');
 const node=String(body.nodeId||'');if(!/^(UPS|CORE)-[AB]$/.test(node)&&! /^(PDU|TOR)-4F-(A-(0[1-9]|1[01])|B-(0[1-9]|1[0-9]|2[0-2]))-[AB]$/.test(node))throw Error('節點無效');
 const old=list('topologyMappings').find(m=>m.id===node);if((old?.revision||0)!==body.revision)throw Error('映射已更新，請重新讀取');
 const assetId=String(body.assetId||''),asset=assetId?list('assets').find(a=>a.id===assetId):null;if(assetId&&!asset)throw Error('資產不存在');
 if(asset&&((node.startsWith('TOR')||node.startsWith('CORE'))?asset.type!=='switch':!['ups','pdu'].includes(asset.type)))throw Error('設備類型與節點不符');
 if(asset&&/^(TOR|PDU)-/.test(node)&&asset.rackId!==node.slice(4,-2))throw Error('資產不在此機櫃');
 if(assetId&&list('topologyMappings').some(m=>m.id!==node&&m.assetId===assetId))throw Error('同一設備不可映射成兩條獨立來源');
 const name=String(body.name||asset?.name||'').trim(),serial=String(body.serial||asset?.serial||'').trim(),note=String(body.note||'').trim();if(!name||name.length>100||serial.length>100||!note||note.length>500)throw Error('請填設備名稱及 500 字內異動說明');
 const at=new Date().toISOString(),r={id:node,assetId,name,serial,revision:(old?.revision||0)+1,updatedAt:at,history:[...(old?.history||[]),{at,actor:actor.name,note,before:old?{assetId:old.assetId,name:old.name,serial:old.serial}:null,after:{assetId,name,serial}}]};put.run('topologyMappings',node,JSON.stringify(r));audit('topology.mapping.updated',node);return r;
 });}};}
