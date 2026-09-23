import { useEffect, useMemo, useState } from "react";
import { ArrowDownAZ, Ban, CheckCheck, CheckCircle2, ChevronDown, CirclePause, Eraser, Import, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, Play, Search, Tags, TriangleAlert, Wrench, X } from "lucide-react";
import type { AnalysisData, AnalysisModule, RunComparison, SuiteNode, TestCase } from "../../types/analysis";
import { getAnalysisStats, getCaseKey, getStableCaseKey } from "../../utils/analysis";
import { StatusBadge } from "../../components/common/StatusBadge";
import { ModuleTree } from "./ModuleTree";
import { TestDetailDialog } from "./TestDetailDialog";

interface ResultsWorkspaceProps {
  data: AnalysisData;
  fixedKeys: ReadonlySet<string>;
  blockedKeys: ReadonlySet<string>;
  onImport: () => void;
  onRunTests: () => void;
  onRunCase: (item: TestCase) => void;
  onRunSource: (mode: "folder" | "file", targetPath: string) => void;
  runningTests: boolean;
  runningCaseKey: string | null;
  runningSourceKey: string | null;
  caseChanges: Record<string, { before: string; after: string }>;
  comparison: RunComparison | null;
  onToggleFixed: (item: TestCase) => void;
  onToggleBlocked: (item: TestCase) => void;
  onDeleteModule: (module: AnalysisModule) => void;
  onDeleteModules: (modules: AnalysisModule[]) => void;
}

type StatusFilter = "all" | "open" | "pass" | "fixed" | "blocked" | "other";
type SortField = "" | "module" | "case" | "keyword" | "error";

