async function start(){
 if(import.meta.env.MODE==='pages'){
  document.getElementById('root').textContent='正在準備 4F 數位孿生…';
  const {installDemoRuntime}=await import('../browser/runtime.mjs');
  await installDemoRuntime();
 }
 await import('./main.jsx');
}
start().catch(error=>{
 console.error(error);
 const root=document.getElementById('root');root.replaceChildren();
 const message=document.createElement('p');message.textContent='展示環境載入失敗：'+error.message;
 const retry=document.createElement('button');retry.textContent='重新載入';retry.onclick=()=>location.reload();root.append(message,retry);
});
