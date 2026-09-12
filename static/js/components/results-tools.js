// ===== MODULE + SUITE SIDEBAR =====
function renderSuiteNodes(nodes, parentEl, moduleId, moduleName, depth) {
  (nodes || []).forEach((node) => {
    const item = document.createElement("div");
    item.className = `suite-item suite-item--depth${Math.min(depth, 2)}`;
    item.dataset.filterType = "suite";
    item.dataset.suiteId = node.id;
    item.dataset.moduleId = moduleId;
    if ((node.fail_count || 0) === 0)
      item.classList.add("suite-item--no-fail");

    const hasChildren = node.children && node.children.length > 0;
    item.innerHTML = `
      <span class="suite-chevron"><i class="fa-solid fa-chevron-down"></i></span>
      <span class="suite-item__icon"><i class="fa-regular fa-folder"></i></span>
      <span class="suite-item__name">${escH(node.name || "Suite")}</span>
      ${
        (node.fail_count || 0) > 0
          ? `<span class="suite-badge suite-badge--fail">${node.fail_count}</span>`
          : '<span class="suite-badge suite-badge--pass">✓</span>'
      }`;

    const children = document.createElement("div");
    children.className = "suite-children";

    item.addEventListener("click", (e) => {
      e.stopPropagation();
      activeModuleId = moduleId;
      activeModuleName = moduleName;
      activeSuiteId = node.id;
      activeSuiteName = node.name || "Suite";
      refreshSidebarActiveState();
      updateCrumb();
      applyFilters();

      if (hasChildren) {
        children.classList.toggle("collapsed");
        const chev = item.querySelector(".suite-chevron i");
        chev.className = children.classList.contains("collapsed")
          ? "fa-solid fa-chevron-right"
          : "fa-solid fa-chevron-down";
      }
    });

    if (!hasChildren) {
      item.querySelector(".suite-chevron").style.visibility = "hidden";
    } else {
      renderSuiteNodes(
        node.children,
        children,
        moduleId,
        moduleName,
        depth + 1,
      );
    }

    parentEl.appendChild(item);
    parentEl.appendChild(children);
  });
}

function refreshSidebarActiveState() {
  document.querySelectorAll(".suite-item").forEach((el) => {
    const type = el.dataset.filterType;
    let active = false;
    if (type === "all") {
      active = !activeModuleId && !activeSuiteId;
    } else if (type === "module") {
      active =
        !!activeModuleId &&
        !activeSuiteId &&
        el.dataset.moduleId === activeModuleId;
    } else if (type === "suite") {
      active = !!activeSuiteId && el.dataset.suiteId === activeSuiteId;
    }
    el.classList.toggle("active", active);
  });
}

function updateCrumb() {
  const crumb = document.getElementById("active-filter-crumb");
  const label = document.getElementById("crumb-label");

  const parts = [];
  if (activeModuleName) parts.push(activeModuleName);
  if (activeSuiteName) parts.push(activeSuiteName);
  if (activeParentKeyword) parts.push(`Groupe: ${activeParentKeyword}`);

  if (parts.length === 0) {
    crumb.style.display = "none";
  } else {
    crumb.style.display = "flex";
    label.textContent = parts.join(" › ");
  }
}

function clearSuiteFilter() {
  activeSuiteId = null;
  activeSuiteName = null;
  activeModuleId = null;
  activeModuleName = null;
  activeParentKeyword = null;
  refreshSidebarActiveState();
  updateCrumb();
  highlightKeywordGroup();
  applyFilters();
}

// ===== KEYWORD GROUPS =====
function renderKeywordGroups(failures) {
  const host = document.getElementById("keyword-groups");
  const counters = {};

  (failures || []).forEach((f) => {
    const parent =
      ((f.keyword || "").split(" ➔ ")[0] || "").trim() || "Inconnu";
    counters[parent] = (counters[parent] || 0) + 1;
  });

  const groups = Object.entries(counters)
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1]);

  if (!groups.length) {
    host.style.display = "none";
    host.innerHTML = "";
    return;
  }

  keywordGroupsVisible = Boolean(activeParentKeyword);
  toggleKeywordGroups(keywordGroupsVisible);
  host.style.display = "flex";
  host.innerHTML =
    groups
      .map(
        ([keyword, count]) => `
  <button class="kw-group-pill" data-parent-keyword="${escHAttr(keyword)}" onclick="filterByKeywordGroup('${escJS(keyword)}')">
      <span class="kw-group-pill__name">${escH(keyword)}</span>
      <span class="kw-group-pill__count">${count}</span>
  </button>
    `,
      )
      .join("") +
    '<button class="kw-group-clear" type="button" onclick="clearKeywordGroup()"><i class="fa-solid fa-xmark"></i> Réinitialiser groupe</button>';

  highlightKeywordGroup();
}

function filterByKeywordGroup(parentKeyword) {
  activeParentKeyword = parentKeyword;
  updateCrumb();
  highlightKeywordGroup();
  applyFilters();
}

function clearKeywordGroup() {
  activeParentKeyword = null;
  updateCrumb();
  highlightKeywordGroup();
  applyFilters();
}

function highlightKeywordGroup() {
  const selected = (activeParentKeyword || "").toLowerCase();
  document.querySelectorAll(".kw-group-pill").forEach((el) => {
    const value = (el.dataset.parentKeyword || "").toLowerCase();
    el.classList.toggle("active", !!selected && value === selected);
  });
}

// ===== SORT =====
function onSortChange() {
  sortState.field = document.getElementById("sort-field").value;
  sortState.dir = document.getElementById("sort-dir").value;
  applyFilters();
}

function clearSort() {
  sortState = { field: "", dir: "asc" };
  document.getElementById("sort-field").value = "";
  document.getElementById("sort-dir").value = "asc";
  applyFilters();
}

function getSortedRows() {
  const rows = [...allRows];
  if (!sortState.field) return rows;

  const keyMap = {
    module: "module",
    case: "case",
    keyword: "keyword",
    parentKeyword: "parentKeyword",
    error: "error",
  };
  const key = keyMap[sortState.field];
  const dir = sortState.dir === "desc" ? -1 : 1;

  if (!key) return rows;

  return rows.sort((a, b) => {
    const av = (a.dataset[key] || "").toLowerCase();
    const bv = (b.dataset[key] || "").toLowerCase();
    return av.localeCompare(bv, "fr", { sensitivity: "base" }) * dir;
  });
}

// ===== SEARCH & FILTER =====
function updateCount(visible) {
  const total = allRows.length;
  const shown = visible !== undefined ? visible : total;
  const el = document.getElementById("results-count");
  if (total === 0) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML =
    shown < total
      ? `<strong>${shown}</strong> / ${total} résultats`
      : `<strong>${total}</strong> résultat${total > 1 ? "s" : ""}`;
}
