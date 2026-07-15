import { CONFIG } from "./config.js";
import { api } from "./api.js";
import { resetData, state } from "./state.js";
import { employeeById, entityById, readEmployeeForm, readEntityForm } from "./forms.js";
import { confirmDialog, employeeForm, entityForm, loginScreen, renderShell, renderView, showToast } from "./ui.js";
import { debounce, safeUrl } from "./utils.js";

const app = document.querySelector("#app");
const modalRoot = document.querySelector("#modal-root");
const SESSION_CREDENTIAL_KEY = "ai-virtual-office.google-id-token";

function closeModal() { modalRoot.innerHTML = ""; }
function showError(form, error) { const target = form.querySelector("#form-error"); target.hidden = false; target.textContent = error.message || error; }

function openEmployeeModal(employee) {
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

async function refresh() {
  state.loading = true;
  const data = await api.bootstrap(state.credential);
  state.employees = data.employees || [];
  state.departments = data.departments || [];
  state.statuses = data.statuses || [];
  state.tags = data.tags || [];
  state.user = data.user || state.user;
  state.loading = false;
  renderView();
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
    await refresh(); closeModal(); showToast(`${result.name} 已${data.id ? "更新" : "建立"}。`);
  } catch (error) { showError(form, error); }
}

async function saveEntity(form) {
  try {
    const entity = form.dataset.entity;
    const result = await api.saveEntity(state.credential, entity, readEntityForm(form));
    await refresh(); closeModal(); showToast(`${result.name} 已儲存。`);
  } catch (error) { showError(form, error); }
}

async function deleteEmployee(id) {
  const employee = employeeById(id); if (!employee) return;
  if (!await confirmDialog({ title: "移至回收桶？", message: `「${employee.name}」可稍後從回收桶還原。`, confirmText: "移至回收桶", danger: true })) return;
  try { await api.deleteEmployee(state.credential, id); await refresh(); showToast("已移至回收桶。"); } catch (error) { showToast(error.message, "error"); }
}

async function openAi(id) {
  const employee = employeeById(id); const url = safeUrl(employee?.usageUrl);
  if (!url) return showToast("此 AI 尚未設定可用的使用連結。", "error");
  try { await api.recordUse(state.credential, id); window.open(url, "_blank", "noopener,noreferrer"); await refresh(); } catch (error) { showToast(`無法記錄使用狀態：${error.message}`, "error"); }
}

async function deleteEntity(entity, id) {
  const item = entityById(entity, id); if (!item) return;
  if (!await confirmDialog({ title: `刪除${entity === "department" ? "部門" : entity === "status" ? "狀態" : "標籤"}？`, message: `「${item.name}」若仍被 AI 員工使用，系統會拒絕刪除。`, confirmText: "刪除", danger: true })) return;
  try { await api.deleteEntity(state.credential, entity, id); await refresh(); showToast("已刪除。"); } catch (error) { showToast(error.message, "error"); }
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("button,a"); if (!target) return;
  if (target.dataset.view) { event.preventDefault(); state.view = target.dataset.view; renderView(); return; }
  if (target.matches("[data-signout]")) { window.google?.accounts?.id?.disableAutoSelect(); state.credential = ""; state.user = null; sessionStorage.removeItem(SESSION_CREDENTIAL_KEY); renderLogin(); return; }
  if (target.matches("[data-new-employee]")) { openEmployeeModal(); return; }
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
  if (target.matches("[data-restore]")) { try { await api.restoreEmployee(state.credential, target.dataset.restore); await refresh(); showToast("已還原 AI 員工。") } catch (e) { showToast(e.message, "error"); } return; }
  if (target.matches("[data-purge]")) { if (!await confirmDialog({ title:"永久刪除？", message:"這項操作無法復原。", confirmText:"永久刪除", danger:true })) return; try { await api.purgeEmployee(state.credential, target.dataset.purge); await refresh(); showToast("已永久刪除。") } catch (e) { showToast(e.message,"error"); } }
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

document.addEventListener("input", debounce((event) => { if (event.target.id === "query") { state.filters.query = event.target.value; renderView(); } }, 180));
document.addEventListener("change", (event) => { const map = { "platform-filter":"platform", "department-filter":"departmentId", "status-filter":"statusId", "tag-filter":"tagId" }; if (map[event.target.id]) { state.filters[map[event.target.id]] = event.target.value; renderView(); } });

const savedCredential = sessionStorage.getItem(SESSION_CREDENTIAL_KEY);
if (savedCredential) handleCredential({ credential: savedCredential }); else renderLogin();
