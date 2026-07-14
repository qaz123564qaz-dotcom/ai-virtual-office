# Google Apps Script 後端

## 檔案與工作表

把此資料夾的 `.gs` 檔逐一新增到同一個獨立 Apps Script 專案，並在 Project Settings 勾選顯示 `appsscript.json` 後覆寫 manifest。首次執行 `initializeForOwner()` 會建立：`AI_Employees`、`Departments`、`Statuses`、`Tags`、`Settings`。

## Script Properties

| Key | 值 |
| --- | --- |
| `SPREADSHEET_ID` | 空白 Google Sheets 的 ID |
| `GOOGLE_CLIENT_ID` | Google OAuth Web Client ID |
| `ALLOWED_EMAILS` | 允許登入的 Gmail；逗號分隔 |

## 發布與測試

1. 執行 `initializeForOwner`，接受 Sheets 和外部請求權限。
2. Deploy 為 Web app，選 **Execute as me** 與 **Anyone**，取得 `/exec` URL。
3. GET `.../exec?action=health` 可檢查服務存活；它不會讀取資料。
4. 前端 `POST` 格式為 `{ action, credential, data }`。所有回應皆是 `{ success, data, message, error }`。

## 疑難排解

- `UNAUTHORIZED`：重新登入，並確認 Client ID 與前端完全一致。
- `FORBIDDEN`：把實際登入 Gmail 加到 `ALLOWED_EMAILS`，以小寫存放後重新嘗試。
- `SPREADSHEET_ERROR`：確認 Spreadsheet ID 和 Apps Script 擁有者有試算表權限。
- API 回傳 HTML：請使用部署後的 `/exec` URL，不能用 `/dev` URL。
- Google 登入顯示 origin 錯誤：將精確的 GitHub Pages scheme/hostname 加入 OAuth Client 的 Authorized JavaScript origins。

