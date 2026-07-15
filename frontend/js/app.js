import { CONFIG } from "./config.js?v=20260715-3";
import { api } from "./api.js?v=20260715-4";
import { resetData, state } from "./state.js?v=20260715-5";
import { employeeById, entityById, readEmployeeForm, readEntityForm } from "./forms.js?v=20260715-5";
import { confirmDialog, employeeForm, entityForm, loginScreen, renderShell, renderView as renderBaseView, showToast } from "./ui.js?v=20260715-8";
import { cancelEmployeeDrafts, cancelEntityDraft, clearAllReorderDrafts, enhanceReorderUI, hasAnyReorderDrafts, hasEmployeeDrafts, initializeReorderController } from "./reorder.js?v=20260715-5";
import { debounce, safeUrl } from "./utils.js";

const app = document.querySelector("#app");
const modalRoot = document.querySelector("#modal-root");
const SESSION_CREDENTIAL_KEY = "ai-virtual-office.google-id-token";
const DEPARTMENT_EXPANSION_KEY_PREFIX = "ai-virtual-office.department-expanded.";

function departmentExpansionKey() {
  return `${DEPARTMENT_EXPANSION_KEY_PREFIX}${state.user?.id || state.user?.email || "anonymous"}`;
}

function loadDepartmentExpansion() {
  try {
    const saved = JSON.parse(localStorage.getItem(departmentExpansionKey()) || "{}");
    state.departmentExpanded = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  } catch (_) { state.departmentExpanded = {}; }
}

function saveDepartmentExpansion() {
  try { localStorage.setItem(departmentExpansionKey(), JSON.stringify(state.departmentExpanded)); } catch (_) { /* local storage is optional */ }
}

function closeModal() { modalRoot.innerHTML = ""; }
function showError(form, error) { const target = form.querySelector("#form-error"); target.hidden = false; target.textContent = error.message || error; }

function upsertRecord(collection, record) {
  const index = collection.findIndex((item) => item.id === record.id);
  if (index >= 0) collection[index] = record; else collection.push(record);
}

function entityCollection(entity) {
  return state[entity === "status" ? "statuses" : `${entity}s`];
}

function renderView() {
  renderBaseView();
  enhanceReorderUI();
}

function confirmDiscardReorder() {
  if (!hasAnyReorderDrafts()) return true;
  if (!window.confirm("目前有尚未儲存的排序。確定要放棄這些變更嗎？")) return false;
  clearAllReorderDrafts();
  return true;
}

initializeReorderController(renderView);

function openEmployeeModal(employee = {}) {
  modalRoot.innerHTML = employeeForm(employee);
  const form = modalRoot.querySelector("#employee-form");
  const saveButton = form.querySelector('button[type="submit"]');
  saveButton.type = "button";
  saveButton.addEventListener("click", () => saveEmployee(form));
  form.addEventListener("submit", (event) => event.preventDefault());
}

function openEntityModal(entity, item) {
  modalRoot.innerHTML = entityForm(entity, item);
  const form = modalRoot.querySelector("#entity-form");
  const saveButton = form.querySelector('button[type="submit"]');
  saveButton.type = "button";
  saveButton.addEventListener("click", () => saveEntity(form));
  form.addEventListener("submit", (event) => event.preventDefault());
}

function renderLogin(error = "") {
  resetData();
  app.innerHTML = loginScreen(error);
  if (!CONFIG.GOOGLE_CLIENT_ID) {
    document.querySelector("#google-signin").innerHTML = '<p class="error">尚未設定 Google Client ID。請依 README 建立 <code>js/config.js</code>。</p>';
    return;
  }
  const tryRender = () => {
    if (!window.google?.accounts?.id) return setTimeout(tryRender, 150);
    window.google.accounts.id.initialize({ client_id: CONFIG.GOOGLE_CLIENT_ID, callback: handleCredential, auto_select: false, cancel_on_tap_outside: true });
    window.google.accounts.id.renderButton(document.querySelector("#google-signin"), { theme: "outline", size: "large", width: 280, text: "signin_with", locale: "zh-TW" });
  };
  tryRender();
}

async function handleCredential(response) {
  state.credential = response.credential;
  try {
    const data = await api.bootstrap(state.credential);
    state.employees = data.employees || [];
    state.departments = data.departments || [];
    state.statuses = data.statuses || [];
    state.tags = data.tags || [];
    state.user = data.user || state.user;
    loadDepartmentExpansion();
    clearAllReorderDrafts();
    sessionStorage.setItem(SESSION_CREDENTIAL_KEY, state.credential);
    renderShell();
    renderView();
    showToast("登入成功，歡迎回到辦公室。");
  } catch (error) {
    state.credential = "";
    sessionStorage.removeItem(SESSION_CREDENTIAL_KEY);
    renderLogin(error.message);
  }
}
window.handleGoogleCredential = handleCredential;

