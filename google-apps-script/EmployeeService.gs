function recordsForUser_(sheetName, user) {
  return records_(sheetName).filter((record) => record.ownerId === user.id);
}

function listEmployees_(user, includeDeleted) {
  return recordsForUser_('AI_Employees', user)
    .filter((employee) => includeDeleted || !employee.isDeleted)
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
}

function getEmployee_(id, user) {
  const employee = recordsForUser_('AI_Employees', user).find((item) => item.id === id);
  if (!employee) throw new AppError_('NOT_FOUND', '找不到 AI 員工。');
  return employee;
}

function validateEmployee_(data, existing, user) {
  const name = required_(data.name, '名稱');
  const platform = required_(data.platform, '平台');
  if (!['GPT', 'Gem'].includes(platform)) throw new AppError_('VALIDATION_ERROR', '平台僅能是 GPT 或 Gem。');
  const usageUrl = requireUrl_(data.usageUrl, 'AI 使用連結');
  const adminUrl = requireUrl_(data.adminUrl, '後台管理連結', true);
  const primaryDepartmentId = required_(data.primaryDepartmentId, '主要部門');
  const departmentIds = Array.isArray(data.departmentIds) ? data.departmentIds.filter(Boolean) : [];
  if (!departmentIds.includes(primaryDepartmentId)) departmentIds.unshift(primaryDepartmentId);
  const departments = recordsForUser_('Departments', user).filter((item) => !item.isDeleted);
  const statuses = recordsForUser_('Statuses', user).filter((item) => item.isActive);
  const tags = recordsForUser_('Tags', user).filter((item) => !item.isDeleted);
  if (!departments.some((item) => item.id === primaryDepartmentId) || departmentIds.some((id) => !departments.some((item) => item.id === id))) throw new AppError_('VALIDATION_ERROR', '所選部門不存在或已刪除。');
  if (!statuses.some((item) => item.id === data.statusId)) throw new AppError_('VALIDATION_ERROR', '請選擇一個啟用中的狀態。');
  const tagIds = Array.isArray(data.tagIds) ? data.tagIds.filter(Boolean) : [];
  if (tagIds.some((id) => !tags.some((item) => item.id === id))) throw new AppError_('VALIDATION_ERROR', '所選標籤不存在或已刪除。');
  if (recordsForUser_('AI_Employees', user).some((item) => item.name.toLowerCase() === name.toLowerCase() && item.id !== existing?.id)) throw new AppError_('DUPLICATE_NAME', '已有相同名稱的 AI 員工。');
  const now = nowIso_();
  return Object.assign({}, existing || {}, data, {
    id: existing?.id || uuid_(), ownerId: user.id, ownerEmail: user.email, name, platform, title: String(data.title || ''), purpose: String(data.purpose || ''), usageUrl, adminUrl,
    primaryDepartmentId, departmentIds, statusId: data.statusId, tagIds, avatar: String(data.avatar || ''), note: String(data.note || ''), longNote: String(data.longNote || ''), prompt: String(data.prompt || ''),
    usageCount: Number(existing?.usageCount || 0), lastUsedAt: existing?.lastUsedAt || '', createdAt: existing?.createdAt || now, updatedAt: now,
    deletedAt: existing?.deletedAt || '', isDeleted: existing?.isDeleted || false, sortOrder: Number(data.sortOrder || existing?.sortOrder || nextSortOrder_('AI_Employees', user))
  });
}

function createEmployee_(data, user) { return withLock_(() => { const employee = validateEmployee_(data, null, user); saveRecord_('AI_Employees', employee); return employee; }); }
function updateEmployee_(data, user) { return withLock_(() => { const existing = getEmployee_(required_(data.id, 'id'), user); if (existing.isDeleted) throw new AppError_('VALIDATION_ERROR', '已刪除的 AI 員工不能直接編輯。'); const employee = validateEmployee_(data, existing, user); saveRecord_('AI_Employees', employee); return employee; }); }
function deleteEmployee_(id, user) { return withLock_(() => { const employee = getEmployee_(id, user); employee.isDeleted = true; employee.deletedAt = nowIso_(); employee.updatedAt = employee.deletedAt; saveRecord_('AI_Employees', employee); return employee; }); }
function restoreEmployee_(id, user) { return withLock_(() => { const employee = getEmployee_(id, user); employee.isDeleted = false; employee.deletedAt = ''; employee.updatedAt = nowIso_(); saveRecord_('AI_Employees', employee); return employee; }); }
function purgeEmployee_(id, user) { return withLock_(() => { const employee = getEmployee_(id, user); if (!employee.isDeleted) throw new AppError_('VALIDATION_ERROR', '只能永久刪除回收桶中的 AI 員工。'); removeRecord_('AI_Employees', id); return { id }; }); }
function recordUse_(id, user) { return withLock_(() => { const employee = getEmployee_(id, user); if (employee.isDeleted) throw new AppError_('NOT_FOUND', '找不到 AI 員工。'); employee.usageCount = Number(employee.usageCount || 0) + 1; employee.lastUsedAt = nowIso_(); employee.updatedAt = employee.lastUsedAt; saveRecord_('AI_Employees', employee); return employee; }); }

function reorderEmployees_(departments, user) {
  return withLock_(() => {
    if (!Array.isArray(departments)) throw new AppError_('VALIDATION_ERROR', 'departments 必須是陣列。');
    const ownedDepartments = recordsForUser_('Departments', user).filter((department) => !department.isDeleted);
    const activeEmployees = recordsForUser_('AI_Employees', user).filter((employee) => !employee.isDeleted);
    const seenDepartments = new Set();
    const seenEmployees = new Set();
    const sortOrderById = {};
    const changedEmployees = [];

    departments.forEach((entry) => {
      if (!entry || typeof entry.departmentId !== 'string' || !entry.departmentId.trim()) throw new AppError_('VALIDATION_ERROR', '每組排序都必須提供 departmentId。');
      const departmentId = entry.departmentId.trim();
      if (seenDepartments.has(departmentId)) throw new AppError_('DUPLICATE_ID', '同一部門不可重複送出。');
      seenDepartments.add(departmentId);
      if (!ownedDepartments.some((department) => department.id === departmentId)) throw new AppError_('NOT_FOUND', '找不到指定部門，或該部門不屬於目前使用者。');

      const ids = validatedOrderedIds_(entry.orderedIds, 'orderedIds');
      const expected = activeEmployees.filter((employee) => employee.primaryDepartmentId === departmentId);
      assertExactIds_(ids, expected.map((employee) => employee.id), '員工排序');
      const byId = {};
      expected.forEach((employee) => { byId[employee.id] = employee; });
      ids.forEach((id, index) => {
        if (seenEmployees.has(id)) throw new AppError_('DUPLICATE_ID', '同一位員工不可出現在多個排序群組。');
        seenEmployees.add(id);
        if (byId[id].primaryDepartmentId !== departmentId) throw new AppError_('WRONG_DEPARTMENT', '員工只能在自己的主要部門內排序。');
        sortOrderById[id] = index + 1;
        changedEmployees.push(Object.assign({}, byId[id], { sortOrder: index + 1 }));
      });
    });

    writeSortOrders_('AI_Employees', sortOrderById);
    return { employees: changedEmployees };
  });
}
