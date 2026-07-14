import { state } from "./state.js";
import { byId, escapeHtml, formatDate, initials, safeUrl } from "./utils.js";

const platformClass = (platform) => platform === "Gem" ? "gem" : "gpt";
const label = (items, id) => byId(items, id)?.name || "未設定";

export function showToast(message, type = "success") {
  const root = document.querySelector("#toast-root");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  root.append(toast);
  setTimeout(() => toast.remove(), 4500);
}

export function confirmDialog({ title, message, confirmText = "確認", danger = false }) {
  return new Promise((resolve) => {
    const root = document.querySelector("#modal-root");
    root.innerHTML = `<div class="backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><h2 id="dialog-title">${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p><div class="dialog-actions"><button class="button ghost" data-cancel>取消</button><button class="button ${danger ? "danger" : "primary"}" data-confirm>${escapeHtml(confirmText)}</button></div></section></div>`;
    root.querySelector("[data-cancel]").focus();
    root.querySelector("[data-cancel]").onclick = () => { root.innerHTML = ""; resolve(false); };
    root.querySelector("[data-confirm]").onclick = () => { root.innerHTML = ""; resolve(true); };
  });
}

function options(items, selected, blank) {
  return `<option value="">${blank}</option>${items.filter((i) => !i.isDeleted).map((i) => `<option value="${i.id}" ${i.id === selected ? "selected" : ""}>${escapeHtml(i.name)}</option>`).join("")}`;
}

export function loginScreen(error = "") {
  return `<main class="login-page"><section class="login-card"><div class="brand-mark">✦</div><p class="eyebrow">PERSONAL AI OPS</p><h1>AI 員工虛擬辦公室</h1><p>管理你的 ChatGPT 自訂 GPT 與 Gemini Gems。</p>${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}<div id="google-signin" class="signin-slot"></div><p class="login-note">僅限已授權的 Google 帳號使用。</p></section></main>`;
}

export function renderShell() {
  const app = document.querySelector("#app");
  app.innerHTML = `<header class="topbar"><a class="logo" href="#office" data-view="office"><span>✦</span> AI 員工虛擬辦公室</a><nav><button class="nav-button active" data-view="office">辦公室</button><button class="nav-button" data-view="settings">管理設定</button><button class="nav-button" data-view="trash">回收桶</button></nav><div class="profile"><span>${escapeHtml(state.user?.name || state.user?.email || "Google 使用者")}</span><button class="icon-button" data-signout aria-label="登出">⇥</button></div></header><main id="content" class="content"></main>`;
}

function filterBar() {
  const f = state.filters;
  return `<section class="filters" aria-label="篩選 AI 員工"><label class="search"><span>⌕</span><input id="query" type="search" placeholder="搜尋名稱、職稱、用途、標籤…" value="${escapeHtml(f.query)}" /></label><select id="platform-filter"><option value="">全部平台</option><option value="GPT" ${f.platform === "GPT" ? "selected" : ""}>ChatGPT</option><option value="Gem" ${f.platform === "Gem" ? "selected" : ""}>Gemini Gem</option></select><select id="department-filter">${options(state.departments, f.departmentId, "全部部門")}</select><select id="status-filter">${options(state.statuses, f.statusId, "全部狀態")}</select><select id="tag-filter">${options(state.tags, f.tagId, "全部標籤")}</select><button class="button primary" data-new-employee>＋ 新增 AI 員工</button></section>`;
}

function matches(employee) {
  const f = state.filters;
  const haystack = [employee.name, employee.title, employee.purpose, employee.note, employee.longNote, ...employee.tagIds.map((id) => label(state.tags, id))].join(" ").toLowerCase();
  return !employee.isDeleted && (!f.query || haystack.includes(f.query.toLowerCase())) && (!f.platform || employee.platform === f.platform) && (!f.departmentId || employee.departmentIds.includes(f.departmentId)) && (!f.statusId || employee.statusId === f.statusId) && (!f.tagId || employee.tagIds.includes(f.tagId));
}

