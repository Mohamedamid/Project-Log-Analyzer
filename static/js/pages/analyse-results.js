function displayResults(data) {
  currentAnalysisData = data;
  document.body.classList.add("has-analysis");
  renderProjectDashboard();
  document.getElementById("results").style.display = "block";
  document.getElementById("search-input").value = "";
  document.getElementById("status-filter").value = "all";
  document.getElementById("sort-field").value = "";
  document.getElementById("sort-dir").value = "asc";

  activeSuiteId = null;
  activeSuiteName = null;
  activeModuleId = null;
  activeModuleName = null;
  activeParentKeyword = null;
  sortState = { field: "", dir: "asc" };
  sidebarVisible = window.matchMedia("(min-width: 769px)").matches;

  const tbody = document.getElementById("failed-cases-body");
  const mobileCasesList = document.getElementById("mobile-cases-list");
  tbody.innerHTML = "";
  mobileCasesList.innerHTML = "";
  allRows = [];
  allCards = [];
  window._cases = data.cases || data.failures || [];
  window._failures = data.failures || [];

  buildModuleTree(data.modules || [], window._failures);
  renderKeywordGroups(window._failures);
  renderSummary(data);
  document.getElementById("toolbar-zone").style.display = "grid";
  document.getElementById("no-failures-state").style.display =
    window._cases.length ? "none" : "block";

  window._cases.forEach((item, idx) => {
    const row = document.createElement("tr");
    const isFail = item.status === "FAIL";
    const isPass = item.status === "PASS";
    const fixed = isCaseFixed(item);
    const blocked = isCaseBlocked(item);
    const kws = (item.keyword || "").split(" ➔ ");
    const parentKeyword = (kws[0] || item.keyword || "inconnu").trim();
    const suitePath = (item.suite_path || [])
      .slice(1)
      .map((s) => escH(s.name))
      .join(" › ");
    const moduleLabel = escH(item.module_name || "Module inconnu");
    const statusHTML = getStatusBadge(item, fixed, blocked);
    const fixActionHTML = isFail
      ? `<button class="case-fix-btn ${fixed ? "active" : ""}" type="button" onclick="event.stopPropagation(); toggleCaseFixed(${idx})"><i class="fa-solid ${fixed ? "fa-rotate-left" : "fa-check"}"></i> ${fixed ? "Annuler" : "Corriger"}</button>`
      : "";
    const blockActionHTML = item.status !== "PASS"
      ? `<button class="case-fix-btn case-block-btn ${blocked ? "active" : ""}" type="button" onclick="event.stopPropagation(); toggleCaseBlocked(${idx})"><i class="fa-solid ${blocked ? "fa-lock-open" : "fa-ban"}"></i> ${blocked ? "Debloquer" : "Bloquer"}</button>`
      : "";
    const actionHTML = `${fixActionHTML}${blockActionHTML}`;
    const message = isFail
      ? escH(item.error_message || "Echec sans message.")
      : isPass
        ? "Test passe avec succes."
        : `Statut ${escH(item.status || "inconnu")}.`;

    row.className = fixed ? "case-row--fixed" : blocked ? "case-row--blocked" : isFail ? "case-row--fail" : isPass ? "case-row--pass" : "case-row--other";
    row.dataset.status = isFail ? "fail" : isPass ? "pass" : "other";
    row.dataset.fixed = fixed ? "true" : "false";
    row.dataset.blocked = blocked ? "true" : "false";
    row.dataset.case = (item.case_name || "").toLowerCase();
    row.dataset.keyword = (item.keyword || "").toLowerCase();
    row.dataset.error = (item.error_message || "").toLowerCase();
    row.dataset.module = (item.module_name || "").toLowerCase();
    row.dataset.moduleId = item.module_id || "";
    row.dataset.parentKeyword = parentKeyword.toLowerCase();
    row.dataset.suiteIds = JSON.stringify(item.suite_ids || []);
    row.style.cursor = "pointer";

    const kwHTML =
      kws.length > 1
        ? `<div class="kw-parent">${escH(kws[0])}</div><div class="kw-arrow"><i class="fa-solid fa-arrow-down fa-xs"></i></div><div class="kw-child">${escH(kws[kws.length - 1])}</div>`
        : `<div class="kw-child">${escH(item.keyword)}</div>`;

    row.innerHTML = `
      <td class="status-cell">${statusHTML}</td>
      <td class="case-name-cell">
        <div class="case-module-tag">${moduleLabel}</div>
        <div class="case-suite-path">${suitePath || "Suite non disponible"}</div>
        <div class="case-title">${escH(item.case_name)}</div>
      </td>
      <td class="keyword-cell">${kwHTML}</td>
      <td class="error-cell"><pre>${message}</pre></td>
      <td class="action-cell">${actionHTML}</td>`;

    row.addEventListener("click", () => openDetail(idx));
    allRows.push(row);

    const card = document.createElement("article");
    card.className = `mobile-case-card ${fixed ? "mobile-case-card--fixed" : blocked ? "mobile-case-card--blocked" : isFail ? "mobile-case-card--fail" : isPass ? "mobile-case-card--pass" : "mobile-case-card--other"}`;
    Object.assign(card.dataset, row.dataset);
    card.style.cursor = "pointer";
    card.innerHTML = `
      <div class="mobile-case-card__header">
        <div class="mobile-case-card__headline">
          <div class="mobile-case-card__icon" aria-hidden="true">
            <i class="fa-solid ${fixed ? "fa-screwdriver-wrench" : blocked ? "fa-ban" : isFail ? "fa-triangle-exclamation" : isPass ? "fa-circle-check" : "fa-circle-minus"}"></i>
          </div>
          <div class="mobile-case-card__headline-text">
            <div class="case-module-tag">${moduleLabel}</div>
            <div class="case-title">${escH(item.case_name)}</div>
          </div>
        </div>
        ${actionHTML}
      </div>
      <div class="mobile-case-card__meta">
        <span class="mobile-case-card__meta-item"><i class="fa-regular fa-folder-open"></i> ${escH(suitePath || "Suite non disponible")}</span>
        <span class="mobile-case-card__meta-dot">•</span>
        <span class="mobile-case-card__meta-item">${statusHTML}</span>
      </div>
      <div class="mobile-case-card__keywords">${kwHTML}</div>
      <div class="mobile-case-card__error"><span class="mobile-case-card__label">Message</span><p>${message}</p></div>`;
    card.addEventListener("click", () => openDetail(idx));
    allCards.push(card);
    row.__cardRef = card;
  });

  mobileCasesList.replaceChildren(...allCards);
  syncSidebar();
  applyFilters();
  updateResponsiveView();
}

