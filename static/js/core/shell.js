function syncAppSidebar() {
  const collapsed =
    localStorage.getItem(appSidebarStorageKey) === "true";
  document.body.classList.toggle("app-sidebar-collapsed", collapsed);
  const icon = document.querySelector(".app-sidebar__toggle i");
  if (icon) {
    icon.className = collapsed
      ? "fa-solid fa-angles-right"
      : "fa-solid fa-angles-left";
  }
}

function toggleAppSidebar() {
  const collapsed = !document.body.classList.contains(
    "app-sidebar-collapsed",
  );
  localStorage.setItem(appSidebarStorageKey, collapsed ? "true" : "false");
  syncAppSidebar();
}

function showPage(page) {
  const dashboardPage = document.getElementById("dashboard-page");
  const historyPage = document.getElementById("history-page");
  const gitlabPage = document.getElementById("gitlab-page");
  const dropZoneEl = document.getElementById("drop-zone");
  const resultsEl = document.getElementById("results");
  const loaderEl = document.getElementById("loader");
  const pageCopy = {
    dashboard: ["Dashboard projet", "Pilotage global des executions Robot Framework."],
    analyse: ["Analyse des logs", "Import des dossiers, filtres, modules et details d'erreur."],
    history: ["Historique", "Dernieres analyses sauvegardees localement."],
    gitlab: ["GitLab pipeline", "Utiliser les artifacts CI/CD pour alimenter ce dashboard."],
  };

  dashboardPage.style.display = page === "dashboard" ? "block" : "none";
  historyPage.style.display = page === "history" ? "block" : "none";
  gitlabPage.style.display = page === "gitlab" ? "block" : "none";
  dropZoneEl.style.display = page === "analyse" ? "grid" : "none";
  resultsEl.style.display =
    page === "analyse" && currentAnalysisData ? "block" : "none";
  loaderEl.style.display = "none";

  document.querySelectorAll(".app-nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.pageTarget === page);
  });
  document.body.dataset.page = page;
  document.body.classList.toggle("has-analysis", Boolean(currentAnalysisData));
  document.querySelector(".dashboard-header h1").textContent =
    pageCopy[page]?.[0] || "Log Analyzer";
  document.querySelector(".dashboard-header p").textContent =
    pageCopy[page]?.[1] || "";

  if (page === "dashboard") renderProjectDashboard();
  if (page === "history") renderHistoryPage();
}

function toggleSidebar() {
  sidebarVisible = !sidebarVisible;
  syncSidebar();
}

function syncSidebar() {
  const layout = document.querySelector(".results-layout");
  const sidebar = document.getElementById("suite-sidebar");
  const toggles = document.querySelectorAll(".sidebar-toggle");
  if (!layout || !sidebar || !toggles.length) return;
  layout.classList.toggle("sidebar-hidden", !sidebarVisible);
  sidebar.classList.toggle("suite-sidebar--open", sidebarVisible);
  toggles.forEach((toggle) => {
    toggle.classList.toggle("active", sidebarVisible);
    toggle.innerHTML = sidebarVisible
      ? '<i class="fa-solid fa-bars-staggered"></i>'
      : '<i class="fa-solid fa-bars"></i>';
    toggle.title = "Modules";
    toggle.setAttribute("aria-label", toggle.title);
  });
}

function toggleAnalysisFocus(force) {
  analysisTableFocus =
    typeof force === "boolean" ? force : !analysisTableFocus;
  document.body.classList.toggle("analysis-table-focus", analysisTableFocus);

  const toggle = document.getElementById("table-focus-toggle");
  if (toggle) {
    toggle.classList.toggle("active", analysisTableFocus);
    toggle.innerHTML = analysisTableFocus
      ? '<i class="fa-solid fa-up-right-and-down-left-from-center"></i> Vue complete'
      : '<i class="fa-solid fa-table-cells-large"></i> Table focus';
    toggle.title = analysisTableFocus
      ? "Afficher les options"
      : "Masquer les options";
    toggle.setAttribute("aria-label", toggle.title);
  }

  if (analysisTableFocus) {
    sidebarVisible = false;
    syncSidebar();
  }
}

function toggleKeywordGroups(force) {
  keywordGroupsVisible =
    typeof force === "boolean" ? force : !keywordGroupsVisible;
  document.body.classList.toggle("keywords-open", keywordGroupsVisible);

  const toggle = document.getElementById("keyword-toggle");
  if (toggle) {
    toggle.classList.toggle("active", keywordGroupsVisible);
    toggle.title = keywordGroupsVisible
      ? "Masquer les keywords"
      : "Afficher les keywords";
    toggle.setAttribute("aria-label", toggle.title);
  }
}
