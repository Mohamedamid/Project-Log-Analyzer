import { Ban, ChartNoAxesCombined, CheckCircle2, FolderTree } from "lucide-react";
import { Layers3, Plus, TriangleAlert, Wrench } from "lucide-react";
import type { AnalysisData, AnalysisModule, AnalysisStats } from "../../types/analysis";
import { getAnalysisStats, getCaseKey } from "../../utils/analysis";

interface DashboardPageProps {
  data: AnalysisData | null;
  fixedKeys: ReadonlySet<string>;
  blockedKeys: ReadonlySet<string>;
  onNewAnalysis: () => void;
}

interface ModuleMetrics {
  pass: number;
  failures: number;
  blocked: number;
  fixed: number;
  other: number;
  total: number;
}

function metricsForModule(
  data: AnalysisData,
  module: AnalysisModule,
  fixedKeys: ReadonlySet<string>,
  blockedKeys: ReadonlySet<string>,
): ModuleMetrics {
  const cases = data.cases.filter((item) => item.moduleId === module.id);
  const fixed = cases.filter((item) => item.status === "FAIL" && fixedKeys.has(getCaseKey(item))).length;
  const blocked = cases.filter((item) => blockedKeys.has(getCaseKey(item))).length;
  return {
    pass: cases.filter((item) => item.status === "PASS").length,
    failures: cases.filter((item) => {
      const key = getCaseKey(item);
      return item.status === "FAIL" && !fixedKeys.has(key) && !blockedKeys.has(key);
    }).length,
    blocked,
    fixed,
    other: cases.filter((item) => item.status !== "PASS" && item.status !== "FAIL").length,
    total: cases.length || module.testCount,
  };
}

export function DashboardPage({ data, fixedKeys, blockedKeys, onNewAnalysis }: DashboardPageProps) {
  if (!data) {
    return (
      <section className="page dashboard-page dashboard-page--empty">
        <div className="page-heading">
          <div><h2>Dashboard projet</h2><p>Vue globale du dernier scan charge.</p></div>
          <button className="button button--secondary" type="button" onClick={onNewAnalysis}>
            <Plus size={17} /> Nouvelle analyse
          </button>
        </div>
        <div className="empty-state">
          <span className="empty-state__icon"><FolderTree size={30} /></span>
          <h3>Aucune analyse chargee</h3>
          <p>Importe un ou plusieurs rapports Robot Framework pour afficher les indicateurs.</p>
          <button className="button button--primary" type="button" onClick={onNewAnalysis}>
            <ChartNoAxesCombined size={18} /> Lancer une analyse
          </button>
        </div>
      </section>
    );
  }

  const stats = getAnalysisStats(data, fixedKeys, blockedKeys);
  const openFailures = data.cases.filter((item) => {
    const key = getCaseKey(item);
    return item.status === "FAIL" && !fixedKeys.has(key) && !blockedKeys.has(key);
  }).length;
  const successRate = stats.total ? Math.round(((stats.success + stats.fixed) / stats.total) * 100) : 0;
  const failureRate = stats.total ? Math.round((openFailures / stats.total) * 100) : 0;
  const statusItems = [
    { label: "Succes", value: stats.success, className: "pass" },
    { label: "A corriger", value: openFailures, className: "fail" },
    { label: "Bloques", value: stats.blocked, className: "blocked" },
    { label: "Corriges", value: stats.fixed, className: "fixed" },
    { label: "Autres", value: stats.other, className: "other" },
  ];
  const parts = statusItems.map((item) => item.value);
  let cursor = 0;
  const colors = ["#22c55e", "#f04444", "#f59e0b", "#14b8a6", "#64748b"];
  const gradient = `conic-gradient(${parts.map((value, index) => {
    const start = cursor;
    cursor += stats.total ? (value / stats.total) * 100 : 0;
    return `${colors[index]} ${start}% ${cursor}%`;
  }).join(", ")})`;
  const risks = data.modules
    .map((module) => ({ module, failures: metricsForModule(data, module, fixedKeys, blockedKeys).failures }))
    .filter((item) => item.failures > 0)
    .sort((a, b) => b.failures - a.failures)
    .slice(0, 4);

  return (
    <section className="page dashboard-page dashboard-page--loaded">
      <div className="dashboard-content">
        <KpiGrid stats={stats} openFailures={openFailures} successRate={successRate} failureRate={failureRate} />
        <section className="dashboard-overview">
          <article className="panel status-panel">
            <div className="section-heading status-panel__heading">
              <h3>Statut & avancement</h3>
              <div className="status-panel__summary">
                <span><strong>100%</strong> execution</span>
                <span><strong>{successRate}%</strong> qualite</span>
              </div>
            </div>
            <div className="status-overview">
              <div className="donut" style={{ background: gradient }} aria-label={`${stats.total} tests au total`}>
                <div className="donut__center"><span>{stats.total}</span><small>tests</small></div>
              </div>
              <div className="status-legend">
                {statusItems.map((item) => <StatusRow key={item.label} {...item} total={stats.total} />)}
              </div>
            </div>
          </article>
          <article className="panel risk-panel">
            <div className="section-heading"><h3>Modules a surveiller</h3><span>Echecs ouverts</span></div>
            <div className="risk-list">
              {risks.map(({ module, failures }) => (
                <div className="risk-row" key={module.id}><strong>{module.name}</strong><span>{failures}</span></div>
              ))}
              {!risks.length ? <p className="risk-list__empty"><CheckCircle2 size={18} /> Aucun echec ouvert</p> : null}
            </div>
          </article>
        </section>
        <ModuleInventory data={data} fixedKeys={fixedKeys} blockedKeys={blockedKeys} />
      </div>
    </section>
  );
}

