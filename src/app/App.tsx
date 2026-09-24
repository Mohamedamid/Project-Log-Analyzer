import { useEffect, useMemo, useState } from "react";
import type { AnalysisData, HistoryRecord, PageId, TestCase, Theme } from "../types/analysis";
import { getAnalysisStats, getCaseKey, normalizeAnalysisData } from "../utils/analysis";
import { clearCurrentAnalysis, loadCurrentAnalysis, saveCurrentAnalysis } from "../utils/indexedDb";
import { usePersistentState } from "../hooks/usePersistentState";
import { AppHeader } from "../components/layout/AppHeader";
import { Sidebar } from "../components/layout/Sidebar";
import { SweetAlert, type SweetAlertTone } from "../components/common/SweetAlert";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { AnalysisPage } from "../features/analysis/AnalysisPage";
import { HistoryPage } from "../features/history/HistoryPage";

const pageCopy: Record<PageId, { title: string; description: string }> = {
  dashboard: { title: "Dashboard projet", description: "Pilotage global des executions Robot Framework." },
  analysis: { title: "Analyse des logs", description: "Import des dossiers, filtres, modules et details d'erreur." },
  history: { title: "Historique", description: "Dernieres analyses sauvegardees localement." },
};

const pageIds: PageId[] = ["dashboard", "analysis", "history"];
const appStoragePrefix = "log-analyzer-";

type SweetAlertState = {
  tone: SweetAlertTone;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
};

