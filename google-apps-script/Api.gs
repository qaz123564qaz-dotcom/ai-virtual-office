function doGet(e) {
  try {
    resetRequestCaches_();
    if ((e.parameter || {}).action === 'health') return jsonOutput_(successResponse_({ status: 'ok', timestamp: nowIso_() }, 'API 正常運作'));
    return jsonOutput_(successResponse_({ name: 'AI 員工虛擬辦公室 API', authenticated: true }, '請使用 POST 呼叫 API。'));
  } catch (error) { return jsonOutput_(errorResponse_(error)); }
}

function doPost(e) {
  try {
    resetRequestCaches_();
    let request;
    try { request = JSON.parse(e.postData && e.postData.contents || '{}'); }
    catch (_) { throw new AppError_('INVALID_JSON', '請求內容必須是 JSON。'); }
    const action = required_(request.action, 'action');
    const user = validateCredential_(request.credential);
    const data = request.data || {};
    let result;
    switch (action) {
      case 'bootstrap':
        ensureSpreadsheetReady_();
        ensureUserWorkspace_(user);
        result = workspaceForUser_(user);
        break;
      case 'employee.create': result = createEmployee_(data, user); break;
      case 'employee.update': result = updateEmployee_(data, user); break;
      case 'employee.delete': result = deleteEmployee_(required_(data.id, 'id'), user); break;
      case 'employee.restore': result = restoreEmployee_(required_(data.id, 'id'), user); break;
      case 'employee.purge': result = purgeEmployee_(required_(data.id, 'id'), user); break;
      case 'employee.recordUse': result = recordUse_(required_(data.id, 'id'), user); break;
      case 'employee.reorder': result = reorderEmployees_(data.departments, user); break;
      case 'department.save': result = saveDepartment_(data, user); break;
      case 'department.delete': result = deleteDepartment_(required_(data.id, 'id'), user); break;
      case 'department.reorder': result = reorderEntities_('department', data.orderedIds, user); break;
      case 'status.save': result = saveStatus_(data, user); break;
      case 'status.delete': result = deleteStatus_(required_(data.id, 'id'), user); break;
      case 'status.reorder': result = reorderEntities_('status', data.orderedIds, user); break;
      case 'tag.save': result = saveTag_(data, user); break;
      case 'tag.delete': result = deleteTag_(required_(data.id, 'id'), user); break;
      case 'tag.reorder': result = reorderEntities_('tag', data.orderedIds, user); break;
      case 'system.initialize': initSpreadsheet_(); ensureUserWorkspace_(user); result = workspaceForUser_(user); break;
      default: throw new AppError_('UNKNOWN_ACTION', `未知 action：${action}`);
    }
    return jsonOutput_(successResponse_(result));
  } catch (error) { return jsonOutput_(errorResponse_(error)); }
}
