import React,{createContext,useContext,useEffect,useState} from 'react';
const Context=createContext();
const names=['機房總覽','告警總覽','系統監測','能耗管理','GenAI 決策','機櫃配置','環境監測','資產管理','資產生命週期','資產維護履歷','電力與網路拓樸','服務關聯','報表分析','能源歷史與月報','告警處置與歷程','工單管理','容量規劃','資產巡檢','站內通知','組織與部門','使用者管理','資安日誌','介面設定','監控與營運','資產與配置','維護與報表','管理','使用說明'];
const english=['Room overview','Alarm overview','System monitoring','Energy management','GenAI decisions','Rack configuration','Environment','Assets','Asset lifecycle','Asset history','Power & network topology','Service dependencies','Reports','Energy history','Alarm lifecycle','Work orders','Capacity planning','Inspections','Notifications','Organization','Users','Security logs','Appearance & language','Monitoring & operations','Assets & configuration','Maintenance & reports','Administration','Help'];
const dictionary=Object.fromEntries(names.map((n,i)=>[n,english[i]]));
Object.assign(dictionary,{'隱藏功能選單':'Hide navigation','展開功能選單':'Show navigation','關閉功能選單':'Close navigation','緯創樓數據中心':'Wistron Data Center','資訊中心':'Operations Center','更新':'Refresh','更新於':'Updated','切換介面明暗':'Toggle light / dark','查看告警':'View alarms','本地服務連線':'Local service connected','重新連線中':'Reconnecting','使用者':'User','電子郵件':'Email','角色':'Role','狀態':'Status','操作':'Actions','新增使用者':'Add user','編輯':'Edit','管理人員資料、角色及啟用狀態。':'Manage user profiles, roles and availability.','啟用':'Enabled','停用':'Disabled','管理員':'Administrator','維運人員':'Operator','唯讀':'Read only','匯出報表':'Export report'});
export function PreferencesProvider({children}){
 const [prefs,setPrefs]=useState(()=>{try{const p=JSON.parse(localStorage.getItem('aidc.ui.preferences'));return {lang:p?.lang==='en'?'en':'zh',theme:['ocean','graphite','forest','light'].includes(p?.theme)?p.theme:'ocean'};}catch{return {lang:'zh',theme:'ocean'};}}),[error,setError]=useState('');
 const update=patch=>setPrefs(p=>({...p,...patch}));
 useEffect(()=>{document.documentElement.lang=prefs.lang==='en'?'en':'zh-Hant';document.documentElement.dataset.theme=prefs.theme;try{localStorage.setItem('aidc.ui.preferences',JSON.stringify(prefs));setError('');}catch{setError(prefs.lang==='en'?'Preferences could not be saved.':'偏好設定無法儲存。');}},[prefs]);
 const t=(zh,en)=>prefs.lang==='en'?(en||dictionary[zh]||zh):zh;
 return <Context.Provider value={{...prefs,update,t,error}}>{children}</Context.Provider>;
}
export const usePreferences=()=>useContext(Context);
export {default as Appearance} from './Appearance';
