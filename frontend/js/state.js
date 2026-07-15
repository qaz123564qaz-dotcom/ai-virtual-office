export const state = {
  credential: "",
  user: null,
  loading: false,
  employees: [],
  departments: [],
  statuses: [],
  tags: [],
  filters: { query: "", platform: "", departmentId: "", statusId: "", tagId: "" },
  view: "office",
  reorder: { entities: {}, employees: {} },
};

export function resetData() {
  state.employees = [];
  state.departments = [];
  state.statuses = [];
  state.tags = [];
  state.reorder = { entities: {}, employees: {} };
}
