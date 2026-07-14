function doGet(e) {
  try {
    if ((e.parameter || {}).action === 'health') return jsonOutput_(successResponse_({ status:'ok', timestamp:nowIso_() },'API 正常運作'));
    return jsonOutput_(successResponse_({ name:'AI 員工虛擬辦公室 API', authenticated:true },'請以 POST 呼叫 API。'));
  } catch (error) { return jsonOutput_(errorResponse_(error)); }
}

function doPost(e) {
  try {
    let request;
    try { request=JSON.parse(e.postData && e.postData.contents || '{}'); } catch (_) { throw new AppError_('INVALID_JSON','請求內容不是有效的 JSON。'); }
    const action=required_(request.action,'action');
    const user=validateCredential_(request.credential);
    const data=request.data || {};
    let result;
    switch(action) {
      case 'bootstrap': initSpreadsheet_(); result={user:user,employees:listEmployees_(true),departments:records_('Departments').filter((x)=>!x.isDeleted),statuses:records_('Statuses'),tags:records_('Tags').filter((x)=>!x.isDeleted)}; break;
      case 'employee.create': result=createEmployee_(data); break;
      case 'employee.update': result=updateEmployee_(data); break;
      case 'employee.delete': result=deleteEmployee_(required_(data.id,'id')); break;
      case 'employee.restore': result=restoreEmployee_(required_(data.id,'id')); break;
      case 'employee.purge': result=purgeEmployee_(required_(data.id,'id')); break;
      case 'employee.recordUse': result=recordUse_(required_(data.id,'id')); break;
      case 'department.save': result=saveDepartment_(data); break;
      case 'department.delete': result=deleteDepartment_(required_(data.id,'id')); break;
      case 'status.save': result=saveStatus_(data); break;
      case 'status.delete': result=deleteStatus_(required_(data.id,'id')); break;
      case 'tag.save': result=saveTag_(data); break;
      case 'tag.delete': result=deleteTag_(required_(data.id,'id')); break;
      case 'system.initialize': result=initSpreadsheet_(); break;
      default: throw new AppError_('UNKNOWN_ACTION',`不支援的 action：${action}`);
    }
    return jsonOutput_(successResponse_(result));
  } catch (error) { return jsonOutput_(errorResponse_(error)); }
}

