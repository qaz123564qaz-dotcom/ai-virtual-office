/**
 * Apps Script 入口。首次部署前請設定 Script Properties：
 * SPREADSHEET_ID、GOOGLE_CLIENT_ID。
 */
function initializeForOwner() { return initSpreadsheet_(); }
function healthCheck() { return { status: 'ok', spreadsheetId: spreadsheet_().getId(), timestamp: nowIso_() }; }
