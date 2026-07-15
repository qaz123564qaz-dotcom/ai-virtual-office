import { state } from "./state.js?v=20260715-5";

const ENTITY_COLLECTIONS = { department: "departments", status: "statuses", tag: "tags" };
const LONG_PRESS_MS = 320;
const MOVE_TOLERANCE = 10;
let renderAfterChange = () => {};
let pointerSession = null;
let keyboardSession = null;

function sortedIds(items) {
  return [...items].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)).map((item) => item.id);
}

function entityOfficialIds(entity) {
  const collection = state[ENTITY_COLLECTIONS[entity]] || [];
  return sortedIds(collection.filter((item) => entity === "status" || !item.isDeleted));
}

function employeeOfficialIds(departmentId) {
  return sortedIds(state.employees.filter((employee) => !employee.isDeleted && employee.primaryDepartmentId === departmentId));
}

function sameIds(left, right) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function sameMembers(left, right) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

function validDraft(draft, official) {
  return Array.isArray(draft) && new Set(draft).size === draft.length && sameMembers(draft, official);
}

function directSortableItems(list) {
  return Array.from(list?.children || []).filter((item) => item.matches("[data-sort-item]"));
}

function currentIds(list) {
  return directSortableItems(list).map((item) => item.dataset.sortId);
}

function applyOrder(list, ids, beforeNode = null) {
  const byId = new Map(directSortableItems(list).map((item) => [item.dataset.sortId, item]));
  ids.forEach((id) => {
    const item = byId.get(id);
    if (item) list.insertBefore(item, beforeNode);
  });
}

function makeHandle(label, disabled = false) {
  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "drag-handle";
  handle.dataset.dragHandle = "";
  handle.disabled = disabled;
  handle.setAttribute("aria-label", label);
  handle.setAttribute("aria-describedby", "drag-help");
  handle.setAttribute("aria-grabbed", "false");
  handle.title = disabled ? "至少需要兩個項目才能排序" : "按住拖曳；鍵盤可按空白鍵開始";
  handle.textContent = "⠿";
  return handle;
}

function addDragHelp() {
  if (document.querySelector("#drag-help")) return;
  const help = document.createElement("p");
  help.id = "drag-help";
  help.className = "sr-only";
  help.textContent = "空白鍵開始排序，方向鍵移動，Enter 放置，Escape 取消。";
  document.querySelector("#content")?.prepend(help);
}

function enhanceEntityPanel(panel) {
  const entity = panel.dataset.entityPanel;
  const list = panel.querySelector(".entity-list");
  const official = entityOfficialIds(entity);
  let draft = state.reorder.entities[entity];
  if (draft && !validDraft(draft, official)) {
    delete state.reorder.entities[entity];
    draft = null;
  }

  list.dataset.sortList = "entity";
  list.dataset.sortScope = entity;
  list.querySelectorAll(":scope > .entity-row").forEach((row) => {
    row.dataset.sortItem = "";
    row.dataset.sortId = row.dataset.id;
    row.prepend(makeHandle(`移動${row.querySelector("strong")?.textContent || "項目"}`, official.length < 2));
  });
  applyOrder(list, draft || official);

  if (!draft) return;
  panel.classList.add("sort-dirty");
  panel.querySelectorAll("[data-new-entity],[data-edit-entity],[data-delete-entity]").forEach((button) => { button.disabled = true; });
  const actions = document.createElement("div");
  actions.className = "sort-actions";
  actions.innerHTML = `<span>順序尚未儲存</span><button class="button ghost" data-cancel-entity-order="${entity}">取消</button><button class="button primary" data-save-entity-order="${entity}">儲存排序</button>`;
  panel.append(actions);
}

function filtersActive() {
  return Object.values(state.filters).some((value) => String(value || "").trim());
}

