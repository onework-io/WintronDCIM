import {assetUrl} from './public-assets.mjs';
import {usePreferences} from './Preferences';
import React,{useEffect,useRef} from 'react';
import {Menu,PanelLeftClose,CircleHelp} from 'lucide-react';
const groups=[['監控與營運',['overview','alerts','alertHistory','monitor','environment','energy','rfi']],['資產與配置',['racks','assets','capacity','topology','network','lifecycle','assetHistory']],['維護與報表',['workorders','inspections','notifications','reports','history']],['管理',['departments','users','security','appearance']]];
export default function Sidebar({open,onToggle,nav,page,onNavigate,onHelp}){
 const {t}=usePreferences();
 const toggle=useRef(null);
 useEffect(()=>{function key(e){if(e.key==='Escape'&&open&&document.getElementById('dcim-sidebar')?.contains(e.target)){onToggle(false);toggle.current?.focus();}}document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[open,onToggle]);
 return <><div className="sidebar-logo"><img src={assetUrl('/branding/wistron-transparent.png')} alt="Wistron 緯創" /></div><button ref={toggle} className="sidebar-toggle" aria-label={t(open?'隱藏功能選單':'展開功能選單')} title={t(open?'隱藏功能選單':'展開功能選單')} aria-expanded={open} aria-controls="dcim-sidebar" onClick={()=>onToggle(!open)}>{open?<PanelLeftClose size={20}/>:<Menu size={20}/>}<span>{open?'收合選單':'選單'}</span></button>{open&&<><button className="sidebar-backdrop" aria-label="關閉功能選單" onClick={()=>onToggle(false)}/><aside className="dcim-sidebar" id="dcim-sidebar"><div className="sidebar-title"><b>AIDC</b><small>4F · A／B 區</small></div><nav aria-label="主導覽">{groups.map(([label,ids])=><section key={label}><h2>{t(label)}</h2>{ids.map(id=>{const item=nav.find(n=>n[0]===id);if(!item)return null;const [,name,Icon]=item;return <button key={id} aria-current={page===id?'page':undefined} className={page===id?'active':''} onClick={()=>{onNavigate(id);if(window.innerWidth<=900){onToggle(false);toggle.current?.focus();}}}><Icon size={17}/><span>{name}</span></button>;})}</section>)}<button onClick={onHelp}><CircleHelp size={17}/><span>{t('使用說明')}</span></button></nav></aside></>}</>;
}
