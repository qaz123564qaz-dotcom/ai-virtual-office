function nextSortOrder_(sheetName) { const items=records_(sheetName); return items.length ? Math.max.apply(null,items.map((item)=>Number(item.sortOrder)||0))+1 : 1; }
function saveDepartment_(data) { return saveEntity_('department',data); }
function deleteDepartment_(id) { return deleteEntity_('department',id); }