export function ResultsWorkspace(props: ResultsWorkspaceProps) {
  const { data, fixedKeys, blockedKeys } = props;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sortField, setSortField] = useState<SortField>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [activeModule, setActiveModule] = useState<AnalysisModule | null>(null);
  const [activeSuite, setActiveSuite] = useState<SuiteNode | null>(null);
  const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => !window.matchMedia("(max-width: 1180px)").matches,
  );
  const [keywordsModalOpen, setKeywordsModalOpen] = useState(false);
  const [keywordSearch, setKeywordSearch] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);

  const stats = getAnalysisStats(data, fixedKeys, blockedKeys);
  const openFailures = data.cases.filter((item) => {
    const key = getCaseKey(item);
    return item.status === "FAIL" && !fixedKeys.has(key) && !blockedKeys.has(key);
  }).length;
  const keywordGroups = useMemo(() => {
    const counts = new Map<string, number>();
    data.failures.forEach((item) => {
      const parent = item.keyword.split(" > ")[0] || "Keyword inconnu";
      counts.set(parent, (counts.get(parent) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [data.failures]);
  const visibleKeywordGroups = useMemo(() => {
    const query = keywordSearch.trim().toLocaleLowerCase("fr");
    return query ? keywordGroups.filter(([keyword]) => keyword.toLocaleLowerCase("fr").includes(query)) : keywordGroups;
  }, [keywordGroups, keywordSearch]);

  useEffect(() => {
    document.body.classList.toggle("table-focus-open", focusMode);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (keywordsModalOpen) setKeywordsModalOpen(false);
      else setFocusMode(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("table-focus-open");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [focusMode, keywordsModalOpen]);

  const visibleCases = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr");
    const filtered = data.cases.filter((item) => {
      const key = getCaseKey(item);
      const fixed = fixedKeys.has(key);
      const blocked = blockedKeys.has(key);
      const kind = fixed ? "fixed" : blocked ? "blocked" : item.status === "PASS" ? "pass" : item.status === "FAIL" ? "open" : "other";
      const changedRecently = Boolean(props.caseChanges[getStableCaseKey(item)]);
      if (status !== "all" && kind !== status && !changedRecently) return false;
      if (activeModule && item.moduleId !== activeModule.id) return false;
      if (activeSuite && !item.suiteIds.includes(activeSuite.id)) return false;
      if (activeKeyword && item.keyword.split(" > ")[0] !== activeKeyword) return false;
      if (!query) return true;
      return [item.caseName, item.keyword, item.errorMessage, item.moduleName]
        .some((value) => value.toLocaleLowerCase("fr").includes(query));
    });
    if (!sortField) return filtered;
    const fields = { module: "moduleName", case: "caseName", keyword: "keyword", error: "errorMessage" } as const;
    const key = fields[sortField];
    return [...filtered].sort((a, b) => a[key].localeCompare(b[key], "fr", { sensitivity: "base" }) * (sortDirection === "asc" ? 1 : -1));
  }, [activeKeyword, activeModule, activeSuite, blockedKeys, data.cases, fixedKeys, search, sortDirection, sortField, status]);

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setSortField("");
    setSortDirection("asc");
    setActiveModule(null);
    setActiveSuite(null);
    setActiveKeyword(null);
  }

  function closeMobileSidebar() {
    if (window.matchMedia("(max-width: 1180px)").matches) setSidebarOpen(false);
  }

  const selectedKey = selectedCase ? getCaseKey(selectedCase) : "";

  return (
    <section className={`results-page ${focusMode ? "results-page--focus" : ""}`}>
      <header className="results-summary">
        <div><h2>Resultats de l'analyse</h2><p>Tests, modules et messages d'execution.</p></div>
        <div className="summary-actions">
          <button className="button button--secondary" type="button" onClick={props.onRunTests}>
            <Wrench size={16} /> Dossier projet
          </button>
          <button className="button button--secondary" type="button" onClick={props.onImport}><Import size={16} /> Importer</button>
          <SummaryPill kind="fail" icon={<TriangleAlert size={15} />} value={openFailures} label="Echecs" />
          <SummaryPill kind="blocked" icon={<Ban size={15} />} value={stats.blocked} label="Bloques" />
          <SummaryPill kind="fixed" icon={<Wrench size={15} />} value={stats.fixed} label="Corriges" />
          <SummaryPill kind="pass" icon={<CheckCircle2 size={15} />} value={stats.success} label="Succes" />
          <span className="summary-pill summary-pill--neutral">{stats.total} tests - {stats.modules} modules</span>
        </div>
      </header>
      <div className={`results-layout ${sidebarOpen ? "" : "results-layout--no-sidebar"}`}>
        {sidebarOpen ? (
          <ModuleTree
            modules={data.modules}
            failureCount={openFailures}
            activeModuleId={activeModule?.id || null}
            activeSuiteId={activeSuite?.id || null}
            onSelectAll={() => { setActiveModule(null); setActiveSuite(null); closeMobileSidebar(); }}
            onSelectModule={(module) => { setActiveModule(module); setActiveSuite(null); closeMobileSidebar(); }}
            onSelectSuite={(module, suite) => { setActiveModule(module); setActiveSuite(suite); closeMobileSidebar(); }}
            onRunSource={props.onRunSource}
            runningSourceKey={props.runningSourceKey}
            running={props.runningTests}
            onDeleteModule={props.onDeleteModule}
            onDeleteModules={props.onDeleteModules}
            onClose={() => setSidebarOpen(false)}
          />
        ) : null}
        <main className="results-main">
          <div className="filters-toolbar">
            <div className="toolbar-primary" role="group" aria-label="Options d'affichage">
              <button
                className={`icon-button ${focusMode ? "active" : ""}`}
                type="button"
                onClick={() => setFocusMode((value) => !value)}
                aria-label={focusMode ? "Quitter le mode focus" : "Afficher la table en mode focus"}
                title={focusMode ? "Quitter le mode focus" : "Table focus"}
              >
                {focusMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              <button
                className={`icon-button ${sidebarOpen ? "active" : ""}`}
                type="button"
                onClick={() => setSidebarOpen((value) => !value)}
                aria-label={sidebarOpen ? "Masquer les modules" : "Afficher les modules"}
                title={sidebarOpen ? "Masquer les modules" : "Afficher les modules"}
              >
                {sidebarOpen ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}
              </button>
              <button
                className={`icon-button ${keywordsModalOpen || activeKeyword ? "active" : ""}`}
                type="button"
                onClick={() => { setKeywordSearch(""); setKeywordsModalOpen(true); }}
                aria-label="Afficher les keywords"
                title="Afficher les keywords"
              >
                <Tags size={18} />
              </button>
            </div>
            <label className="search-field"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un cas, keyword, erreur..." /></label>
            <div className="toolbar-controls">
              <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} aria-label="Filtrer par statut">
                <option value="all">Tous</option><option value="open">Echecs ouverts</option><option value="pass">Succes</option>
                <option value="fixed">Corriges</option><option value="blocked">Bloques</option><option value="other">Autres</option>
              </select>
              <select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)} aria-label="Champ de tri">
                <option value="">Aucun tri</option><option value="module">Module</option><option value="case">Cas de test</option>
                <option value="keyword">Keyword</option><option value="error">Message</option>
              </select>
              <button className="icon-button toolbar-action" type="button" onClick={() => setSortDirection((value) => value === "asc" ? "desc" : "asc")} aria-label={`Tri ${sortDirection === "asc" ? "A-Z" : "Z-A"}`} title={`Tri ${sortDirection === "asc" ? "A-Z" : "Z-A"}`}>
                <ArrowDownAZ size={17} />
              </button>
              <button className="icon-button toolbar-action" type="button" onClick={clearFilters} aria-label="Annuler les filtres et le tri" title="Annuler les filtres et le tri"><Eraser size={17} /></button>
              <span className="result-count" title={`${visibleCases.length} resultats`}><strong>{visibleCases.length}</strong><span> resultats</span></span>
            </div>
          </div>

          <CasesTable
            cases={visibleCases}
            fixedKeys={fixedKeys}
            blockedKeys={blockedKeys}
            caseChanges={props.caseChanges}
            runningCaseKey={props.runningCaseKey}
            runningTests={props.runningTests}
            onSelect={setSelectedCase}
            onRunCase={props.onRunCase}
            onToggleFixed={props.onToggleFixed}
            onToggleBlocked={props.onToggleBlocked}
          />
        </main>
      </div>

      {keywordsModalOpen ? (
        <div className="keywords-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setKeywordsModalOpen(false);
        }}>
          <section className="keywords-modal" role="dialog" aria-modal="true" aria-labelledby="keywords-modal-title">
            <header className="keywords-modal__header">
              <div>
                <span className="keywords-modal__icon"><Tags size={20} /></span>
                <div><h2 id="keywords-modal-title">Keywords en echec</h2><p>{keywordGroups.length} groupes trouves</p></div>
              </div>
              <button className="icon-button" type="button" onClick={() => setKeywordsModalOpen(false)} aria-label="Fermer" title="Fermer"><X size={20} /></button>
            </header>
            <div className="keywords-modal__tools">
              <label className="keywords-modal__search"><Search size={17} /><input autoFocus value={keywordSearch} onChange={(event) => setKeywordSearch(event.target.value)} placeholder="Rechercher un keyword..." /></label>
              <span><strong>{visibleKeywordGroups.length}</strong> affiches</span>
            </div>
            <div className="keywords-modal__list">
              {visibleKeywordGroups.map(([keyword, count]) => <KeywordOption key={keyword} keyword={keyword} count={count} active={activeKeyword === keyword} onSelect={() => {
                setActiveKeyword(activeKeyword === keyword ? null : keyword);
                setKeywordsModalOpen(false);
              }} />)}
              {!visibleKeywordGroups.length ? <div className="keywords-modal__empty"><Tags size={22} /><span>Aucun keyword trouve.</span></div> : null}
            </div>
            <footer className="keywords-modal__footer">
              <span>{activeKeyword ? "1 filtre actif" : "Aucun filtre actif"}</span>
              <button className="button button--secondary" type="button" disabled={!activeKeyword} onClick={() => {
                setActiveKeyword(null);
                setKeywordsModalOpen(false);
              }}>Afficher tous les tests</button>
            </footer>
          </section>
        </div>
      ) : null}

      <TestDetailDialog
        item={selectedCase}
        fixed={fixedKeys.has(selectedKey)}
        blocked={blockedKeys.has(selectedKey)}
        onClose={() => setSelectedCase(null)}
        onToggleFixed={() => selectedCase && props.onToggleFixed(selectedCase)}
        onToggleBlocked={() => selectedCase && props.onToggleBlocked(selectedCase)}
      />
    </section>
  );
}

