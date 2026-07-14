const RESPONSE_HEADERS = { 'Content-Type': 'application/json' };

function nowIso_() { return new Date().toISOString(); }
function uuid_() { return Utilities.getUuid(); }
function parseJson_(value, fallback) { try { return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; } }
function stringifyJson_(value) { return JSON.stringify(value || []); }
function required_(value, label) { if (value === undefined || value === null || String(value).trim() === '') throw new AppError_('VALIDATION_ERROR', `${label} 為必填欄位。`); return String(value).trim(); }
function requireUrl_(value, label, optional) { if (!value && optional) return ''; required_(value, label); if (!/^https?:\/\//i.test(value)) throw new AppError_('VALIDATION_ERROR', `${label} 必須是 http 或 https URL。`); return value; }
function asBoolean_(value, fallback) { return value === undefined ? fallback : value === true || value === 'true'; }
function errorResponse_(error) { const known = error instanceof AppError_; return { success: false, data: null, message: known ? error.message : '系統發生未預期錯誤。', error: { code: known ? error.code : 'INTERNAL_ERROR', details: known ? error.message : String(error && error.message || error) } }; }
function successResponse_(data, message) { return { success: true, data: data === undefined ? {} : data, message: message || '', error: null }; }
function jsonOutput_(body) { return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON); }
function AppError_(code, message) { this.name = 'AppError'; this.code = code; this.message = message; }
AppError_.prototype = Object.create(Error.prototype);

