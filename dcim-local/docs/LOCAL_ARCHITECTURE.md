# 本地 3D DCIM 規劃與 Prototype 對照

## 目標與目前交付

以 4F 33 櫃模型完成「看狀態 → 定位機櫃 → 查看資產 → 調整配置 → 確認告警 → 匯出報表」的展示流程。介面沿用參考圖的深色管理平台、中央 3D、左右監控資訊面板，改用較簡潔的青綠與藍色層級。場址標示為緯創樓 4F，不沿用參考截圖中的其他機構名稱。

現在是 prototype，不是正式 BMS／DCIM。CCTV 明確採照片，不建置影片中繼服務。

## 分層

| 層級 | 本版實作 | 正式版方向（尚未實作） |
| --- | --- | --- |
| 數位儀表板 | React、Three.js、GLTFLoader／DRACOLoader、圖表、模擬數據 | 設備圖層、歷史回放、可靠的離線／過期狀態 |
| 資產管理 | SQLite 持久化、U 位與服務歸屬、展示角色、CSV | CMDB 欄位、組態版本、真正 RBAC、資產履歷、維修工單 |
| 數據中台 | Node HTTP API、3 秒 SSE 模擬推播、統一 rackId | 收集器獨立程序、正規化資料、規則引擎、補傳／去重 |
| 環控系統 | 模擬電力、UPS、PDU、空調、消防、溫濕度及漏水 | 優先接既有 BMS API；必要時由轉接器讀 Modbus／BACnet／IO |
| 資訊統合 | 示意網通狀態、以服務欄位整理資產 | SNMPv3 輪詢／Trap、LLDP、NetFlow 收集與分析 |
| CCTV／門禁 | 4 張靜態照片及模擬進出紀錄 | 若後續需要影片，另加入 RTSP 中繼與瀏覽器串流；門禁另接既有 API |

瀏覽器只存取本地 HTTP API 與資源。未來的 Modbus、BACnet、SNMP 等協定由伺服器側轉接器處理，不在瀏覽器直接操作設備。

## 本地執行佈局

- 展示版：單一 Node 程序，同時服務已建置前端、`/api/*`、`/api/events`、GLB、Draco 及 CCTV 照片，綁定 `127.0.0.1:3001`。
- 開發版：Vite `127.0.0.1:5173`，`/api` 代理至 Node `3001`。
- 資料保存在專案 `data/`，沒有雲端依賴。
- Docker 不是本版前提。本機查得 Node 24.22.0 可用；Docker CLI 有安裝但 daemon 未執行。
- 如改為多人內網展示，先建立認證與權限再改綁定介面。此版 UI 的角色只是可編輯展示資料，不會限制 API 操作。

## UI 內容與欄位

| 模組 | 畫面資訊 | Prototype 來源與行為 |
| --- | --- | --- |
| 總覽 | 設施功率、IT 功率、PUE、溫度、U 位率、待處理告警 | IT 功率取 33 櫃加總；PUE 為設施功率／IT 功率；U 位率由資產計算 |
| 電力／UPS | 電壓、電流、功率因數、電池%、續航時間 | 模擬數值；續航不是實際電池模型或承諾 |
| PDU | A／B 路負載 | 固定分流展示；尚無每插座資產關聯 |
| 空調／環境 | 送風、回風、溫度、濕度、漏水 | 動態機櫃溫度與固定示意空調資訊 |
| 消防 | 煙霧、主機狀態 | 只讀展示，無消防控制指令 |
| 門禁 | 在場人數、今日進出、准許／拒絕紀錄 | 模擬紀錄，不含人員身分資料 |
| CCTV | 位置、攝影機 ID、示意照片 | 相片選擇與放大，標記 STATIC DEMO |
| 告警 | ID、級別、系統、機櫃、條件、發生／確認時間 | 初始 6 筆固定事件，確認狀態寫入 SQLite |
| 機櫃 | 位置、42U 正面、占用率、功率、溫度 | 選取與 GLB 根節點綁定；U 位編輯由後端驗證 |
| 資產 | ID、名稱、類型、機櫃、U 位、高度、功率、廠商、型號、序號、服務、管理單位 | 初始 165 筆示意資產；資料 CRUD 與持久化 |
| 組態管理 | U 位／機櫃變更、基本操作履歷 | 目前只記錄動作與資產 ID；完整差異、版本、回復機制留待後續 |
| 服務關聯 | 核心應用、備份、網路連接與資產 | 依可編輯 service 欄位展示；非實際網路探索 |
| 報表 | 資產、告警、模擬日用電 | CSV；無 PDF 排程、長期趨勢或正式分析引擎 |