function KeywordOption({ keyword, count, active, onSelect }: { keyword: string; count: number; active: boolean; onSelect: () => void }) {
  const separator = keyword.indexOf(".");
  const scope = separator > 0 ? keyword.slice(0, separator) : "";
  const action = separator > 0 ? keyword.slice(separator + 1) : keyword;
  return (
    <button className={`keyword-option ${active ? "active" : ""}`} type="button" aria-pressed={active} title={keyword} onClick={onSelect}>
      <small className="keyword-option__scope">{scope || "General"}</small>
      <span className="keyword-option__name">{action}</span>
      <strong className="keyword-option__count">{count}</strong>
    </button>
  );
}

function SummaryPill({ kind, icon, value, label }: { kind: string; icon: React.ReactNode; value: number; label: string }) {
  return <span className={`summary-pill summary-pill--${kind}`}>{icon}<strong>{value}</strong> {label}</span>;
}

interface CasesTableProps {
  cases: TestCase[];
  fixedKeys: ReadonlySet<string>;
  blockedKeys: ReadonlySet<string>;
  caseChanges: Record<string, { before: string; after: string }>;
  runningCaseKey: string | null;
  runningTests: boolean;
  onSelect: (item: TestCase) => void;
  onRunCase: (item: TestCase) => void;
  onToggleFixed: (item: TestCase) => void;
  onToggleBlocked: (item: TestCase) => void;
}