function renderSummary(data) {
  const total = (data.cases || []).length;
  const fails = data.failed_count || 0;
  const success = data.success_count || 0;
  const fixed = (data.cases || []).filter(isCaseFixed).length;
  const blocked = (data.cases || []).filter(isCaseBlocked).length;
  const other = (data.cases || []).filter(
    (item) => item.status !== "PASS" && item.status !== "FAIL",
  ).length;
  const modules = (data.modules || []).length;
  const summaryEl = document.getElementById("summary");
  summaryEl.className = fails ? "badge-failed" : "badge-success";
  summaryEl.innerHTML = `
    <span class="summary-pill ${fails ? "summary-pill--fail" : "summary-pill--success"}"><i class="fa-solid fa-triangle-exclamation"></i> ${fails} Echecs</span>
    <span class="summary-pill summary-pill--blocked"><i class="fa-solid fa-ban"></i> ${blocked} Bloques</span>
    <span class="summary-pill summary-pill--fixed"><i class="fa-solid fa-screwdriver-wrench"></i> ${fixed} Corriges</span>
    <span class="summary-pill summary-pill--success"><i class="fa-solid fa-circle-check"></i> ${success} Succes</span>
    <span class="summary-pill summary-pill--neutral"><i class="fa-solid fa-cubes"></i> ${total} tests · ${modules} module${modules > 1 ? "s" : ""}</span>`;
  document.getElementById("status-dashboard").innerHTML = `
    <article class="stat-card stat-card--total">
      <span>Total tests</span>
      <strong>${total}</strong>
      <small>${modules} module${modules > 1 ? "s" : ""}</small>
    </article>
    <article class="stat-card stat-card--fail">
      <span>A corriger</span>
      <strong>${Math.max(fails - fixed - blocked, 0)}</strong>
      <small>Echecs ouverts</small>
    </article>
    <article class="stat-card stat-card--fixed">
      <span>Corriges</span>
      <strong>${fixed}</strong>
      <small>Marques manuellement</small>
    </article>
    <article class="stat-card stat-card--blocked">
      <span>Bloques</span>
      <strong>${blocked}</strong>
      <small>En attente / dependance</small>
    </article>
    <article class="stat-card stat-card--pass">
      <span>Succes</span>
      <strong>${success}</strong>
      <small>Tests valides</small>
    </article>
    <article class="stat-card stat-card--other">
      <span>Autres</span>
      <strong>${other}</strong>
      <small>Skip / non execute</small>
    </article>`;
}