## 模型與資產綁定

使用穩定 rackId：`4F-A-01…11`、`4F-B-01…22`。

GLB 機櫃根節點的 `name` 與 JSON 資料 `rackId` 一致。Raycaster 點到子 mesh 後向上尋找 `userData.Zone` 根節點；選取框由該節點 Box3 計算。模型維持公尺單位，glTF 採 Y-up。

選取的是機櫃，不把所有電源櫃誤當 IT 機櫃。UPS／CRAC 等設備目前沒有正式 deviceId 與精確告警點位映射，相關監測畫面屬展示資訊。正式版需在 Blender 或 sidecar registry 補上 `deviceId`、`system`、`zone`、`sensorId`。

GLTFLoader 配合 DRACOLoader 載入壓縮幾何，解碼器置於本地 `public/draco/`。[Three.js GLTFLoader 官方文件](https://threejs.org/docs/pages/GLTFLoader.html)

## API 與資料

| API | 作用 |
| --- | --- |
| GET `/api/health` | 模擬模式及本地服務狀態 |
| GET `/api/bootstrap` | 資產、告警、展示使用者、系統名稱、當前遙測、操作紀錄 |
| GET `/api/telemetry` | 當前模擬數值 |
| GET `/api/events` | 每 3 秒 SSE 事件；斷線由 EventSource 重新連線 |
| POST `/api/assets` | 新增資產 |
| PATCH／DELETE `/api/assets/:id` | 編輯／刪除資產 |
| POST `/api/alerts/:id/ack` | 冪等確認操作，不代表設備恢復正常 |
| POST `/api/users`、PATCH `/api/users/:id` | 展示使用者資料操作 |

SQLite 本版採 `records(kind,id,data)` 儲存 JSON，`audit` 保存操作。U 位寫入與重疊檢查在同一 `BEGIN IMMEDIATE` 交易內執行。這是 prototype 資料形態，不宣稱正式的時序或 CMDB schema。

後續收集器的標準點位建議包含：`deviceId`、`pointId`、`value`、`unit`、`observedAt`、`receivedAt`、`quality`（good／stale／bad）、`source`、`sequence`。資料來源與狀態過期必須可見，不能把斷線顯示為正常。

## 後續實施順序（尚未開發）

1. **確認 UI prototype**：核對版面、33 櫃位置、告警定位、資產編輯流程及需要的資訊。
2. **單一環控資料源試接**：拿到設備清冊、API／點位表後，先接電表或溫濕度；驗證單位、採樣間隔、失聯及時鐘。
3. **告警及正式資料層**：加入規則、延遲／防抖、去重、解除／復歸、事件時間線；SQLite 改為 PostgreSQL，遙測按時間分割與保留策略，並測試備份復原。PostgreSQL 支援時間範圍分割，但分割維護與保留需自行規劃。[官方分割文件](https://www.postgresql.org/docs/current/ddl-partitioning.html)
4. **網通與 CMDB**：完成 SNMP／LLDP 等現場串接，建立電力、網路、服務間的實際依賴；NetFlow 不等同實體接線拓樸。
5. **內網正式運行**：OIDC／AD 或既有身分系統、RBAC、稽核、TLS、備份、監測；由確認的網段與帳號存取。
6. **可選影片階段**：只有後續需要即時影像時才加入 MediaMTX 等中繼；瀏覽器用 WebRTC／HLS，需先確認攝影機編碼相容性。這不在本次照片 prototype 範圍內。[MediaMTX 瀏覽器讀取](https://mediamtx.org/docs/read/web-browsers)

要進入真實設備串接階段，需補充 BMS API 規格、Modbus register／BACnet object／SNMP OID 清單、設備 ID 與 3D 位置、閾值及異常處理流程。Prototype 不要求先提供這些資料。

### 2026-11-11：參考 TaipeiCityHall 的渲染升級

參考 `TaipeiCityHall/scada-vue/src/components/ThreeFloorViewer.vue` 的 RoomEnvironment／PMREM、環境遮蔽與 EffectComposer，以及 `GisSceneViewer.vue` 的 AgX 色調與互動時降低解析度策略。實作集中在 `src/rendering/pipeline.js`，場景與業務選取仍由 `Scene.jsx` 管理。

精緻模式流程為 RenderPass → SSAO → 低強度 Bloom → 自訂邊緣明暗 Shader → SMAA 反鋸齒 → OutputPass。透明玻璃不寫入 AO 的不透明深度，避免封閉通道產生整片黑影；玻璃、金屬與樓板各自調整粗糙度及反射。陰影使用目前 Three.js 支援的 PCFShadowMap，模型及牆體可見性變更時更新陰影貼圖。流暢模式略過後製，保留材質與燈光。操作時降低像素比，停止操作後恢復。所有環境光資源在本地產生，不依賴外部 HDR/CDN。

本次改善屬網頁即時渲染層；原始 Blender 與 Draco GLB 幾何、33 櫃 ID 及模擬監測資料未修改。未加入光線追蹤或 CFD 氣流求解。

反鋸齒：精緻模式使用 SMAAPass，依目前安裝的 Three.js API 放在 OutputPass 前的 linear-sRGB 階段；緩衝區由 Composer 配合視窗及像素比調整。流暢模式維持 WebGLRenderer 的 antialias 原生反鋸齒。SMAA 查找貼圖內嵌於模組，不需外部下載。

### 2026-11-11：控制室版面、PUE 與 Heatmap

畫面採上方置中標題／導覽、左右資訊欄及中央 3D。能耗管理為主導覽頁面；資產、服務關聯、報表及使用者移到「更多」。窄螢幕的能耗面板移到場景下方，仍能操作設定。

- `shared/energy.mjs`：PUE 計算、模擬歷史、設定驗證與熱圖刻度的共用定義。
- 即時值以設施功率／IT 功率標為估算；6／24 個完整小時的期間 PUE 使用 Σ設施 kWh／ΣIT kWh，不使用比值的算術平均。零分母、無資料及設施低於 IT 的資料回傳無效值，不渲染成 0。
- `GET /api/bootstrap` 增加 energySettings 與 energyHistory；`PATCH /api/settings/energy` 將目標、警示、高溫與高功率門檻寫入 SQLite 並記錄 audit。這些設定僅改變能耗頁狀態及排行，不自動修改既有模擬告警或控制設備。
- `src/rendering/heatmap.js` 依 GLB 的 33 座機櫃世界座標建立 A／B 熱圖平面，以 Shader 插值每櫃溫度或 kW，固定色階避免畫面自動重新縮放造成誤讀；無效讀值不繪色。提供區域、透明度及圖層開關。此平面位於模型上方以便觀看，並非實際感測器高度或 CFD 結果。
- PUE 歷史是固定形狀的模擬時段資料，載入時對齊最近完整小時，並未蒐集現場歷史；CSV 明列 simulation。A／B 區選擇僅篩選熱圖與排行，PUE 仍使用 4F 整體模擬量測邊界。

PUE 定義參考：[The Green Grid — Power Usage Effectiveness](https://www.thegreengrid.org/node/372)。正式串接需確認總表／IT 表量測邊界與同步時段。

### 2026-11-11：拓樸映射、區域容量、多點位規則及 EMS 預測

- 拓樸：`TopologyMapping` 綁定 UPS／CORE／PDU／ToR 節點至清冊資產，或手動登錄設施設備名稱與序號。SQLite 保存版本、異動說明及歷程；驗證管理員、設備類型、機櫃位置與重複資產綁定。既有連線版本仍為瀏覽器儲存；本輪不是現場接線驗證或逐埠資源鎖定。
- 容量：方案增加 A／B 區冷卻容量，扣除預留百分比後與同區已登錄／預留額定功率比較。推薦、建單、驗收共用檢查；修改其他同區機櫃資產也會保護有效預留的區域餘裕。數值是每份方案的假設，尚未連接實際空調設備能力。
- 告警：多點位高溫、高濕、低濕、漏水規則，按區域套用、各 Tag 獨立持續計時與復歸；缺值／間隔超過 15 秒重新計時。同類規則不得重疊，生效告警不可任意改門檻。B-07 溫度沿用既有單點規則。首點異常情境最多 120 秒，與系統監測使用相同覆寫值。訊號復歸不自動結案，可延續告警轉工單流程。
- EMS：能源歷史頁加入 15 分鐘區間內預測，提供時間進度、最近三分鐘／已知平均兩種估算、累積電量、可用功率及所需降載。分鐘序列由歷史區間平均需量生成並保持區間能量一致，尚非現場分鐘電表；不自動執行控制。逐埠容量預留、電價時段擴充仍未包含於本批。
- 總覽：移到 3D 機櫃即顯示資產資訊卡，依 U 位由上到下列出名稱、類型、資產 ID、U 區間及額定功率。最多顯示六筆並提示剩餘數，點擊保留原有機櫃詳情操作；拖曳、移出或切換區域收起卡片。資訊直接讀取目前資產清冊。
- 驗證：117 項自動測試通過；正式前端建置通過（仍有既有大 bundle 提示）。瀏覽器確認映射表單與 B-08 hover 資訊卡；新增 API GET 回應正常。測試資料庫驗證映射衝突、跨櫃區域容量、告警觸發／復歸與預測邊界。截圖：`docs/screenshots/rack-hover-assets.png`。

### 2026-11-11：依機櫃走道動畫重製上方配線

- 參考使用者提供的 `機櫃走道.mp4`，新增雙路黃／橙 busway 的端緣、接合片、每櫃分接箱與操作面板。
- 33 櫃各有兩條彎折電源下引線，共 66 條；資料線四條／櫃，共 132 條，經較低層銀色網籃進入櫃頂。另補網籃橫線、側網、縱向線束、吊桿與橫擔。
- `scripts/upgrade_overhead.py` 可重複套用；每區按七種材質合併網格，完整重建腳本也會呼叫此步驟。備份位於 `output/4F/backup-before-overhead`。
- 已更新 Blender 原檔、Draco GLB 及本地網站 `public/models/4f.glb`，快取版本 `overhead-services-2`。Draco 解碼回讀驗證 A11／B22 與原建築邊界；GLB 約 1.15 MB。瀏覽器已檢視 B 區近景與櫃頂下引線。
- 配線外觀及尺度是動畫參考下的示意建模，不更改資產電力容量或宣稱已完成現場機電設計。

### 2026-11-11：實體埠整合、3D 關聯、多系統告警及分時計費

1. 實體埠：`physical-ports.mjs` 為上架預留指定每路 PDU 插座及 ToR 埠號，依 C13／C19／RJ45／SFP 配置且避免占用衝突。新預留與驗收在 SQLite 交易內驗證，驗收將同一配置寫入新資產及拓樸；未預留／已釋放／舊預留於驗收時重新分配。管理員可在上架工單取消並釋放資源，取消後可重提同一方案。原容量總量仍採每櫃保守池限制，不因 A/B 路各有端點而增加可規劃容量。
2. 拓樸連線：改存後端 settings/physical-topology，帶 revision 防止覆寫；既有瀏覽器連線可透過明確匯入按鈕套用，衝突會拒絕。版本備份仍為瀏覽器保存，回復需經後端預留衝突檢查；支援多埠設備。移櫃會重新配置埠並保護其他預留。
3. 3D：總覽的「管線／設備連動」啟用母線點選與櫃頂黃色 PDU／藍色 ToR 標記。選取後顯示已保存拓樸的下游設備、關聯機櫃總功率及路徑中斷預覽，金色標示涉及機櫃。busway 的 A/B 路對應 UPS-A/B 並限於所選區域；關聯機櫃總功率不是該單路實測，其他路徑存在不保證備援能力。櫃頂標記為互動定位，不表示真實設備外觀或位置。
4. 告警：新增機櫃功率、UPS 電量偏低、空調送風高溫與交換器離線；沿用持續／復歸門檻。僅已核准、尚未結束工單的台北維護時段且確切 rackId 相符時，抑制新事件；區域 UPS／空調不因單櫃維護而整區抑制。既有 active 訊號仍追蹤復歸；未結案同規則同 Tag 再觸發合併回原事件並累計次數及歷程。規則版本紀錄可展開檢視。
5. EMS：`tou-cost.mjs` 使用既有 15 分鐘模擬曲線，套用自訂尖峰起訖、週末及指定假日、契約費及超約費。比較選定日期／時段的 0–16 kW 空調降載；重新計算整段最高需量，保留其他尖峰時不誇大需量費節省。支援設定保存及逐區間 CSV。未整合官方費率、稅或空調回補能耗，未連接現場控制。部分月份明確保留完整契約費，不能視為正式帳單。
6. 驗證：瀏覽器實際點選 B 區 A 路 busway，顯示 22 櫃／110 台與影響標示；建立 WO-e1b29192，預留 A05 兩路 PDU／ToR #6，確認後取消並釋放。離線規則產生 AL-S-677da5db，恢復後 SW-A-LINK 顯示連線／正常，事件保留待人工處置。新增自動測試涵蓋衝突、驗收沿用、取消重提、多埠備份、維護時間邊界、離線復歸與分時費用。

### 2026-11-11 運維 Chat
- GenAI 上方提供獨立查詢入口，分為值班、工單、巡檢、環境設備與能源五個主題。
- `shared/operations-query.mjs` 解析本地資料查詢，支援全區、A/B 區與機櫃範圍延續；不連接 LLM。
- 每次查詢刷新 bootstrap、工單與巡檢資料，回覆包含表格、來源時間與紀錄跳轉。讀取失敗顯示錯誤，不使用空資料冒充結果。
- 查詢不執行寫入；決策操作仍沿用事件及條件檢查。完成期限逾期依台北日期判斷，與 SLA 計時分開。
- 分頁 sessionStorage 保留最近 40 組問答，支援 TXT 匯出與新對話。
- Word 錄影腳本 v1.1 增加運維查詢分鏡，23 頁、約 29 分鐘。

### 2026-11-12 GitHub Pages 公開展示
- GitHub Actions：`.github/workflows/pages.yml`，Node 24、npm ci、測試、Pages 建置及部署。
- `src/entry.mjs` 依 build mode 決定是否啟動瀏覽器 runtime；本地模式仍呼叫 Node API。
- `server/store-core.mjs` 共用資料模型與交易驗證，`server/store.mjs` 僅包裝 Node SQLite。
- `server/api.mjs` 共用所有 API 路由；Node 保留 localhost 與來源檢查，公開版 API 在分頁內執行。
- `browser/runtime.mjs` 使用 SQL.js/WASM 與 IndexedDB，以 sessionStorage UUID 隔離每個分頁的模擬資料。沒有共用公開寫入後端。
- 分頁重新整理保留資料，新分頁使用新種子資料。瀏覽器拒絕儲存或空間不足時顯示錯誤。
- 模型、Draco 解碼器、品牌圖與 CCTV 皆套用 Vite base。巡檢照片透過 fetch/Blob 顯示與下載，支援本地及公開模式。
- `tests/browser-store.test.mjs` 驗證 SQLite 匯出回讀、交易回滾、獨立種子資料、工單／RFI 路由及雜湊一致性。
