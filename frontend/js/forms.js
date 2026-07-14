import { state } from "./state.js";
import { safeUrl } from "./utils.js";

export function readEmployeeForm(form) {
  const values = Object.fromEntries(new FormData(form));
  values.departmentIds = [...form.querySelectorAll('input[name="departmentIds"]:checked')].map((input) => input.value);
  values.tagIds = [...form.querySelectorAll('input[name="tagIds"]:checked')].map((input) => input.value);
  values.usageCount = Number(values.usageCount || 0);
  if (!values.departmentIds.includes(values.primaryDepartmentId)) values.departmentIds.unshift(values.primaryDepartmentId);
  if (!values.name.trim()) throw new Error("請填寫 AI 員工名稱。");
  if (!["GPT", "Gem"].includes(values.platform)) throw new Error("平台僅能選擇 GPT 或 Gem。");
  if (!safeUrl(values.usageUrl)) throw new Error("AI 使用連結必須是有效的 http 或 https URL。");
  if (values.adminUrl && !safeUrl(values.adminUrl)) throw new Error("後台管理連結必須是有效的 http 或 https URL。");
  return values;
}

export function readEntityForm(form) {
  const values = Object.fromEntries(new FormData(form));
  const entity = form.dataset.entity;
  if (!values.name.trim()) throw new Error("請填寫名稱。");
  if (entity === "status") values.isActive = form.elements.isActive.checked;
  return values;
}

export function employeeById(id) { return state.employees.find((employee) => employee.id === id); }
export function entityById(entity, id) { return state[`${entity}s`].find((item) => item.id === id); }