function getStatusBadge(item, fixed, blocked) {
  if (fixed) return '<span class="case-status case-status--fixed"><i class="fa-solid fa-screwdriver-wrench"></i> Corrige</span>';
  if (blocked) return '<span class="case-status case-status--blocked"><i class="fa-solid fa-ban"></i> Bloque</span>';
  if (item.status === "PASS") return '<span class="case-status case-status--pass"><i class="fa-solid fa-circle-check"></i> Succes</span>';
  if (item.status === "FAIL") return '<span class="case-status case-status--fail"><i class="fa-solid fa-circle-xmark"></i> Echec</span>';
  return `<span class="case-status case-status--other"><i class="fa-solid fa-circle-minus"></i> ${escH(item.status || "Skip")}</span>`;
}

function buildModuleTree(modules, failures) {
  const sidebarEl = document.getElementById("suite-sidebar");
  const treeEl = document.getElementById("suite-tree");
  treeEl.innerHTML = "";
  if (!modules.length) {
    sidebarEl.style.display = "none";
    return;
  }
  sidebarEl.style.display = "flex";

  const allItem = document.createElement("div");
  allItem.className = "suite-item suite-item--all active";
  allItem.dataset.filterType = "all";
  allItem.innerHTML = `<span class="suite-item__icon"><i class="fa-solid fa-layer-group"></i></span><span class="suite-item__name">Tout afficher</span><span class="suite-badge suite-badge--fail">${failures.length}</span>`;
  allItem.addEventListener("click", () => {
    activeModuleId = null;
    activeModuleName = null;
    activeSuiteId = null;
    activeSuiteName = null;
    refreshSidebarActiveState();
    updateCrumb();
    applyFilters();
  });
  treeEl.appendChild(allItem);

  modules.forEach((module) => {
    const moduleWrap = document.createElement("div");
    const moduleItem = document.createElement("div");
    moduleItem.className = "suite-item suite-item--depth1 module-item";
    moduleItem.dataset.filterType = "module";
    moduleItem.dataset.moduleId = module.id;
    const hasChildren = module.suite_tree?.children?.length > 0;
    moduleItem.innerHTML = `
      <span class="suite-chevron module-chevron"><i class="fa-solid fa-chevron-down"></i></span>
      <span class="suite-item__icon"><i class="fa-solid fa-cube"></i></span>
      <span class="suite-item__name">${escH(module.name)}</span>
      <span class="suite-badge suite-badge--pass">${module.success_count || 0}</span>
      <span class="suite-badge suite-badge--fail">${module.failed_count || 0}</span>
      <button class="module-delete-btn" type="button" title="Supprimer module"><i class="fa-solid fa-trash"></i></button>`;
    const childrenContainer = document.createElement("div");
    childrenContainer.className = "module-children";
    moduleItem.addEventListener("click", () => {
      activeModuleId = module.id;
      activeModuleName = module.name;
      activeSuiteId = null;
      activeSuiteName = null;
      refreshSidebarActiveState();
      updateCrumb();
      if (window.matchMedia("(max-width: 768px)").matches) {
        sidebarVisible = false;
        syncSidebar();
      }
      applyFilters();
      if (hasChildren) {
        childrenContainer.classList.toggle("collapsed");
        const chev = moduleItem.querySelector(".module-chevron i");
        chev.className = childrenContainer.classList.contains("collapsed")
          ? "fa-solid fa-chevron-right"
          : "fa-solid fa-chevron-down";
      }
    });
    moduleItem.querySelector(".module-delete-btn").addEventListener("click", (event) => {
      event.stopPropagation();
      deleteModule(module.id);
    });
    if (!hasChildren) moduleItem.querySelector(".module-chevron").style.visibility = "hidden";
    moduleWrap.appendChild(moduleItem);
    if (hasChildren) renderSuiteNodes(module.suite_tree.children, childrenContainer, module.id, module.name, 2);
    moduleWrap.appendChild(childrenContainer);
    treeEl.appendChild(moduleWrap);
  });
}

