const ENTITY_META_ = { department: { sheet: 'Departments' }, status: { sheet: 'Statuses' }, tag: { sheet: 'Tags' } };

function nextSortOrder_(sheetName, user) {
  const items = user ? recordsForUser_(sheetName, user) : records_(sheetName);
  return items.length ? Math.max.apply(null, items.map((item) => Number(item.sortOrder) || 0)) + 1 : 1;
}

function saveEntity_(entity, data, user) {
  return withLock_(() => {
    const meta = ENTITY_META_[entity];
    if (!meta) throw new AppError_('VALIDATION_ERROR', '不支援的資料類型。');
    const name = required_(data.name, '名稱');
    const items = recordsForUser_(meta.sheet, user);
    const existing = data.id ? items.find((item) => item.id === data.id) : null;
    if (data.id && !existing) throw new AppError_('NOT_FOUND', '找不到資料。');
    if (items.some((item) => item.name.toLowerCase() === name.toLowerCase() && item.id !== data.id)) throw new AppError_('DUPLICATE_NAME', '已有相同名稱。');
    const now = nowIso_();
    const record = Object.assign({}, existing || {}, data, { id: existing?.id || uuid_(), ownerId: user.id, ownerEmail: user.email, name, color: String(data.color || existing?.color || '#6366f1'), sortOrder: Number(data.sortOrder || existing?.sortOrder || nextSortOrder_(meta.sheet, user)), createdAt: existing?.createdAt || now, updatedAt: now });
    if (entity === 'department') Object.assign(record, { icon: String(data.icon || existing?.icon || '◈'), description: String(data.description || existing?.description || ''), isDeleted: false });
    if (entity === 'status') record.isActive = asBoolean_(data.isActive, existing?.isActive !== false);
    if (entity === 'tag') record.isDeleted = false;
    saveRecord_(meta.sheet, record);
    return record;
  });
}

function deleteEntity_(entity, id, user) {
  return withLock_(() => {
    const meta = ENTITY_META_[entity];
    const item = meta && recordsForUser_(meta.sheet, user).find((record) => record.id === id);
    if (!meta || !item) throw new AppError_('NOT_FOUND', '找不到資料。');
    const employees = recordsForUser_('AI_Employees', user).filter((employee) => !employee.isDeleted);
    const used = entity === 'department' ? employees.some((employee) => employee.departmentIds.includes(id)) : entity === 'status' ? employees.some((employee) => employee.statusId === id) : employees.some((employee) => employee.tagIds.includes(id));
    if (used) throw new AppError_('IN_USE', '此資料仍被 AI 員工使用，請先移除關聯後再刪除。');
    if (entity === 'status') item.isActive = false; else item.isDeleted = true;
    item.updatedAt = nowIso_();
    saveRecord_(meta.sheet, item);
    return item;
  });
}

function reorderEntities_(entity, orderedIds, user) {
  return withLock_(() => {
    const meta = ENTITY_META_[entity];
    if (!meta) throw new AppError_('VALIDATION_ERROR', '不支援的資料類型。');
    const ids = validatedOrderedIds_(orderedIds, 'orderedIds');
    const items = recordsForUser_(meta.sheet, user).filter((item) => entity === 'status' || !item.isDeleted);
    assertExactIds_(ids, items.map((item) => item.id), `${entity} 排序`);
    const byId = {};
    items.forEach((item) => { byId[item.id] = item; });
    const sortOrderById = {};
    ids.forEach((id, index) => { sortOrderById[id] = index + 1; });
    writeSortOrders_(meta.sheet, sortOrderById);
    return { entity, items: ids.map((id, index) => Object.assign({}, byId[id], { sortOrder: index + 1 })) };
  });
}