function enhanceOffice() {
  const filtered = filtersActive();
  const cards = document.querySelectorAll(".department-card[data-department-id]");
  cards.forEach((departmentCard) => {
    const departmentId = departmentCard.dataset.departmentId;
    const list = departmentCard.querySelector(".employee-list");
    const official = employeeOfficialIds(departmentId);
    let draft = state.reorder.employees[departmentId];
    if (draft && !validDraft(draft, official)) {
      delete state.reorder.employees[departmentId];
      draft = null;
    }

    list.dataset.sortList = "employee";
    list.dataset.sortScope = departmentId;
    list.querySelectorAll(":scope > .employee-card:not(.compact)").forEach((card) => {
      card.dataset.sortItem = "";
      card.dataset.sortId = card.dataset.employeeId;
      if (!filtered) {
        const name = card.querySelector(".employee-topline strong")?.textContent || "AI 員工";
        card.prepend(makeHandle(`移動${name}`, official.length < 2));
      }
    });
    if (draft && !filtered) applyOrder(list, draft, list.querySelector(":scope > .secondary-group"));
  });

  const filters = document.querySelector(".filters");
  if (filtered && filters) {
    const note = document.createElement("p");
    note.className = "sort-disabled-note";
    note.textContent = "目前有搜尋或篩選條件；請先清除篩選，再拖曳員工排序。";
    filters.after(note);
  }

  if (!hasEmployeeDrafts()) return;
  document.querySelectorAll("[data-new-employee],[data-edit-employee],[data-delete-employee],[data-new-entity='department']").forEach((button) => { button.disabled = true; });
  const bar = document.createElement("section");
  bar.className = "office-sort-bar";
  bar.setAttribute("role", "status");
  bar.innerHTML = `<span><strong>員工順序尚未儲存</strong><small>可繼續調整其他部門，最後一次儲存。</small></span><span><button class="button ghost" data-cancel-employee-order>取消全部</button><button class="button primary" data-save-employee-order>儲存員工排序</button></span>`;
  document.querySelector("#content")?.append(bar);
}

export function enhanceReorderUI() {
  if (!document.querySelector("#content")) return;
  addDragHelp();
  if (state.view === "settings") document.querySelectorAll("[data-entity-panel]").forEach(enhanceEntityPanel);
  if (state.view === "office") enhanceOffice();
}

export function hasEntityDraft(entity) {
  return Boolean(state.reorder.entities[entity]);
}

export function hasEmployeeDrafts() {
  return Object.keys(state.reorder.employees).length > 0;
}

export function hasAnyReorderDrafts() {
  return Object.keys(state.reorder.entities).length > 0 || hasEmployeeDrafts();
}

export function cancelEntityDraft(entity) {
  delete state.reorder.entities[entity];
}

export function cancelEmployeeDrafts() {
  state.reorder.employees = {};
}

export function clearAllReorderDrafts() {
  state.reorder = { entities: {}, employees: {} };
}

function commitList(list) {
  const kind = list.dataset.sortList;
  const scope = list.dataset.sortScope;
  const ids = currentIds(list);
  const official = kind === "entity" ? entityOfficialIds(scope) : employeeOfficialIds(scope);
  if (!validDraft(ids, official)) return;
  const drafts = kind === "entity" ? state.reorder.entities : state.reorder.employees;
  if (sameIds(ids, official)) delete drafts[scope]; else drafts[scope] = ids;
  renderAfterChange();
}

function restoreOrder(list, ids) {
  const beforeNode = list.dataset.sortList === "employee" ? list.querySelector(":scope > .secondary-group") : null;
  applyOrder(list, ids, beforeNode);
}

function cleanupPointer(commit) {
  if (!pointerSession) return;
  clearTimeout(pointerSession.timer);
  const { handle, item, list, baseline, active } = pointerSession;
  handle.classList.remove("is-pressing");
  if (active) {
    item.classList.remove("is-dragging");
    list.classList.remove("sort-list-active");
    handle.setAttribute("aria-grabbed", "false");
    if (commit) commitList(list); else restoreOrder(list, baseline);
  }
  pointerSession = null;
}

