import {Buffer} from 'buffer';
export function validateEvidence(body){
 const name=String(body.name||'').split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f]/g,'').trim();
 const note=String(body.note||'').trim();
 if(!name||name.length>120||!note||note.length>300)throw Error('檔名限 120 字，請填寫 300 字內佐證說明');
 if(typeof body.data!=='string'||body.data.length>2800000||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.data))throw Error('附件編碼無效或過大');
 const bytes=Buffer.from(body.data,'base64');if(!bytes.length||bytes.length>2*1024*1024)throw Error('單一附件上限 2 MB');
 const png=bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpg=bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const webp=bytes.length>=16&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 const mime=png?'image/png':jpg?'image/jpeg':webp?'image/webp':null;
 if(!mime||mime!==body.mime)throw Error('僅接受 PNG、JPEG 或 WebP 圖片，檔案格式須一致');
 return {name,note,mime,size:bytes.length,data:body.data};
}