function CasesTable(props: CasesTableProps) {
  if (!props.cases.length) return <div className="empty-results"><Search size={24} /><strong>Aucun resultat</strong><span>Modifiez les filtres pour retrouver vos tests.</span></div>;
  return (
    <>
      <div className="cases-table-wrap">
        <table className="data-table cases-table">
          <colgroup><col className="case-col-status" /><col className="case-col-name" /><col className="case-col-keyword" /><col className="case-col-message" /><col className="case-col-actions" /></colgroup>
          <thead><tr><th scope="col">Statut</th><th scope="col">Cas de test</th><th scope="col">Keyword</th><th scope="col">Message</th><th scope="col">Actions</th></tr></thead>
          <tbody>{props.cases.map((item) => <CaseRow key={item.id} item={item} {...props} />)}</tbody>
        </table>
      </div>
      <div className="mobile-cases">
        {props.cases.map((item) => {
          const key = getCaseKey(item);
          const fixed = props.fixedKeys.has(key);
          const blocked = props.blockedKeys.has(key);
          const change = props.caseChanges[getStableCaseKey(item)];
          return (
            <article className="mobile-case" key={item.id} onClick={() => props.onSelect(item)}>
              <div className="mobile-case__heading"><StatusBadge item={item} fixed={fixed} blocked={blocked} /><span className="tag">{item.moduleName}</span></div>
              <h3>{item.caseName}</h3><small>{item.suitePath.slice(1).map((suite) => suite.name).join(" > ") || "Suite non disponible"}</small>
              <KeywordPath keyword={item.keyword} failed={item.status === "FAIL"} />
              {change ? <CaseChangeBadge change={change} /> : null}
              <p>{item.status === "PASS" ? "Test passe avec succes." : item.errorMessage || `Statut ${item.status}`}</p>
              <CaseActions item={item} fixed={fixed} blocked={blocked} running={props.runningCaseKey === getStableCaseKey(item)} disabled={props.runningTests} onRunCase={props.onRunCase} onToggleFixed={props.onToggleFixed} onToggleBlocked={props.onToggleBlocked} />
            </article>
          );
        })}
      </div>
    </>
  );
}

