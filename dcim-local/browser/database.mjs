// Synchronous SQLite interface shared by Node and browser domain stores.
export function adaptDatabase(db){
 return {exec(sql){db.run(sql);},prepare(sql){
  const rows=params=>{const statement=db.prepare(sql);try{statement.bind(params);const result=[];while(statement.step())result.push(statement.getAsObject());return result;}finally{statement.free();}};
  return {all(...params){return rows(params);},get(...params){return rows(params)[0];},run(...params){db.run(sql,params);return {changes:db.getRowsModified()};}};
 },close(){db.close();}};
}
export async function openArchive(){
 return new Promise((resolve,reject)=>{const request=indexedDB.open('wistron-dcim-demo-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('sessions');request.onerror=()=>reject(request.error);request.onsuccess=()=>resolve(request.result);});
}
export function archiveRequest(archive,key,value){
 return new Promise((resolve,reject)=>{const writing=value!==undefined,transaction=archive.transaction('sessions',writing?'readwrite':'readonly');const store=transaction.objectStore('sessions'),request=writing?store.put(value,key):store.get(key);transaction.oncomplete=()=>resolve(request.result);transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error||Error('儲存失敗'));});
}
