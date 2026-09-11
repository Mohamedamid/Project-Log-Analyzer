document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDetail();
});

renderProjectDashboard();
renderHistoryPage();
syncAppSidebar();
showPage("dashboard");
