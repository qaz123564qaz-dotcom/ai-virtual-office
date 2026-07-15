const SHEETS_ = {
  AI_Employees: ['id','name','platform','title','purpose','usageUrl','adminUrl','primaryDepartmentId','departmentIds','statusId','tagIds','avatar','note','longNote','prompt','usageCount','lastUsedAt','createdAt','updatedAt','deletedAt','isDeleted','sortOrder','ownerId','ownerEmail'],
  Departments: ['id','name','icon','color','description','sortOrder','createdAt','updatedAt','isDeleted','ownerId','ownerEmail'],
  Statuses: ['id','name','color','sortOrder','isActive','createdAt','updatedAt','ownerId','ownerEmail'],
  Tags: ['id','name','color','sortOrder','createdAt','updatedAt','isDeleted','ownerId','ownerEmail'],
  Settings: ['key','value','updatedAt']
};

const SHEET_SCHEMA_VERSION_ = '20260715-1';
let spreadsheetCache_ = null;
let recordsCache_ = {};

function resetRequestCaches_() { spreadsheetCache_ = null; recordsCache_ = {}; }

function spreadsheet_() { const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'); if (!id) throw new AppError_('CONFIG_ERROR', '尚未設定 SPREADSHEET_ID。'); if (spreadsheetCache_) return spreadsheetCache_; try { spreadsheetCache_ = SpreadsheetApp.openById(id); return spreadsheetCache_; } catch (_) { throw new AppError_('SPREADSHEET_ERROR', '無法開啟指定的 Google Sheets。'); } }
function getSheet_(name) { const sheet = spreadsheet_().getSheetByName(name); if (!sheet) throw new AppError_('SHEET_NOT_FOUND', `找不到工作表：${name}`); return sheet; }

// 只在舊表尾端新增欄位，絕不清空既有資料。
function ensureSheet_(book, name, headers) {
  let sheet = book.getSheetByName(name);
  if (!sheet) sheet = book.insertSheet(name);
  const lastColumn = sheet.getLastColumn();
  const current = lastColumn ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String) : [];
  if (!current.filter(Boolean).length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const missing = headers.filter((header) => !current.includes(header));
    if (missing.length) sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  }
  const finalHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0].map(String);
  if (finalHeaders.some((header, index) => header !== headers[index])) throw new AppError_('SHEET_SCHEMA_ERROR', `工作表欄位順序不相容：${name}`);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e0e7ff');
  return sheet;
}

function records_(name) { if (Object.prototype.hasOwnProperty.call(recordsCache_, name)) return recordsCache_[name]; const sheet = getSheet_(name), headers = SHEETS_[name], last = sheet.getLastRow(); if (last < 2) return recordsCache_[name] = []; return recordsCache_[name] = sheet.getRange(2, 1, last - 1, headers.length).getValues().map((row) => rowToRecord_(headers, row)); }
function rowToRecord_(headers, row) { const record = {}; headers.forEach((header, index) => { let value = row[index]; if (['departmentIds','tagIds'].includes(header)) value = parseJson_(value, []); if (['isDeleted','isActive'].includes(header)) value = value === true || value === 'true'; if (header === 'usageCount') value = Number(value || 0); record[header] = value; }); return record; }
function saveRecord_(name, record) { const sheet = getSheet_(name), headers = SHEETS_[name], values = headers.map((header) => { const value = record[header]; return ['departmentIds','tagIds'].includes(header) ? stringifyJson_(value) : value === undefined || value === null ? '' : value; }); const rows = records_(name), index = rows.findIndex((item) => item.id === record.id); if (index >= 0) { sheet.getRange(index + 2, 1, 1, headers.length).setValues([values]); rows[index] = Object.assign({}, record); } else { sheet.appendRow(values); rows.push(Object.assign({}, record)); } return record; }
function writeSortOrders_(name, sortOrderById) {
  const rows = records_(name);
  if (!rows.length) return;
  const column = SHEETS_[name].indexOf('sortOrder');
  if (column < 0) throw new AppError_('SHEET_SCHEMA_ERROR', `${name} 缺少 sortOrder 欄位。`);
  const values = rows.map((record) => {
    if (Object.prototype.hasOwnProperty.call(sortOrderById, record.id)) record.sortOrder = Number(sortOrderById[record.id]);
    return [Number(record.sortOrder || 0)];
  });
  getSheet_(name).getRange(2, column + 1, rows.length, 1).setValues(values);
}
function removeRecord_(name, id) { const rows = records_(name), index = rows.findIndex((item) => item.id === id); if (index < 0) throw new AppError_('NOT_FOUND', '找不到資料。'); getSheet_(name).deleteRow(index + 2); rows.splice(index, 1); }
function withLock_(fn) { const lock = LockService.getScriptLock(); try { lock.waitLock(20000); return fn(); } catch (error) { if (String(error).includes('lock')) throw new AppError_('LOCK_TIMEOUT', '系統忙碌中，請稍後再試。'); throw error; } finally { if (lock.hasLock()) lock.releaseLock(); } }
function initSpreadsheet_() { const book = spreadsheet_(); Object.keys(SHEETS_).forEach((name) => ensureSheet_(book, name, SHEETS_[name])); PropertiesService.getScriptProperties().setProperty('SHEET_SCHEMA_MARKER', `${book.getId()}:${SHEET_SCHEMA_VERSION_}`); return { spreadsheetId: book.getId(), initialized: true }; }
function ensureSpreadsheetReady_() { const properties = PropertiesService.getScriptProperties(); const id = properties.getProperty('SPREADSHEET_ID'); if (properties.getProperty('SHEET_SCHEMA_MARKER') === `${id}:${SHEET_SCHEMA_VERSION_}`) return { spreadsheetId: id, initialized: true }; return initSpreadsheet_(); }

