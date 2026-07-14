# AI 員工虛擬辦公室

管理個人 ChatGPT 自訂 GPT 與 Google Gemini Gems 的純靜態網站。前端可部署到 GitHub Pages，資料儲存在 Google Sheets，由 Google Apps Script 提供 API。

## 安全模型

前端只保存公開的 Google OAuth Web Client ID 與 Apps Script Web App URL，不使用前端 API Key。使用者以 Google Identity Services 登入，前端將短效 ID Token 隨每次 API 請求送出；Apps Script 向 Google 驗證 token 的受眾、簽發者、到期時間與已驗證的 email，再與 `ALLOWED_EMAILS` 白名單比對。請勿在試算表填入密碼、金鑰或機密資料。

## 部署摘要

1. 建立一份空白 Google Sheets，複製其 Spreadsheet ID。
2. 在 Google Cloud Console 建立 OAuth consent screen 與 **Web application** OAuth Client；將 GitHub Pages 網址（及開發用 `http://localhost`）加入 Authorized JavaScript origins。
3. 建立獨立 Apps Script 專案，將 `google-apps-script/` 所有 `.gs` 與 `appsscript.json` 複製進去。
4. 到 Apps Script 的 Project Settings > Script properties 新增：
   - `SPREADSHEET_ID`：步驟 1 的 ID
   - `GOOGLE_CLIENT_ID`：步驟 2 的完整 Client ID
   - `ALLOWED_EMAILS`：允許使用的 Gmail，小寫、逗號分隔
5. 先在 Apps Script 編輯器執行 `initializeForOwner` 並完成授權。這會建立五張工作表和示範資料。
6. Deploy > New deployment > Web app：Execute as **Me**、Who has access **Anyone**。API 本身仍會拒絕未授權 Google ID Token。複製 `/exec` URL。
7. 複製 `frontend/js/config.example.js` 為 `frontend/js/config.js`，填入 Web App URL 和 Google Client ID。
8. 將 `frontend/` 內容推送至 GitHub repository，Settings > Pages 選擇部署分支與根目錄。把正式 Pages 網址補進 OAuth Client 的 Authorized JavaScript origins。

詳細的 Apps Script 操作與疑難排解見 [google-apps-script/README.md](google-apps-script/README.md)。

## 本機預覽

可用任何靜態檔案伺服器從 `frontend/` 啟動；不可直接以 `file://` 開啟，Google 登入需要已設定的 HTTP/HTTPS origin。`frontend/js/config.js` 已被 `.gitignore` 忽略，正式值不應提交。

## 功能

- Google 白名單登入、部門辦公室檢視、多部門員工提示。
- AI 員工、部門、狀態、標籤的管理；搜尋、篩選、可展開詳情與 Prompt 複製。
- 一鍵開啟 AI 時自動更新使用次數與最後使用時間。
- 軟刪除、回收桶還原與永久刪除。