function CaseRow({
  item,
  fixedKeys,
  blockedKeys,
  caseChanges,
  runningCaseKey,
  runningTests,
  onSelect,
  onRunCase,
  onToggleFixed,
  onToggleBlocked,
}: CasesTableProps & { item: TestCase }) {
  const key = getCaseKey(item);
  const fixed = fixedKeys.has(key);
  const blocked = blockedKeys.has(key);
  const message = item.status === "PASS" ? "Test passe avec succes." : item.errorMessage || `Statut ${item.status}`;
  const stableKey = getStableCaseKey(item);
  const change = caseChanges[stableKey];
  const running = runningCaseKey === stableKey;
  const suite = item.suitePath.slice(1).map((entry) => entry.name).join(" > ") || "Suite non disponible";
  const tone = fixed ? "fixed" : blocked ? "blocked" : item.status === "PASS" ? "pass" : item.status === "FAIL" ? "fail" : "other";
  return (
    <tr className={`case-row case-row--${tone} ${change ? "case-row--changed" : ""}`} onClick={() => onSelect(item)}>
      <td className="case-status-cell"><StatusBadge item={item} fixed={fixed} blocked={blocked} /></td>
      <td className="case-name-cell">
        <strong className="case-identity__name" title={item.caseName}>{item.caseName}</strong>
        <div className="case-identity__meta">
          <span className="case-identity__module" title={item.moduleName}>{item.moduleName}</span>
          <span className="case-identity__suite" title={suite}>{suite}</span>
        </div>
        {change ? <CaseChangeBadge change={change} /> : null}
      </td>
      <td className="case-keyword-cell"><KeywordPath keyword={item.keyword} failed={item.status === "FAIL"} /></td>
      <td className="case-message-cell"><div className={`case-message case-message--${tone}`} title={message}>{message}</div></td>
      <td className="case-actions-cell"><CaseActions item={item} fixed={fixed} blocked={blocked} running={running} disabled={runningTests} onRunCase={onRunCase} onToggleFixed={onToggleFixed} onToggleBlocked={onToggleBlocked} /></td>
    </tr>
  );
}

function CaseChangeBadge({ change }: { change: { before: string; after: string } }) {
  const resolved = change.before === "FAIL" && change.after === "PASS";
  return (
    <span className={`case-change-badge ${resolved ? "case-change-badge--resolved" : ""}`}>
      {resolved ? "Corrige apres relance" : "Statut change"}: {change.before} &gt; {change.after}
    </span>
  );
}

function KeywordPath({ keyword, failed }: { keyword: string; failed: boolean }) {
  const steps = keyword.split(" > ").map((step) => step.trim()).filter(Boolean);
  const visibleSteps = steps.length > 2 ? [steps[0], steps[steps.length - 1]] : steps;
  const hiddenSteps = steps.length - visibleSteps.length;
  return (
    <div className="keyword-path" title={keyword}>
      {visibleSteps.map((step, index) => {
        const isFailure = failed && index === visibleSteps.length - 1;
        return (
          <div className="keyword-path__item" key={`${step}-${index}`}>
            {index ? <span className="keyword-path__connector"><ChevronDown size={13} aria-hidden="true" />{hiddenSteps ? `+${hiddenSteps}` : null}</span> : null}
            <code className={`keyword-step ${isFailure ? "keyword-step--failure" : "keyword-step--context"}`}>{step}</code>
          </div>
        );
      })}
    </div>
  );
}

function CaseActions({ item, fixed, blocked, running, disabled, onRunCase, onToggleFixed, onToggleBlocked }: {
  item: TestCase;
  fixed: boolean;
  blocked: boolean;
  running: boolean;
  disabled: boolean;
  onRunCase: (item: TestCase) => void;
  onToggleFixed: (item: TestCase) => void;
  onToggleBlocked: (item: TestCase) => void;
}) {
  return (
    <div className="case-actions" onClick={(event) => event.stopPropagation()}>
      <button className={`icon-button case-action case-action--run ${running ? "active" : ""}`} type="button" disabled={disabled} onClick={() => onRunCase(item)} title={running ? "Execution en cours" : "Lancer ce test"} aria-label={running ? "Execution en cours" : "Lancer ce test"}>{running ? <span className="button-spinner" /> : <Play size={16} />}</button>
      {item.status === "FAIL" ? <button className={`icon-button case-action case-action--fix ${fixed ? "active" : ""}`} type="button" onClick={() => onToggleFixed(item)} title={fixed ? "Annuler correction" : "Marquer corrige"} aria-label={fixed ? "Annuler correction" : "Marquer corrige"}><CheckCheck size={17} /></button> : null}
      <button className={`icon-button case-action case-action--block ${blocked ? "active" : ""}`} type="button" onClick={() => onToggleBlocked(item)} title={blocked ? "Debloquer" : "Marquer bloque"} aria-label={blocked ? "Debloquer" : "Marquer bloque"}><CirclePause size={17} /></button>
    </div>
  );
}