function employeeCard(employee, compact = false) {
  const departmentNames = employee.departmentIds.map((id) => label(state.departments, id));
  const tagNames = employee.tagIds.map((id) => label(state.tags, id));
  const avatar = safeUrl(employee.avatar) ? `<img src="${escapeHtml(employee.avatar)}" alt="" />` : initials(employee.name);
  return `<article class="employee-card ${compact ? "compact" : ""}" data-employee-id="${employee.id}"><button class="card-main" data-expand="${employee.id}" aria-expanded="false"><span class="avatar">${avatar}</span><span class="employee-summary"><span class="employee-topline"><strong>${escapeHtml(employee.name)}</strong><span class="platform ${platformClass(employee.platform)}">${employee.platform === "Gem" ? "GEM" : "GPT"}</span></span><span>${escapeHtml(employee.title || "未設定職稱")}</span><span class="muted">${escapeHtml(employee.purpose || "尚未填寫用途")}</span></span><span class="status-dot" style="--status-color:${escapeHtml(byId(state.statuses, employee.statusId)?.color || "#94a3b8")}" title="${escapeHtml(label(state.statuses, employee.statusId))}"></span><span class="chevron">⌄</span></button><div class="employee-detail" hidden><div class="detail-grid"><div><b>所屬部門</b><p>${departmentNames.map(escapeHtml).join("、") || "未設定"}</p></div><div><b>標籤</b><p>${tagNames.map((name) => `<span class="tag">${escapeHtml(name)}</span>`).join("") || "無"}</p></div><div><b>使用統計</b><p>${employee.usageCount || 0} 次 · ${formatDate(employee.lastUsedAt)}</p></div></div>${employee.note ? `<p class="note">${escapeHtml(employee.note)}</p>` : ""}${employee.longNote ? `<p class="long-note">${escapeHtml(employee.longNote)}</p>` : ""}<details class="prompt"><summary>Prompt</summary><pre>${escapeHtml(employee.prompt || "尚未保存 Prompt")}</pre><button class="text-button" data-copy-prompt="${employee.id}">複製 Prompt</button></details><div class="card-actions"><button class="button primary" data-open-ai="${employee.id}">開啟 AI</button>${employee.adminUrl ? `<button class="button ghost" data-open-admin="${employee.id}">開啟後台</button>` : ""}<button class="button ghost" data-edit-employee="${employee.id}">編輯</button><button class="button ghost danger-text" data-delete-employee="${employee.id}">移至回收桶</button></div></div></article>`;
}

export function officeView() {
  const content = document.querySelector("#content");
  const departments = [...state.departments].filter((d) => !d.isDeleted).sort((a, b) => a.sortOrder - b.sortOrder);
  content.innerHTML = `<section class="page-heading"><div><p class="eyebrow">YOUR AI TEAM</p><h1>虛擬辦公室</h1><p>以部門整理並快速啟用你的 AI 員工。</p></div><div class="stat"><strong>${state.employees.filter((e) => !e.isDeleted).length}</strong><span>位 AI 員工</span></div></section>${filterBar()}<section class="department-grid">${departments.map((department) => { const primary = state.employees.filter((e) => e.primaryDepartmentId === department.id && matches(e)).sort((a,b) => a.sortOrder - b.sortOrder); const secondary = state.employees.filter((e) => e.primaryDepartmentId !== department.id && e.departmentIds.includes(department.id) && matches(e)); return `<section class="department-card" style="--department-color:${escapeHtml(department.color || "#6366f1")}"><div class="department-heading"><div><span class="department-icon">${escapeHtml(department.icon || "◈")}</span><h2>${escapeHtml(department.name)}</h2></div><button class="text-button" data-edit-entity="department" data-id="${department.id}">管理</button></div><p>${escapeHtml(department.description || "")}</p><div class="employee-list">${primary.map((employee) => employeeCard(employee)).join("") || `<p class="empty-inline">沒有符合條件的主要員工。</p>`}${secondary.length ? `<div class="secondary-group"><small>協作員工</small>${secondary.map((employee) => `${employeeCard(employee, true)}<p class="primary-hint">主要部門：${escapeHtml(label(state.departments, employee.primaryDepartmentId))}</p>`).join("")}</div>` : ""}</div></section>`; }).join("") || `<section class="empty-state"><h2>還沒有部門</h2><p>先在設定頁建立部門，再新增 AI 員工。</p></section>`}</section>`;
}