function activatePointer() {
  if (!pointerSession) return;
  pointerSession.active = true;
  pointerSession.handle.classList.remove("is-pressing");
  pointerSession.item.classList.add("is-dragging");
  pointerSession.list.classList.add("sort-list-active");
  pointerSession.handle.setAttribute("aria-grabbed", "true");
}

function onPointerDown(event) {
  const handle = event.target.closest("[data-drag-handle]");
  if (!handle || handle.disabled || event.button !== 0 || event.isPrimary === false) return;
  const item = handle.closest("[data-sort-item]");
  const list = item?.parentElement;
  if (!list?.matches("[data-sort-list]")) return;
  event.preventDefault();
  pointerSession = {
    pointerId: event.pointerId,
    handle,
    item,
    list,
    startX: event.clientX,
    startY: event.clientY,
    baseline: currentIds(list),
    active: false,
    timer: setTimeout(activatePointer, LONG_PRESS_MS),
  };
  handle.classList.add("is-pressing");
  handle.setPointerCapture?.(event.pointerId);
}

function onPointerMove(event) {
  if (!pointerSession || pointerSession.pointerId !== event.pointerId) return;
  const distance = Math.hypot(event.clientX - pointerSession.startX, event.clientY - pointerSession.startY);
  if (!pointerSession.active) {
    if (distance > MOVE_TOLERANCE) cleanupPointer(false);
    return;
  }
  event.preventDefault();
  const underneath = document.elementFromPoint(event.clientX, event.clientY);
  const target = underneath?.closest?.("[data-sort-item]");
  if (!target || target === pointerSession.item || target.parentElement !== pointerSession.list) return;
  const rect = target.getBoundingClientRect();
  const before = event.clientY < rect.top + rect.height / 2;
  pointerSession.list.insertBefore(pointerSession.item, before ? target : target.nextSibling);
}

function onPointerUp(event) {
  if (!pointerSession || pointerSession.pointerId !== event.pointerId) return;
  cleanupPointer(pointerSession.active);
}

function finishKeyboard(commit) {
  if (!keyboardSession) return;
  const { handle, item, list, baseline } = keyboardSession;
  item.classList.remove("is-keyboard-sorting");
  list.classList.remove("sort-list-active");
  handle.setAttribute("aria-grabbed", "false");
  if (commit) commitList(list); else restoreOrder(list, baseline);
  keyboardSession = null;
  if (!commit) handle.focus();
}

function onKeyDown(event) {
  const handle = event.target.closest("[data-drag-handle]");
  if (!handle || handle.disabled) return;
  if (!keyboardSession) {
    if (event.key !== " " && event.key !== "Spacebar") return;
    event.preventDefault();
    const item = handle.closest("[data-sort-item]");
    const list = item.parentElement;
    keyboardSession = { handle, item, list, baseline: currentIds(list) };
    item.classList.add("is-keyboard-sorting");
    list.classList.add("sort-list-active");
    handle.setAttribute("aria-grabbed", "true");
    return;
  }
  if (keyboardSession.handle !== handle) return;
  if (["ArrowUp", "ArrowDown", "Enter", "Escape", " ", "Spacebar", "Tab"].includes(event.key)) event.preventDefault();
  if (event.key === "Escape") return finishKeyboard(false);
  if (["Enter", " ", "Spacebar", "Tab"].includes(event.key)) return finishKeyboard(true);
  const items = directSortableItems(keyboardSession.list);
  const index = items.indexOf(keyboardSession.item);
  if (event.key === "ArrowUp" && index > 0) keyboardSession.list.insertBefore(keyboardSession.item, items[index - 1]);
  if (event.key === "ArrowDown" && index < items.length - 1) keyboardSession.list.insertBefore(items[index + 1], keyboardSession.item);
}

export function initializeReorderController(onChange) {
  renderAfterChange = onChange;
  document.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("pointermove", onPointerMove, { passive: false });
  document.addEventListener("pointerup", onPointerUp);
  document.addEventListener("pointercancel", () => cleanupPointer(false));
  document.addEventListener("keydown", onKeyDown);
}