function workspaceForUser_(user) {
  return { user, employees: listEmployees_(user, true), departments: recordsForUser_('Departments', user).filter((item) => !item.isDeleted), statuses: recordsForUser_('Statuses', user), tags: recordsForUser_('Tags', user).filter((item) => !item.isDeleted) };
}

function ensureUserWorkspace_(user) {
  return withLock_(() => {
    claimLegacyRecords_(user);
    if (!recordsForUser_('AI_Employees', user).length && !recordsForUser_('Departments', user).length && !recordsForUser_('Statuses', user).length && !recordsForUser_('Tags', user).length) seedUserData_(user);
  });
}

// 舊單一帳號資料只有在明確指定 LEGACY_OWNER_EMAIL 時才會移交，避免被其他登入者取得。
function claimLegacyRecords_(user) {
  const legacyOwnerEmail = String(PropertiesService.getScriptProperties().getProperty('LEGACY_OWNER_EMAIL') || '').trim().toLowerCase();
  if (!legacyOwnerEmail || legacyOwnerEmail !== user.email) return;
  ['AI_Employees', 'Departments', 'Statuses', 'Tags'].forEach((sheetName) => {
    records_(sheetName).filter((record) => !record.ownerId).forEach((record) => {
      record.ownerId = user.id;
      record.ownerEmail = user.email;
      record.updatedAt = nowIso_();
      saveRecord_(sheetName, record);
    });
  });
}

function seedUserData_(user) {
  const now = nowIso_();
  const own = (record) => Object.assign(record, { ownerId: user.id, ownerEmail: user.email });
  const d1 = own({ id: uuid_(), name: '策略與企劃', icon: '◈', color: '#4f46e5', description: '研究、規劃與內容架構', sortOrder: 1, createdAt: now, updatedAt: now, isDeleted: false });
  const d2 = own({ id: uuid_(), name: '內容製作', icon: '✎', color: '#0f766e', description: '文案、編輯與素材製作', sortOrder: 2, createdAt: now, updatedAt: now, isDeleted: false });
  const d3 = own({ id: uuid_(), name: '營運與自動化', icon: '⚙', color: '#d97706', description: '流程、資料與日常營運', sortOrder: 3, createdAt: now, updatedAt: now, isDeleted: false });
  [d1, d2, d3].forEach((item) => saveRecord_('Departments', item));
  const s1 = own({ id: uuid_(), name: '正常使用', color: '#16a34a', sortOrder: 1, isActive: true, createdAt: now, updatedAt: now });
  const s2 = own({ id: uuid_(), name: '調整中', color: '#f59e0b', sortOrder: 2, isActive: true, createdAt: now, updatedAt: now });
  [s1, s2].forEach((item) => saveRecord_('Statuses', item));
  const t1 = own({ id: uuid_(), name: '寫作', color: '#2563eb', sortOrder: 1, createdAt: now, updatedAt: now, isDeleted: false });
  const t2 = own({ id: uuid_(), name: '研究', color: '#7c3aed', sortOrder: 2, createdAt: now, updatedAt: now, isDeleted: false });
  const t3 = own({ id: uuid_(), name: '自動化', color: '#ea580c', sortOrder: 3, createdAt: now, updatedAt: now, isDeleted: false });
  [t1, t2, t3].forEach((item) => saveRecord_('Tags', item));
  const employee = (name, platform, title, purpose, usageUrl, department, departmentIds, tagIds, sortOrder) => own({ id: uuid_(), name, platform, title, purpose, usageUrl, adminUrl: '', primaryDepartmentId: department, departmentIds, statusId: s1.id, tagIds, avatar: '', note: '這是可自由修改或刪除的示範資料。', longNote: '', prompt: '', usageCount: 0, lastUsedAt: '', createdAt: now, updatedAt: now, deletedAt: '', isDeleted: false, sortOrder });
  saveRecord_('AI_Employees', employee('企劃策略師', 'GPT', '策略企劃顧問', '協助拆解目標、建立專案策略與行動方案。', 'https://chatgpt.com/', d1.id, [d1.id, d3.id], [t2.id], 1));
  saveRecord_('AI_Employees', employee('內容編輯師', 'Gem', '內容編輯夥伴', '協助潤稿、改寫與建立內容大綱。', 'https://gemini.google.com/', d2.id, [d2.id], [t1.id], 2));
  saveRecord_('AI_Employees', employee('流程助理', 'GPT', '營運自動化助理', '協助整理 SOP、檢查流程與產生工作清單。', 'https://chatgpt.com/', d3.id, [d3.id, d1.id], [t3.id], 3));
}