function entityPanel(entity, title, fields) {
  const items = state[`${entity}s`];
  return `<section class="settings-panel"><div class="panel-heading"><h2>${title}</h2><button class="button ghost" data-new-entity="${entity}">＋ 新增</button></div><div class="entity-list">${items.filter((item) => !item.isDeleted).sort((a,b) => a.sortOrder - b.sortOrder).map((item) => `<div class="entity-row"><span class="color-dot" style="background:${escapeHtml(item.color || "#64748b")}"></span><strong>${escapeHtml(item.name)}</strong><span class="muted">${fields(item)}</span><button class="text-button" data-edit-entity="${entity}" data-id="${item.id}">編輯</button><button class="text-button danger-text" data-delete-entity="${entity}" data-id="${item.id}">刪除</button></div>`).join("") || `<p class="empty-inline">尚無資料</p>`}</div></section>`;
}

export function settingsView() {
  document.querySelector("#content").innerHTML = `<section class="page-heading"><div><p class="eyebrow">SETTINGS</p><h1>管理設定</h1><p>維護辦公室的部門、員工狀態與分類標籤。</p></div></section><div class="settings-grid">${entityPanel("department", "部門", (i) => i.description || "")} ${entityPanel("status", "狀態", (i) => i.isActive === false ? "已停用" : "啟用中")} ${entityPanel("tag", "標籤", () => "")}</div>`;
}

export function trashView() {
  const removed = state.employees.filter((employee) => employee.isDeleted).sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
  document.querySelector("#content").innerHTML = `<section class="page-heading"><div><p class="eyebrow">RECYCLE BIN</p><h1>回收桶</h1><p>可還原已刪除的 AI 員工；永久刪除無法復原。</p></div></section><section class="trash-list">${removed.map((employee) => `<article class="trash-row"><span class="avatar">${initials(employee.name)}</span><div><strong>${escapeHtml(employee.name)}</strong><p>${escapeHtml(employee.title || "未設定職稱")} · 刪除於 ${formatDate(employee.deletedAt)}</p></div><div><button class="button ghost" data-restore="${employee.id}">還原</button><button class="button danger" data-purge="${employee.id}">永久刪除</button></div></article>`).join("") || `<section class="empty-state"><h2>回收桶是空的</h2><p>移除的 AI 員工會顯示在這裡。</p></section>`}</section>`;
}

export function renderView() {
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === state.view));
  if (state.view === "settings") settingsView(); else if (state.view === "trash") trashView(); else officeView();
}

