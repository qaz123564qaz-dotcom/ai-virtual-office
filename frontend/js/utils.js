export const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

export function safeUrl(url) {
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : "";
  } catch { return ""; }
}

export function formatDate(value) {
  if (!value) return "尚未使用";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "-" : new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function initials(name = "AI") {
  return name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

export function byId(items, id) { return items.find((item) => item.id === id); }

export function debounce(fn, wait = 200) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); };
}