async function deleteModule(moduleId) {
  if (!currentAnalysisData) return;
  const module = (currentAnalysisData.modules || []).find((item) => item.id === moduleId);
  const ok = await confirmAction({
    title: "Supprimer le module ?",
    text: `Supprimer ${module ? module.name : "ce module"} des resultats ?`,
    confirmButtonText: "Supprimer",
  });
  if (!ok) return;
  currentAnalysisData = {
    ...currentAnalysisData,
    modules: currentAnalysisData.modules.filter((item) => item.id !== moduleId),
    cases: currentAnalysisData.cases.filter((item) => item.module_id !== moduleId),
    failures: currentAnalysisData.failures.filter((item) => item.module_id !== moduleId),
  };
  currentAnalysisData.failed_count = currentAnalysisData.failures.length;
  currentAnalysisData.success_count = currentAnalysisData.cases.filter((item) => item.status === "PASS").length;
  currentAnalysisData.total_count = currentAnalysisData.cases.length;
  displayResults(currentAnalysisData);
}

function toggleCaseFixed(idx) {
  const item = window._cases && window._cases[idx];
  if (!item || item.status !== "FAIL") return;
  const key = getCaseKey(item);
  if (fixedCaseKeys.has(key)) fixedCaseKeys.delete(key);
  else {
    fixedCaseKeys.add(key);
    blockedCaseKeys.delete(key);
  }
  saveFixedCases();
  saveBlockedCases();
  displayResults(currentAnalysisData);
}

function toggleCaseBlocked(idx) {
  const item = window._cases && window._cases[idx];
  if (!item || item.status === "PASS") return;
  const key = getCaseKey(item);
  if (blockedCaseKeys.has(key)) blockedCaseKeys.delete(key);
  else {
    blockedCaseKeys.add(key);
    fixedCaseKeys.delete(key);
  }
  saveBlockedCases();
  saveFixedCases();
  displayResults(currentAnalysisData);
}

function applyFilters() {
  const q = document.getElementById("search-input").value.toLowerCase().trim();
  const statusFilter = document.getElementById("status-filter").value;
  const tbody = document.getElementById("failed-cases-body");
  const mobileCasesList = document.getElementById("mobile-cases-list");
  const mobile = isMobileLayout();
  const orderedRows = getSortedRows();
  let visible = 0;
  tbody.innerHTML = "";
  mobileCasesList.style.display = mobile ? "grid" : "none";
  document.getElementById("table-container").style.display = mobile ? "none" : "block";

  orderedRows.forEach((row) => {
    let match = true;
    if (statusFilter === "fixed") match = row.dataset.fixed === "true";
    else if (statusFilter === "blocked") match = row.dataset.blocked === "true";
    else if (statusFilter === "open") match = row.dataset.status === "fail" && row.dataset.fixed !== "true" && row.dataset.blocked !== "true";
    else if (statusFilter !== "all") match = row.dataset.status === statusFilter;
    if (match && activeModuleId) match = row.dataset.moduleId === activeModuleId;
    if (match && activeSuiteId) {
      const suiteIds = JSON.parse(row.dataset.suiteIds || "[]");
      match = suiteIds.includes(activeSuiteId);
    }
    if (match && activeParentKeyword) match = row.dataset.parentKeyword === activeParentKeyword.toLowerCase();
    if (match && q) {
      match =
        row.dataset.case.includes(q) ||
        row.dataset.keyword.includes(q) ||
        row.dataset.error.includes(q) ||
        row.dataset.module.includes(q) ||
        row.dataset.parentKeyword.includes(q);
    }
    row.style.display = match ? "" : "none";
    tbody.appendChild(row);
    if (match) visible++;
    if (row.__cardRef) row.__cardRef.style.display = match ? "" : "none";
  });

  document.getElementById("empty-search").style.display =
    visible === 0 && allRows.length > 0 ? "block" : "none";
  updateCount(visible);
}
