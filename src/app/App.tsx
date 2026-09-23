import { useEffect, useMemo, useState } from "react";
import type { AnalysisData, HistoryRecord, PageId, TestCase, Theme } from "../types/analysis";
import { getAnalysisStats, getCaseKey } from "../utils/analysis";
import { usePersistentState } from "../hooks/usePersistentState";
import { AppHeader } from "../components/layout/AppHeader";
import { Sidebar } from "../components/layout/Sidebar";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { AnalysisPage } from "../features/analysis/AnalysisPage";
import { HistoryPage } from "../features/history/HistoryPage";

const pageCopy: Record<PageId, { title: string; description: string }> = {
  dashboard: { title: "Dashboard projet", description: "Pilotage global des executions Robot Framework." },
  analysis: { title: "Analyse des logs", description: "Import des dossiers, filtres, modules et details d'erreur." },
  history: { title: "Historique", description: "Dernieres analyses sauvegardees localement." },
};

const pageIds: PageId[] = ["dashboard", "analysis", "history"];

function pageFromHash(): PageId {
  const value = window.location.hash.replace(/^#\/?/, "") as PageId;
  return pageIds.includes(value) ? value : "dashboard";
}

export function App() {
  const [page, setPage] = useState<PageId>(pageFromHash);
  const [history, setHistory] = usePersistentState<HistoryRecord[]>("log-analyzer-history-v2", []);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(() => history[0]?.data ?? null);
  const [theme, setTheme] = usePersistentState<Theme>("log-analyzer-theme-v2", "dark");
  const [collapsed, setCollapsed] = usePersistentState("log-analyzer-sidebar-v2", false);
  const [fixedList, setFixedList] = usePersistentState<string[]>("log-analyzer-fixed-v2", []);
  const [blockedList, setBlockedList] = usePersistentState<string[]>("log-analyzer-blocked-v2", []);
  const [clearHistoryOpen, setClearHistoryOpen] = useState(false);
  const fixedKeys = useMemo(() => new Set(fixedList), [fixedList]);
  const blockedKeys = useMemo(() => new Set(blockedList), [blockedList]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    const syncPage = () => setPage(pageFromHash());
    window.addEventListener("hashchange", syncPage);
    return () => window.removeEventListener("hashchange", syncPage);
  }, []);

  function navigate(nextPage: PageId) {
    setPage(nextPage);
    const nextHash = `#${nextPage}`;
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
  }

  function completeAnalysis(data: AnalysisData) {
    setAnalysis(data);
    navigate("analysis");
    const record: HistoryRecord = {
      id: Date.now(),
      createdAt: new Date().toLocaleString("fr-FR"),
      stats: getAnalysisStats(data, fixedKeys, blockedKeys),
      data,
    };
    setHistory((current) => [record, ...current].slice(0, 12));
  }

  function toggleFixed(item: TestCase) {
    if (item.status !== "FAIL") return;
    const key = getCaseKey(item);
    setFixedList((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
    setBlockedList((current) => current.filter((value) => value !== key));
  }

  function toggleBlocked(item: TestCase) {
    if (item.status === "PASS") return;
    const key = getCaseKey(item);
    setBlockedList((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
    setFixedList((current) => current.filter((value) => value !== key));
  }

  return (
    <div className={`app-shell ${collapsed ? "app-shell--collapsed" : ""}`}>
      <Sidebar activePage={page} collapsed={collapsed} onNavigate={navigate} onToggle={() => setCollapsed((value) => !value)} />
      <AppHeader
        title={pageCopy[page].title}
        description={pageCopy[page].description}
        theme={theme}
        showProjectButton={page === "analysis"}
        onProjectButtonClick={() => window.dispatchEvent(new Event("open-project-root-dialog"))}
        onToggleTheme={() => setTheme((value) => value === "dark" ? "light" : "dark")}
      />
      <div className={`app-content app-content--${page}`}>
        {page === "dashboard" ? <DashboardPage data={analysis} fixedKeys={fixedKeys} blockedKeys={blockedKeys} onNewAnalysis={() => navigate("analysis")} /> : null}
        {page === "analysis" ? (
          <AnalysisPage
            data={analysis}
            fixedKeys={fixedKeys}
            blockedKeys={blockedKeys}
            onComplete={completeAnalysis}
            onChangeData={setAnalysis}
            onToggleFixed={toggleFixed}
            onToggleBlocked={toggleBlocked}
          />
        ) : null}
        {page === "history" ? (
          <HistoryPage
            records={history}
            onOpen={(record) => { setAnalysis(record.data); navigate("analysis"); }}
            onRequestClear={() => setClearHistoryOpen(true)}
          />
        ) : null}
      </div>
      <ConfirmDialog
        open={clearHistoryOpen}
        title="Vider l'historique ?"
        message="Toutes les analyses sauvegardees sur cet appareil seront supprimees."
        confirmLabel="Vider historique"
        onCancel={() => setClearHistoryOpen(false)}
        onConfirm={() => { setHistory([]); setClearHistoryOpen(false); }}
      />
    </div>
  );
}
