export const defaultInspectionTemplate={id:'default',name:'通用設備巡檢',revision:0,enabled:true,items:['外觀與固定','電源與指示燈','散熱與風道','線材與標示']};
export function validateTemplate(body){
 const name=String(body.name||'').trim();if(!name||name.length>80)throw Error('範本名稱需為 1–80 字');
 if(!Array.isArray(body.items)||body.items.length<1||body.items.length>20)throw Error('檢查表需包含 1–20 項');
 const items=body.items.map(v=>String(v).trim());if(items.some(v=>!v||v.length>100))throw Error('每項名稱需為 1–100 字');if(new Set(items).size!==items.length)throw Error('檢查項目不可重複');
 return {name,items,enabled:body.enabled!==false};
}
