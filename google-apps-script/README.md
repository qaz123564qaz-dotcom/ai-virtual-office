# Google Apps Script 後端

這個版本允許任何 Google 帳號登入，但每筆 AI 員工、部門、狀態與標籤資料都會依 Google ID Token 的 `sub` 分隔；使用者只能讀寫自己的資料。

## Script Properties

在 Apps Script 的「專案設定」→「指令碼屬性」設定：

| Key | 值 |
| --- | --- |
| `SPREADSHEET_ID` | Google Sheets 網址中 `/d/` 與 `/edit` 之間的 ID |
| `GOOGLE_CLIENT_ID` | Google Cloud 建立的 OAuth 網頁用戶端 ID |
| `LEGACY_OWNER_EMAIL`（可選） | 舊版單一帳號資料的原擁有者 Gmail；例如 `qaz123564qaz@gmail.com` |

不再需要 `ALLOWED_EMAILS`；可刪除它或保留不使用。

## 升級既有資料

1. 先把所有 `.gs` 檔案更新成此資料夾的版本，再按「儲存」。
2. 在指令碼屬性新增 `LEGACY_OWNER_EMAIL`，填入原本使用此辦公室的 Gmail。
3. 重新部署 Web app（「部署」→「管理部署」→編輯→新增版本→部署）。
4. 原擁有者首次登入時，既有未歸屬的示範/個人資料會自動標記為該帳號所有；其他帳號永遠看不到它。
5. 其他 Google 帳號首次登入時，系統會替各自建立獨立的示範資料。

`LEGACY_OWNER_EMAIL` 是一次性安全遷移開關。資料已移交後可以刪除它；不刪也不會讓其他帳號讀取已移交的資料。

## OAuth 設定

Google Cloud OAuth 同意畫面應選擇 **External**，並在 OAuth 網頁用戶端的「已授權 JavaScript 來源」加入 GitHub Pages 的完整 origin，例如 `https://qaz123564qaz-dotcom.github.io`。前端僅使用 `openid`、`email`、`profile` 身分資訊；請勿要求 Google Sheets 或 Drive 權限。

## 部署與檢查

1. 以 **Execute as me** 部署 Web app；存取權設為 **Anyone**。
2. `GET /exec?action=health` 應回傳 `success: true`。
3. 所有應用程式 API 請求必須用 POST，內容為 `{ action, credential, data }`。

### 批次排序 API

- `department.reorder`、`status.reorder`、`tag.reorder`：`data` 為 `{ orderedIds: string[] }`，必須完整包含目前使用者在該區的所有可排序項目。
- `employee.reorder`：`data` 為 `{ departments: [{ departmentId, orderedIds: string[] }] }`；每組必須完整包含該主要部門的所有未刪除員工。
- 排序會在鎖定範圍內驗證擁有者、重複 ID 與主要部門，再以單次欄位批次寫入將 `sortOrder` 正規化為 `1..n`。

常見錯誤：

- `UNAUTHORIZED`：確認前端的 Client ID 與 `GOOGLE_CLIENT_ID` 完全相同，並重新登入取得新 ID Token。
- `SHEET_SCHEMA_ERROR`：工作表第一列被手動改動；請依專案欄位順序復原後重新執行。
- API 回傳舊行為：重新部署時必須選「新增版本」，而不是只按儲存。
