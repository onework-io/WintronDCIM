import test from 'node:test';
import assert from 'node:assert/strict';
import {answerQuestion} from '../shared/chat.mjs';
import {createRun} from '../shared/rfi.mjs';
test('chat uses selected event snapshot without changing control state',()=>{
 const run=createRun('normal','CHAT-TEST',new Date().toISOString()),before=JSON.stringify(run);
 const reply=answerQuestion('目前需量為什麼超標？',run);
 assert.match(reply.text,/252 kW/);assert.match(reply.source,/CHAT-TEST/);assert.equal(reply.action,'control');assert.equal(JSON.stringify(run),before);
 run.selected=[];assert.match(answerQuestion('降載能節省多少？',run).text,/降低 0 kW/);
});
test('chat reports restrictions and unsupported questions without invented answers',()=>{
 const run=createRun('hot','HOT',new Date().toISOString());
 assert.match(answerQuestion('有哪些安全條件？',run).text,/阻擋/);
 assert.equal(answerQuestion('查看事件報告',run).action,'report');
 assert.match(answerQuestion('明天天氣好嗎',run).text,/尚無對應/);
});
