# Wistron 4F DCIM

4F A／B 區機房數位孿生展示平台，包含 Three.js 3D、33 座機櫃、DCIM、EMS 與 GenAI 運維對話流程。

## 本地執行

需要 Node.js 24。

```sh
cd dcim-local
npm ci
npm run build
npm start
```

瀏覽 http://127.0.0.1:3001 。開發模式：`npm run dev`（前端 5173、API 3001）。

```sh
npm test
```

首次啟動自動建立本地 SQLite 與展示資料。資料庫不納入 Git；目前採模擬資料，無真實 LLM 或現場設備控制連線。

## 專案內容

- `dcim-local/`：前後端、測試、本地 Draco 解碼器及網站模型素材。
- `scripts/`：DXF 處理、Blender 建模與 GLB 匯出工具；重建需另備原始 DXF、Blender，並調整腳本中的本機來源路徑。
- `output/4F/`：4F Blender 模型、Draco GLB、驗證紀錄與預覽。
- `output/video-script/`：完整功能錄影 Word 腳本，最新為 v1.1。

詳細功能與架構請見 [應用說明](dcim-local/README.md) 與 [架構文件](dcim-local/docs/LOCAL_ARCHITECTURE.md)。

原始參考影片、錄製影片、快取、建置產物、本地資料庫與環境設定不包含在此儲存庫。