async function saveEmployee(form) {
  try {
    const data = readEmployeeForm(form);
    const result = data.id ? await api.updateEmployee(state.credential, data) : await api.createEmployee(state.credential, data);
    upsertRecord(state.employees, result);
    closeModal(); renderView(); showToast(`${result.name} 已${data.id ? "更新" : "建立"}。`);
  } catch (error) { showError(form, error); }
}

async function saveEntity(form) {
  try {
    const entity = form.dataset.entity;
    const result = await api.saveEntity(state.credential, entity, readEntityForm(form));
    upsertRecord(entityCollection(entity), result);
    closeModal(); renderView(); showToast(`${result.name} 已儲存。`);
  } catch (error) { showError(form, error); }
}

async function deleteEmployee(id) {
  const employee = employeeById(id); if (!employee) return;
  if (!await confirmDialog({ title: "移至回收桶？", message: `「${employee.name}」可稍後從回收桶還原。`, confirmText: "移至回收桶", danger: true })) return;
  try { const result = await api.deleteEmployee(state.credential, id); upsertRecord(state.employees, result); renderView(); showToast("已移至回收桶。"); } catch (error) { showToast(error.message, "error"); }
}

async function openAi(id) {
  const employee = employeeById(id); const url = safeUrl(employee?.usageUrl);
  if (!url) return showToast("此 AI 尚未設定可用的使用連結。", "error");
  window.open(url, "_blank", "noopener,noreferrer");
  try { const result = await api.recordUse(state.credential, id); upsertRecord(state.employees, result); renderView(); } catch (error) { showToast(`無法記錄使用狀態：${error.message}`, "error"); }
}

async function deleteEntity(entity, id) {
  const item = entityById(entity, id); if (!item) return;
  if (!await confirmDialog({ title: `刪除${entity === "department" ? "部門" : entity === "status" ? "狀態" : "標籤"}？`, message: `「${item.name}」若仍被 AI 員工使用，系統會拒絕刪除。`, confirmText: "刪除", danger: true })) return;
  try { const result = await api.deleteEntity(state.credential, entity, id); upsertRecord(entityCollection(entity), result); renderView(); showToast("已刪除。"); } catch (error) { showToast(error.message, "error"); }
}

async function saveEntityOrder(entity) {
  const orderedIds = state.reorder.entities[entity];
  if (!orderedIds) return;
  try {
    const result = await api.reorderEntity(state.credential, entity, orderedIds);
    (result.items || []).forEach((item) => upsertRecord(entityCollection(entity), item));
    cancelEntityDraft(entity);
    renderView();
    showToast("排序已儲存。");
  } catch (error) {
    showToast(`排序儲存失敗：${error.message}`, "error");
  }
}