function KpiGrid({
  stats,
  openFailures,
  successRate,
  failureRate,
}: {
  stats: AnalysisStats;
  openFailures: number;
  successRate: number;
  failureRate: number;
}) {
  const items = [
    { label: "Total tests", value: stats.total, detail: `${stats.modules} modules`, kind: "total", icon: Layers3 },
    { label: "Succes", value: stats.success, detail: `${successRate}% taux de succes`, kind: "pass", icon: CheckCircle2 },
    { label: "A corriger", value: openFailures, detail: `${failureRate}% taux d'echec`, kind: "fail", icon: TriangleAlert },
    { label: "Bloques", value: stats.blocked, detail: "Dependance / attente", kind: "blocked", icon: Ban },
    { label: "Corriges", value: stats.fixed, detail: "Marques manuellement", kind: "fixed", icon: Wrench },
  ];
  return (
    <section className="kpi-grid" aria-label="Indicateurs du projet">
      {items.map(({ label, value, detail, kind, icon: Icon }) => (
        <article className={`kpi kpi--${kind}`} key={label}>
          <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
          <i><Icon size={20} /></i>
        </article>
      ))}
    </section>
  );
}

function StatusRow({ label, value, className, total }: { label: string; value: number; className: string; total: number }) {
  const width = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="status-row">
      <span className="status-row__label"><i className={`dot dot--${className}`} />{label}</span>
      <strong className="status-row__value">{value}<small>{width}%</small></strong>
      <div className="progress"><i className={`progress__bar progress__bar--${className}`} style={{ width: `${width}%` }} /></div>
    </div>
  );
}

function ModuleInventory({
  data,
  fixedKeys,
  blockedKeys,
}: {
  data: AnalysisData;
  fixedKeys: ReadonlySet<string>;
  blockedKeys: ReadonlySet<string>;
}) {
  return (
    <article className="inventory-panel">
      <div className="section-heading inventory-panel__heading">
        <h3>Inventaire des tests par module</h3>
        <span>{data.modules.length} modules - {data.cases.length} tests planifies</span>
      </div>
      <div className="table-scroll">
        <table className="data-table inventory-table">
          <thead>
            <tr>
              <th>Module / iteration</th><th>A executer</th><th>En cours</th><th>Succes</th>
              <th>Echec</th><th>Bloque</th><th>Non testable</th><th>Tests planifies</th><th>Avancement</th>
            </tr>
          </thead>
          <tbody>
            {data.modules.map((module) => {
              const metrics = metricsForModule(data, module, fixedKeys, blockedKeys);
              const completed = metrics.pass + metrics.failures + metrics.blocked + metrics.fixed + metrics.other;
              const execution = metrics.total ? Math.round((completed / metrics.total) * 100) : 0;
              const quality = metrics.total ? Math.round(((metrics.pass + metrics.fixed) / metrics.total) * 100) : 0;
              return (
                <tr key={module.id}>
                  <td><strong>{module.name}</strong><small>{module.sourceFile}</small></td>
                  <td>0</td><td>0</td><td className="number-pass">{metrics.pass}</td>
                  <td className="number-fail">{metrics.failures}</td>
                  <td className="number-blocked">{metrics.blocked}</td>
                  <td>{metrics.other}</td><td><strong>{metrics.total}</strong></td>
                  <td>
                    <div className="progress progress--wide"><i className="progress__bar progress__bar--mixed" style={{ width: `${quality}%` }} /></div>
                    <small>{execution}% execution - {quality}% succes</small>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}
