function getAnalysisStats(data) {
  const cases = data?.cases || [];
  const modules = data?.modules || [];
  const fails = cases.filter((item) => item.status === "FAIL").length;
  const success = cases.filter((item) => item.status === "PASS").length;
  const fixed = cases.filter(isCaseFixed).length;
  const blocked = cases.filter(isCaseBlocked).length;
  const other = cases.filter(
    (item) => item.status !== "PASS" && item.status !== "FAIL",
  ).length;
  return { total: cases.length, fails, success, fixed, blocked, other, modules: modules.length };
}

function makeConicGradient(parts) {
  const total = parts.reduce((sum, [, value]) => sum + value, 0);
  if (!total) return "conic-gradient(#e5e7eb 0 100%)";
  let cursor = 0;
  const stops = parts
    .filter(([, value]) => value > 0)
    .map(([color, value]) => {
      const start = cursor;
      cursor += (value / total) * 100;
      return `${color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
    });
  return `conic-gradient(${stops.join(", ")})`;
}

function renderProjectDashboard() {
  const target = document.getElementById("project-dashboard");
  if (!target) return;
  if (!currentAnalysisData) {
    target.innerHTML = `
      <div class="dashboard-empty">
        <i class="fa-solid fa-folder-tree"></i>
        <h3>Aucune analyse chargee</h3>
        <p>Va dans Analyse, choisis un ou plusieurs dossiers, et l'app va scanner tous les fichiers .xml.</p>
        <button class="export-btn" type="button" onclick="showPage('analyse')">
          <i class="fa-solid fa-magnifying-glass-chart"></i> Lancer une analyse
        </button>
      </div>`;
    return;
  }

  const stats = getAnalysisStats(currentAnalysisData);
  const modules = currentAnalysisData.modules || [];
  const openFails = Math.max(stats.fails - stats.fixed - stats.blocked, 0);
  const executed = stats.success + openFails + stats.blocked + stats.fixed + stats.other;
  const healthScore = stats.total
    ? Math.round(((stats.success + stats.fixed) / stats.total) * 100)
    : 0;
  const failRate = stats.total ? Math.round((openFails / stats.total) * 100) : 0;
  const passRate = stats.total ? Math.round((stats.success / stats.total) * 100) : 0;
  const executionRate = stats.total ? Math.round((executed / stats.total) * 100) : 0;
  const statusPie = makeConicGradient([
    ["#22c55e", stats.success],
    ["#ef4444", openFails],
    ["#f59e0b", stats.blocked],
    ["#14b8a6", stats.fixed],
    ["#64748b", stats.other],
  ]);
  const ratePie = makeConicGradient([
    ["#22c55e", stats.success + stats.fixed],
    ["#ef4444", openFails],
    ["#64748b", Math.max(stats.total - stats.success - stats.fixed - openFails, 0)],
  ]);
  const statusSegments = [
    { label: "Succes", value: stats.success, className: "pass" },
    { label: "A corriger", value: openFails, className: "fail" },
    { label: "Bloques", value: stats.blocked, className: "blocked" },
    { label: "Corriges", value: stats.fixed, className: "fixed" },
    { label: "Autres", value: stats.other, className: "other" },
  ];
  const statusBars = statusSegments
    .map((segment) => {
      const pct = stats.total ? Math.round((segment.value / stats.total) * 100) : 0;
      return `
        <div class="qa-status-row">
          <div><span class="status-dot status-dot--${segment.className}"></span>${segment.label}</div>
          <strong>${segment.value}</strong>
          <div class="qa-status-bar"><span class="status-line__bar--${segment.className}" style="width:${pct}%"></span></div>
        </div>`;
    })
    .join("");
  const worstModules = [...modules]
    .map((module) => {
      const moduleCases = (currentAnalysisData.cases || []).filter(
        (item) => item.module_id === module.id,
      );
      const total = moduleCases.length || module.test_count || 0;
      const fixed = moduleCases.filter(isCaseFixed).length;
      const blocked = moduleCases.filter(isCaseBlocked).length;
      const fails = Math.max(
        moduleCases.filter((item) => item.status === "FAIL").length - fixed - blocked,
        0,
      );
      return { name: module.name, fails, total };
    })
    .sort((a, b) => b.fails - a.fails)
    .slice(0, 4)
    .map((module) => `
      <div class="qa-risk-item">
        <span>${escH(module.name)}</span>
        <strong>${module.fails}</strong>
      </div>`)
    .join("");
  const moduleRows = modules
    .map((module) => {
      const moduleCases = (currentAnalysisData.cases || []).filter(
        (item) => item.module_id === module.id,
      );
      const total = moduleCases.length || module.test_count || 0;
      const pass = moduleCases.filter((item) => item.status === "PASS").length;
      const fixed = moduleCases.filter(isCaseFixed).length;
      const blocked = moduleCases.filter(isCaseBlocked).length;
      const fails = Math.max(
        moduleCases.filter((item) => item.status === "FAIL").length - fixed - blocked,
        0,
      );
      const other = moduleCases.filter(
        (item) => item.status !== "PASS" && item.status !== "FAIL",
      ).length;
      const rate = total ? Math.round(((pass + fixed) / total) * 100) : 0;
      const done = pass + fixed + fails + blocked + other;
      const progress = total ? Math.round((done / total) * 100) : 0;
      return `
        <tr>
          <td><strong>${escH(module.name)}</strong><small>${escH(module.source_file || "")}</small></td>
          <td>0</td>
          <td>0</td>
          <td class="status-cell-success">${pass}</td>
          <td class="status-cell-fail">${fails}</td>
          <td class="status-cell-blocked">${blocked}</td>
          <td class="status-cell-other">${other}</td>
          <td><strong>${total}</strong></td>
          <td>
            <div class="mini-progress"><span style="width:${rate}%"></span></div>
            <small>${progress}% execution - ${rate}% success</small>
          </td>
        </tr>`;
    })
    .join("");

  target.innerHTML = `
    <section class="qa-hero">
      <div class="qa-hero__copy">
        <span class="qa-eyebrow">Tableau de bord projet</span>
        <h3>Execution automatisee</h3>
        <p>${stats.total} tests analyses dans ${stats.modules} module${stats.modules > 1 ? "s" : ""}. ${openFails} echec${openFails > 1 ? "s" : ""} ouvert${openFails > 1 ? "s" : ""}, ${stats.blocked} bloque${stats.blocked > 1 ? "s" : ""}.</p>
      </div>
      <div class="qa-score-ring" style="--score:${healthScore}; --score-bg:${ratePie}">
        <strong>${healthScore}%</strong>
        <span>quality</span>
      </div>
      <button class="export-btn" type="button" onclick="showPage('analyse')"><i class="fa-solid fa-table-list"></i> Analyse detaillee</button>
    </section>

    <section class="qa-kpi-grid">
      <article class="qa-kpi qa-kpi--total"><span>Total tests</span><strong>${stats.total}</strong><small>${stats.modules} modules</small></article>
      <article class="qa-kpi qa-kpi--pass"><span>Succes</span><strong>${stats.success}</strong><small>${passRate}% taux de succes</small></article>
      <article class="qa-kpi qa-kpi--fail"><span>A corriger</span><strong>${openFails}</strong><small>${failRate}% taux d'echec</small></article>
      <article class="qa-kpi qa-kpi--blocked"><span>Bloques</span><strong>${stats.blocked}</strong><small>Dependance / attente</small></article>
      <article class="qa-kpi qa-kpi--fixed"><span>Corriges</span><strong>${stats.fixed}</strong><small>Marques manuellement</small></article>
    </section>

    <section class="qa-panels">
      <article class="qa-panel qa-panel--chart">
        <div class="section-head">
          <h3>Statut des tests</h3>
          <span>${executionRate}% execution</span>
        </div>
        <div class="qa-chart-layout">
          <div class="qa-pie" style="background:${statusPie}"><span>${stats.total}</span><small>tests</small></div>
          <div class="chart-legend">${statusSegments.map((item) => `<span><i class="status-dot status-dot--${item.className}"></i>${item.label}<strong>${item.value}</strong></span>`).join("")}</div>
        </div>
      </article>
      <article class="qa-panel">
        <div class="section-head">
          <h3>Avancement par statut</h3>
          <span>${healthScore}% quality</span>
        </div>
        <div class="qa-status-list">${statusBars}</div>
      </article>
      <article class="qa-panel">
        <div class="section-head">
          <h3>Modules a surveiller</h3>
          <span>Echecs ouverts</span>
        </div>
        <div class="qa-risk-list">${worstModules || '<p class="qa-muted">Aucun module en risque.</p>'}</div>
      </article>
    </section>

    <div class="dashboard-table-card inventory-card qa-table-card">
      <div class="section-head">
        <h3>Inventaire des tests par module</h3>
        <span class="inventory-meta">${stats.modules} module${stats.modules > 1 ? "s" : ""} - ${stats.total} tests planifies</span>
      </div>
      <div class="dashboard-table-wrap">
        <table class="dashboard-table inventory-table">
          <thead><tr><th>Module / iteration</th><th>A executer</th><th>En cours</th><th>Succes</th><th>Echec</th><th>Bloque</th><th>Non testable</th><th>Nombre de tests planifies</th><th>Avancement</th></tr></thead>
          <tbody>${moduleRows || '<tr><td colspan="9">Aucun module detecte.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}