function pageFromHash(): PageId {
  const value = window.location.hash.replace(/^#\/?/, "") as PageId;
  return pageIds.includes(value) ? value : "dashboard";
}

function clearAppLocalStorage() {
  Object.keys(localStorage)
    .filter((key) => key.startsWith(appStoragePrefix))
    .forEach((key) => localStorage.removeItem(key));
}

export function App() {
  const [page, setPage] = useState<PageId>(pageFromHash);
  const [history, setHistory] = usePersistentState<HistoryRecord[]>("log-analyzer-history-v2", []);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(() => normalizeAnalysisData(history[0]?.data));
  const [theme, setTheme] = usePersistentState<Theme>("log-analyzer-theme-v2", "dark");
  const [collapsed, setCollapsed] = usePersistentState("log-analyzer-sidebar-v2", false);
  const [fixedList, setFixedList] = usePersistentState<string[]>("log-analyzer-fixed-v2", []);
  const [blockedList, setBlockedList] = usePersistentState<string[]>("log-analyzer-blocked-v2", []);
  const [clearHistoryOpen, setClearHistoryOpen] = useState(false);
  const [clearStorageOpen, setClearStorageOpen] = useState(false);
  const [sweetAlert, setSweetAlert] = useState<SweetAlertState | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const fixedKeys = useMemo(() => new Set(fixedList), [fixedList]);
  const blockedKeys = useMemo(() => new Set(blockedList), [blockedList]);

  useEffect(() => {
    let active = true;
    void loadCurrentAnalysis<AnalysisData>().then((stored) => {
      if (!active || !stored) return;
      setAnalysis(normalizeAnalysisData(stored));
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    const syncPage = () => setPage(pageFromHash());
    window.addEventListener("hashchange", syncPage);
    return () => window.removeEventListener("hashchange", syncPage);
  }, []);

  useEffect(() => {
    const syncFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    syncFullscreen();
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  function navigate(nextPage: PageId) {
    setPage(nextPage);
    const nextHash = `#${nextPage}`;
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
  }

  function updateCurrentAnalysis(data: AnalysisData | null) {
    const normalizedData = normalizeAnalysisData(data);
    setAnalysis(normalizedData);
    if (normalizedData) void saveCurrentAnalysis(normalizedData);
    else void clearCurrentAnalysis();
  }

  function clearStoredData() {
    clearAppLocalStorage();
    void clearCurrentAnalysis();
    setHistory([]);
    setFixedList([]);
    setBlockedList([]);
    setCollapsed(false);
    updateCurrentAnalysis(null);
    navigate("dashboard");
    setClearStorageOpen(false);
    setTimeout(clearAppLocalStorage, 0);
    setSweetAlert({
      tone: "success",
      title: "Donnees locales nettoyees",
      message: "L'analyse courante, l'historique, les marquages et la configuration locale ont ete supprimes de ce navigateur.",
    });
  }

  function completeAnalysis(data: AnalysisData) {
    const normalizedData = normalizeAnalysisData(data) || data;
    updateCurrentAnalysis(normalizedData);
    navigate("analysis");
    const record: HistoryRecord = {
      id: Date.now(),
      createdAt: new Date().toLocaleString("fr-FR"),
      stats: getAnalysisStats(normalizedData, fixedKeys, blockedKeys),
      data: normalizedData,
    };
    setHistory((current) => [record, ...current].slice(0, 12));
  }

  function changeAnalysis(data: AnalysisData) {
    const normalizedData = normalizeAnalysisData(data) || data;
    updateCurrentAnalysis(normalizedData);
  }

  function toggleFixed(item: TestCase) {
    if (item.status !== "FAIL") return;
    const key = getCaseKey(item);
    const wasFixed = fixedList.includes(key);
    setSweetAlert({
      tone: "warning",
      title: wasFixed ? "Annuler la correction ?" : "Marquer ce cas corrige ?",
      message: wasFixed ? `${item.caseName} ne sera plus marque comme corrige.` : `${item.caseName} sera marque comme corrige.`,
      confirmLabel: "Oui",
      cancelLabel: "Non",
      onConfirm: () => {
        setFixedList((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
        setBlockedList((current) => current.filter((value) => value !== key));
        setSweetAlert({
          tone: wasFixed ? "info" : "success",
          title: wasFixed ? "Correction annulee" : "Cas marque corrige",
          message: wasFixed ? `${item.caseName} n'est plus marque comme corrige.` : `${item.caseName} est marque comme corrige.`,
        });
      },
    });
  }

  function toggleBlocked(item: TestCase) {
    if (item.status === "PASS") return;
    const key = getCaseKey(item);
    const wasBlocked = blockedList.includes(key);
    setSweetAlert({
      tone: "warning",
      title: wasBlocked ? "Debloquer ce cas ?" : "Marquer ce cas bloque ?",
      message: wasBlocked ? `${item.caseName} ne sera plus marque comme bloque.` : `${item.caseName} sera marque comme bloque.`,
      confirmLabel: "Oui",
      cancelLabel: "Non",
      onConfirm: () => {
        setBlockedList((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
        setFixedList((current) => current.filter((value) => value !== key));
        setSweetAlert({
          tone: wasBlocked ? "info" : "success",
          title: wasBlocked ? "Cas debloque" : "Cas marque bloque",
          message: wasBlocked ? `${item.caseName} n'est plus marque comme bloque.` : `${item.caseName} est marque comme bloque.`,
        });
      },
    });
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setSweetAlert({
        tone: "error",
        title: "Plein ecran indisponible",
        message: "Le navigateur n'a pas autorise le mode plein ecran.",
      });
    }
  }

  return (
    <div className={`app-shell ${collapsed ? "app-shell--collapsed" : ""}`}>
      <Sidebar activePage={page} collapsed={collapsed} onNavigate={navigate} onToggle={() => setCollapsed((value) => !value)} />
      <AppHeader
        title={pageCopy[page].title}
        description={pageCopy[page].description}
        theme={theme}
        showProjectButton={page === "analysis"}
        fullscreen={fullscreen}
        onProjectButtonClick={() => window.dispatchEvent(new Event("open-project-root-dialog"))}
        onClearStorage={() => setClearStorageOpen(true)}
        onToggleFullscreen={toggleFullscreen}
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
            onChangeData={changeAnalysis}
            onToggleFixed={toggleFixed}
            onToggleBlocked={toggleBlocked}
          />
        ) : null}
        {page === "history" ? (
          <HistoryPage
            records={history}
            onOpen={(record) => { updateCurrentAnalysis(record.data); navigate("analysis"); }}
            onRequestClear={() => setClearHistoryOpen(true)}
          />
        ) : null}
      </div>
      <SweetAlert
        open={clearHistoryOpen}
        tone="warning"
        title="Vider l'historique ?"
        message="Toutes les analyses sauvegardees sur cet appareil seront supprimees."
        confirmLabel="Oui"
        cancelLabel="Non"
        onClose={() => setClearHistoryOpen(false)}
        onConfirm={() => { setHistory([]); updateCurrentAnalysis(null); setClearHistoryOpen(false); }}
      />
      <SweetAlert
        open={clearStorageOpen}
        tone="warning"
        title="Nettoyer les donnees locales ?"
        message="Cela supprime l'analyse courante, l'historique, les marquages corrige/bloque et la configuration locale de ce navigateur."
        confirmLabel="Oui"
        cancelLabel="Non"
        onClose={() => setClearStorageOpen(false)}
        onConfirm={clearStoredData}
      />
      <SweetAlert
        open={Boolean(sweetAlert)}
        tone={sweetAlert?.tone}
        title={sweetAlert?.title || ""}
        message={sweetAlert?.message || ""}
        confirmLabel={sweetAlert?.confirmLabel}
        cancelLabel={sweetAlert?.cancelLabel}
        onConfirm={sweetAlert?.onConfirm}
        onClose={() => setSweetAlert(null)}
      />
    </div>
  );
}
