// ===== UTILS =====
function escH(t) {
  return String(t || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escHAttr(t) {
  return escH(t).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function escJS(t) {
  return String(t || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}