async function saveEmployeeOrders() {
  const departments = Object.entries(state.reorder.employees).map(([departmentId, orderedIds]) => ({ departmentId, orderedIds }));
  if (!departments.length) return;
  try {
    const result = await api.reorderEmployees(state.credential, departments);
    (result.employees || []).forEach((employee) => upsertRecord(state.employees, employee));
    cancelEmployeeDrafts();
    renderView();
    showToast("員工排序已儲存。");
  } catch (error) {
    showToast(`員工排序儲存失敗：${error.message}`, "error");
  }
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("button,a"); if (!target) return;
  if (target.dataset.view) { event.preventDefault(); if (target.dataset.view !== state.view && !confirmDiscardReorder()) return; state.view = target.dataset.view; renderView(); return; }
  if (target.matches("[data-signout]")) { if (!confirmDiscardReorder()) return; window.google?.accounts?.id?.disableAutoSelect(); state.credential = ""; state.user = null; sessionStorage.removeItem(SESSION_CREDENTIAL_KEY); renderLogin(); return; }
  if (target.matches("[data-save-entity-order]")) return saveEntityOrder(target.dataset.saveEntityOrder);
  if (target.matches("[data-cancel-entity-order]")) { cancelEntityDraft(target.dataset.cancelEntityOrder); renderView(); return; }
  if (target.matches("[data-save-employee-order]")) return saveEmployeeOrders();
  if (target.matches("[data-cancel-employee-order]")) { cancelEmployeeDrafts(); renderView(); return; }
  if (target.matches("[data-toggle-department]")) {
    const departmentId = target.dataset.toggleDepartment;
    state.departmentExpanded[departmentId] = !state.departmentExpanded[departmentId];
    saveDepartmentExpansion();
    renderView();
    return;
  }
  if (target.matches("[data-new-employee]")) {
    const departmentId = target.dataset.departmentId;
    openEmployeeModal(departmentId ? { primaryDepartmentId: departmentId, departmentIds: [departmentId] } : {});
    return;
  }
  if (target.matches("[data-edit-employee]")) { openEmployeeModal(employeeById(target.dataset.editEmployee)); return; }
  if (target.matches("[data-delete-employee]")) return deleteEmployee(target.dataset.deleteEmployee);
  if (target.matches("[data-open-ai]")) return openAi(target.dataset.openAi);
  if (target.matches("[data-open-admin]")) { const url = safeUrl(employeeById(target.dataset.openAdmin)?.adminUrl); if (url) window.open(url, "_blank", "noopener,noreferrer"); return; }
  if (target.matches("[data-expand]")) { const card = target.closest(".employee-card"); const detail = card.querySelector(".employee-detail"); const expanded = detail.hidden; detail.hidden = !expanded; target.setAttribute("aria-expanded", String(expanded)); return; }
  if (target.matches("[data-copy-prompt]")) { const text = employeeById(target.dataset.copyPrompt)?.prompt || ""; try { await navigator.clipboard.writeText(text); showToast("Prompt 已複製。") } catch { showToast("無法存取剪貼簿。", "error"); } return; }
  if (target.matches("[data-new-entity]")) { event.preventDefault(); openEntityModal(target.dataset.newEntity); return; }
  if (target.matches("[data-edit-entity]")) { openEntityModal(target.dataset.editEntity, entityById(target.dataset.editEntity, target.dataset.id)); return; }
  if (target.matches("[data-delete-entity]")) return deleteEntity(target.dataset.deleteEntity, target.dataset.id);
  if (target.matches("[data-close-modal]")) { closeModal(); return; }
  if (target.matches("[data-restore]")) { try { const result = await api.restoreEmployee(state.credential, target.dataset.restore); upsertRecord(state.employees, result); renderView(); showToast("已還原 AI 員工。") } catch (e) { showToast(e.message, "error"); } return; }
  if (target.matches("[data-purge]")) { if (!await confirmDialog({ title:"永久刪除？", message:"這項操作無法復原。", confirmText:"永久刪除", danger:true })) return; try { await api.purgeEmployee(state.credential, target.dataset.purge); state.employees = state.employees.filter((employee) => employee.id !== target.dataset.purge); renderView(); showToast("已永久刪除。") } catch (e) { showToast(e.message,"error"); } }
});

document.addEventListener("submit", (event) => { if (event.target.id === "employee-form") { event.preventDefault(); saveEmployee(event.target); } if (event.target.id === "entity-form") { event.preventDefault(); saveEntity(event.target); } });
// Capture submit at the document boundary.  This prevents native GET form
// navigation even if a browser extension or other listener interrupts bubbling.
document.addEventListener("submit", (event) => {
  if (event.target.id === "employee-form") {
    event.preventDefault();
    event.stopImmediatePropagation();
    saveEmployee(event.target);
  }
  if (event.target.id === "entity-form") {
    event.preventDefault();
    event.stopImmediatePropagation();
    saveEntity(event.target);
  }
}, true);

document.addEventListener("input", debounce((event) => {
  if (event.target.id !== "query") return;
  if (hasEmployeeDrafts()) { showToast("請先儲存或取消員工排序，再使用搜尋。", "error"); renderView(); return; }
  state.filters.query = event.target.value;
  renderView();
}, 180));
document.addEventListener("change", (event) => {
  const map = { "platform-filter":"platform", "department-filter":"departmentId", "status-filter":"statusId", "tag-filter":"tagId" };
  if (!map[event.target.id]) return;
  if (hasEmployeeDrafts()) { showToast("請先儲存或取消員工排序，再變更篩選。", "error"); renderView(); return; }
  state.filters[map[event.target.id]] = event.target.value;
  renderView();
});

window.addEventListener("beforeunload", (event) => {
  if (!hasAnyReorderDrafts()) return;
  event.preventDefault();
  event.returnValue = "";
});

const savedCredential = sessionStorage.getItem(SESSION_CREDENTIAL_KEY);
if (savedCredential) handleCredential({ credential: savedCredential }); else renderLogin();
