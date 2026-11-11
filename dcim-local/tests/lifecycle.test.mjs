import test from 'node:test';import assert from 'node:assert/strict';
import {validDate,validateLifecycle,lifecycle,taipeiDate} from '../shared/lifecycle.mjs';
import {createStore} from '../server/store.mjs';
test('lifecycle uses calendar dates and inclusive expiry boundaries',()=>{
 assert.equal(taipeiDate(new Date('2026-11-10T16:00:00Z')),'2026-11-11');
 assert.equal(validDate('2026-02-29'),false);assert.equal(validDate('2024-02-29'),true);
 for(const [date,state] of [['2026-11-10','expired'],['2026-11-11','soon'],['2026-12-11','soon'],['2026-12-12','covered'],['','unknown']])assert.equal(lifecycle({warrantyUntil:date},'2026-11-11',30).warrantyState,state);
 assert.equal(lifecycle({replacementOn:'2026-01-01'},'2026-11-11').replacementDue,true);assert.equal(lifecycle({},'2026-11-11').replacementDue,false);
 assert.throws(()=>validateLifecycle({commissionedOn:'2026-12-01',replacementOn:'2026-11-01'}));assert.throws(()=>validateLifecycle({warrantyUntil:null}));
});
test('asset lifecycle persists; invalid dates and reversed warranty do not mutate assets',()=>{const s=createStore(':memory:');try{const a=s.list('assets')[0];const dates={commissionedOn:'2025-01-01',warrantyUntil:'2026-11-11',replacementOn:'2027-01-01'};s.saveAsset({...a,...dates},a.id);for(const bad of [{replacementOn:'2026-02-30'},{warrantyUntil:'2024-12-31'}])assert.throws(()=>s.saveAsset({...a,...dates,...bad},a.id));const actual=s.list('assets').find(x=>x.id===a.id);for(const key of Object.keys(dates))assert.equal(actual[key],dates[key]);s.saveAsset({...actual,replacementOn:''},a.id);assert.equal(s.list('assets').find(x=>x.id===a.id).replacementOn,'');}finally{s.db.close();}});
