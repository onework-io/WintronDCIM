import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import {createHash as nodeHash} from 'node:crypto';
import {createHash} from '../shared/identity.mjs';
import {adaptDatabase} from '../browser/database.mjs';
import {createStoreFromDatabase} from '../server/store-core.mjs';
import {handleApi} from '../server/api.mjs';
import {telemetry} from '../server/domain.mjs';
const SQL=await initSqlJs();
function setup(bytes){const db=new SQL.Database(bytes);return {db,store:createStoreFromDatabase(adaptDatabase(db))};}
async function api(store,path,method='GET',body){let status,payload;await handleApi({url:path,method,headers:{},async *[Symbol.asyncIterator](){if(body)yield JSON.stringify(body);}},{writeHead(s){status=s;},end(v){payload=v;}},{store,telemetry,streams:new Set(),port:0,publicDemo:true});return {status,data:JSON.parse(payload)};}
test('browser SQLite preserves assets and rollback validation across export/import',()=>{
 const {db,store}=setup();const a=store.list('assets')[0],size=store.list('assets').length;
 store.saveAsset({...a,name:'Browser saved asset'},a.id);
 assert.throws(()=>store.saveAsset({...a,uStart:43},a.id));
 const restored=setup(db.export());assert.equal(restored.store.list('assets').length,size);assert.equal(restored.store.list('assets').find(x=>x.id===a.id).name,'Browser saved asset');db.close();restored.db.close();
});
test('browser domain hashes match Node fingerprints',()=>{const value='4F B 區容量方案';assert.equal(createHash('sha256').update(value).digest('hex'),nodeHash('sha256').update(value).digest('hex'));});
test('public API bootstraps isolated stores and supports workflow mutations',async()=>{
 const a=setup(),b=setup();const boot=await api(a.store,'/api/bootstrap');assert.equal(boot.status,200);assert.equal(boot.data.telemetry.racks.length,33);
 const users=boot.data.users;const assignee=users.find(u=>u.enabled&&u.role==='維運'),reviewer=users.find(u=>u.enabled&&u.role==='管理員');
 const created=await api(a.store,'/api/workorders','POST',{alertId:boot.data.alerts[0].id,assigneeId:assignee.id,reviewerId:reviewer.id,description:'公開展示測試',priority:'critical'});
 assert.equal(created.status,201,JSON.stringify(created.data));assert.equal(a.store.list('workorders').length,b.store.list('workorders').length+1);
 const run=await api(a.store,'/api/rfi','POST',{scenario:'normal'});assert.equal(run.status,201,JSON.stringify(run.data));
 const health=await api(a.store,'/api/health');assert.equal(health.data.localOnly,false);assert.equal(health.data.storage,'Browser SQLite');
 a.db.close();b.db.close();
});
test('browser API rejects unsupported routes',async()=>{const {db,store}=setup();assert.equal((await api(store,'/api/missing')).status,404);db.close();});
