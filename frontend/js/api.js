import { CONFIG } from "./config.js?v=20260715-3";

async function request(action, payload = {}) {
  if (!CONFIG.API_URL) throw new Error("尚未設定 API_URL，請依 README 建立 frontend/js/config.js。");
  const response = await fetch(CONFIG.API_URL, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, credential: payload.credential, data: payload.data || {} }),
  });
  let body;
  try { body = await response.json(); } catch { throw new Error("API 未回傳有效 JSON，請檢查 Apps Script Web App 部署網址與權限。"); }
  if (!body.success) throw new Error(body.message || body.error?.details || "API 操作失敗");
  return body.data;
}

export const api = {
  request,
  bootstrap: (credential) => request("bootstrap", { credential }),
  createEmployee: (credential, data) => request("employee.create", { credential, data }),
  updateEmployee: (credential, data) => request("employee.update", { credential, data }),
  deleteEmployee: (credential, id) => request("employee.delete", { credential, data: { id } }),
  restoreEmployee: (credential, id) => request("employee.restore", { credential, data: { id } }),
  purgeEmployee: (credential, id) => request("employee.purge", { credential, data: { id } }),
  recordUse: (credential, id) => request("employee.recordUse", { credential, data: { id } }),
  saveEntity: (credential, entity, data) => request(`${entity}.save`, { credential, data }),
  deleteEntity: (credential, entity, id) => request(`${entity}.delete`, { credential, data: { id } }),
  reorderEntity: (credential, entity, orderedIds) => request(`${entity}.reorder`, { credential, data: { orderedIds } }),
  reorderEmployees: (credential, departments) => request("employee.reorder", { credential, data: { departments } }),
};
