// ===== THEME =====
const body = document.body;
const themeToggle = document.getElementById("theme-toggle");
const saved = localStorage.getItem("theme") || "light";
if (saved === "dark") {
  body.classList.add("dark-mode");
  updateThemeBtn(true);
}
themeToggle.addEventListener("click", () => {
  const dark = !body.classList.contains("dark-mode");
  body.classList.toggle("dark-mode", dark);
  localStorage.setItem("theme", dark ? "dark" : "light");
  updateThemeBtn(dark);
});
function updateThemeBtn(isDark) {
  themeToggle.querySelector(".icon-sun").style.display = isDark
    ? "none"
    : "inline";
  themeToggle.querySelector(".icon-moon").style.display = isDark
    ? "inline"
    : "none";
}
