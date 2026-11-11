import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectionReport,inspectionCsv,taipeiDate} from '../shared/inspection-reports.mjs';
const rows=[{id:'1',title:'=SUM(1)',createdAt:'2026-11-10T16:30:00Z',rackId:'4F-A-01',due:'2026-11-11',state:'completed',items:[{label:'電源',result:'abnormal',note:'a,"b"\n新行'}]},{id:'2',createdAt:'2026-11-10T15:00:00Z',rackId:'4F-B-01',due:'2026-11-10',state:'working',items:[{label:'風扇',result:'normal'}]}];
test('inspection report date boundaries, filters, overdue and empty summary',()=>{
 assert.equal(taipeiDate(rows[0].createdAt),'2026-11-11');
 const all=inspectionReport(rows,{},new Date('2026-11-11T00:00:00Z'));assert.equal(all.overdue,1);assert.equal(all.unlinked,1);assert.equal(all.abnormalItems,1);
 assert.equal(inspectionReport(rows,{from:'2026-11-11',to:'2026-11-11',zone:'A',state:'completed'}).total,1);
 assert.equal(inspectionReport(rows,{zone:'B',state:'completed'}).total,0);
 assert.equal(inspectionReport([{...rows[1],due:'2026-11-11'}],{},new Date('2026-11-11T00:00:00Z')).overdue,0);
});
test('inspection CSV preserves notes and protects spreadsheet formulas',()=>{const csv=inspectionCsv(rows,[]);assert.ok(csv.startsWith('\ufeff'));assert.ok(csv.includes('"\'=SUM(1)"'));assert.ok(csv.includes('"a,""b""\n新行"'));assert.ok(csv.includes('2026-11-11'));});
