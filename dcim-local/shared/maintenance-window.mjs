import {validDate} from './lifecycle.mjs';
export function validateWindow({start='',end='',note=''}={}){
 if(typeof note!=='string'||note.length>2000)throw Error('作業說明請限制在 2000 字內');
 if(!start&&!end)return {start:'',end:'',note:note.trim(),minutes:null};
 const valid=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)&&validDate(v.slice(0,10))&&Number(v.slice(11,13))<24&&Number(v.slice(14,16))<60;
 if(!valid(start)||!valid(end))throw Error('請完整填寫有效的開始與結束時間');
 const minutes=(Date.parse(end+':00+08:00')-Date.parse(start+':00+08:00'))/60000;
 if(minutes<=0)throw Error('結束時間必須晚於開始時間');
 return {start,end,note:note.trim(),minutes};
}
export function windowConflicts(window,racks,plans){if(!window.start||!window.end)return [];return plans.filter(p=>p.window?.start&&p.window?.end&&window.start<p.window.end&&window.end>p.window.start&&p.racks.some(id=>racks.includes(id)));}