export function employeeForm(employee = {}) {
  const isEdit = Boolean(employee.id);
  return `<div class="backdrop"><section class="modal form-modal" role="dialog" aria-modal="true" aria-labelledby="employee-form-title"><div class="modal-header"><h2 id="employee-form-title">${isEdit ? "編輯" : "新增"} AI 員工</h2><button class="icon-button" data-close-modal aria-label="關閉">×</button></div><form id="employee-form"><input name="id" type="hidden" value="${escapeHtml(employee.id || "")}" /><div class="form-grid"><label>名稱 *<input name="name" required value="${escapeHtml(employee.name || "")}" /></label><label>平台 *<select name="platform" required><option value="GPT" ${employee.platform === "GPT" ? "selected" : ""}>ChatGPT（GPT）</option><option value="Gem" ${employee.platform === "Gem" ? "selected" : ""}>Google Gemini（Gem）</option></select></label><label>職稱<input name="title" value="${escapeHtml(employee.title || "")}" /></label><label>頭像網址<input name="avatar" type="url" value="${escapeHtml(employee.avatar || "")}" /></label><label class="full">用途摘要<input name="purpose" value="${escapeHtml(employee.purpose || "")}" /></label><label>AI 使用連結 *<input name="usageUrl" required type="url" value="${escapeHtml(employee.usageUrl || "")}" /></label><label>後台管理連結<input name="adminUrl" type="url" value="${escapeHtml(employee.adminUrl || "")}" /></label><label>主要部門 *<select name="primaryDepartmentId" required>${options(state.departments, employee.primaryDepartmentId, "請選擇部門")}</select></label><label>狀態 *<select name="statusId" required>${options(state.statuses, employee.statusId, "請選擇狀態")}</select></label><label>排序數字<input name="sortOrder" type="number" min="1" value="${escapeHtml(employee.sortOrder || "")}" placeholder="數字越小越前面" /></label><fieldset class="full"><legend>其他所屬部門</legend>${state.departments.filter((d) => !d.isDeleted).map((d) => `<label class="check"><input type="checkbox" name="departmentIds" value="${d.id}" ${employee.departmentIds?.includes(d.id) ? "checked" : ""} />${escapeHtml(d.name)}</label>`).join("")}</fieldset><fieldset class="full"><legend>標籤</legend>${state.tags.filter((t) => !t.isDeleted).map((t) => `<label class="check"><input type="checkbox" name="tagIds" value="${t.id}" ${employee.tagIds?.includes(t.id) ? "checked" : ""} />${escapeHtml(t.name)}</label>`).join("") || "尚無標籤"}</fieldset><label class="full">備註<textarea name="note" rows="2">${escapeHtml(employee.note || "")}</textarea></label><label class="full">長備註<textarea name="longNote" rows="3">${escapeHtml(employee.longNote || "")}</textarea></label><label class="full">目前使用的 Prompt<textarea name="prompt" rows="7">${escapeHtml(employee.prompt || "")}</textarea></label></div><p id="form-error" class="error" hidden></p><div class="dialog-actions"><button type="button" class="button ghost" data-close-modal>取消</button><button type="submit" class="button primary">${isEdit ? "儲存變更" : "建立 AI 員工"}</button></div></form></section></div>`;
}

export function entityForm(entity, item = {}) {
  const labels = { department: "部門", status: "狀態", tag: "標籤" };
  return `<div class="backdrop"><section class="modal small-modal" role="dialog" aria-modal="true"><div class="modal-header"><h2>${item.id ? "編輯" : "新增"}${labels[entity]}</h2><button class="icon-button" data-close-modal aria-label="關閉">×</button></div><form id="entity-form" data-entity="${entity}"><input name="id" type="hidden" value="${escapeHtml(item.id || "")}"/><label>名稱 *<input name="name" required value="${escapeHtml(item.name || "")}" /></label>${entity === "department" ? `<label>圖示<input name="icon" value="${escapeHtml(item.icon || "◈")}" /></label><label>說明<textarea name="description">${escapeHtml(item.description || "")}</textarea></label>` : ""}<label>顏色<input name="color" type="color" value="${escapeHtml(item.color || "#6366f1")}" /></label><label>排序數字<input name="sortOrder" type="number" min="1" value="${escapeHtml(item.sortOrder || "")}" placeholder="數字越小越前面" /></label>${entity === "status" ? `<label class="check"><input type="checkbox" name="isActive" ${item.isActive !== false ? "checked" : ""}/>啟用此狀態</label>` : ""}<p id="form-error" class="error" hidden></p><div class="dialog-actions"><button type="button" class="button ghost" data-close-modal>取消</button><button type="submit" class="button primary">儲存</button></div></form></section></div>`;
}
