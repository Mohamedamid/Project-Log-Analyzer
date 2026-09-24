import { useEffect, useState } from "react";
import { Play, Settings, X } from "lucide-react";
import type { AnalysisData, AnalysisModule, FileWithPath, RunComparison, TestCase } from "../../types/analysis";
import { analyzeReportFiles } from "../../services/robotParser";
import { isReportFile } from "../../services/fileCollection";
import { compareAnalyses, fileDisplayPath, getStableCaseKey, mergeRunData, mergeSingleCaseRun } from "../../utils/analysis";
import { usePersistentState } from "../../hooks/usePersistentState";
import { buildCaseRunConfig, buildSourceRunConfig, cancelLocalTests, defaultRunnerConfig, reportsToFiles, runLocalTests, type TestRunnerConfig } from "../../services/testRunner";
import { SweetAlert, type SweetAlertTone } from "../../components/common/SweetAlert";
import { ImportPanel, uniqueReportFiles } from "./ImportPanel";
import { ResultsWorkspace } from "./ResultsWorkspace";

interface AnalysisPageProps {
  data: AnalysisData | null;
  fixedKeys: ReadonlySet<string>;
  blockedKeys: ReadonlySet<string>;
  onComplete: (data: AnalysisData) => void;
  onChangeData: (data: AnalysisData) => void;
  onToggleFixed: (item: TestCase) => void;
  onToggleBlocked: (item: TestCase) => void;
}

type SweetAlertState = {
  tone: SweetAlertTone;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
};

export function AnalysisPage(props: AnalysisPageProps) {
  const [reportFiles, setReportFiles] = useState<FileWithPath[]>([]);
  const [allFiles, setAllFiles] = useState<FileWithPath[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [modulesToDelete, setModulesToDelete] = useState<AnalysisModule[]>([]);
  const [runnerOpen, setRunnerOpen] = useState(false);
  const [runningTests, setRunningTests] = useState(false);
  const [comparison, setComparison] = usePersistentState<RunComparison | null>("log-analyzer-last-comparison-v2", null);
  const [runningCaseKey, setRunningCaseKey] = useState<string | null>(null);
  const [runningSourceKey, setRunningSourceKey] = useState<string | null>(null);
  const [caseChanges, setCaseChanges] = usePersistentState<Record<string, { before: string; after: string }>>("log-analyzer-case-changes-v2", {});
  const [sweetAlert, setSweetAlert] = useState<SweetAlertState | null>(null);
  const [runnerConfig, setRunnerConfig] = usePersistentState<TestRunnerConfig>("log-analyzer-runner-config-v1", defaultRunnerConfig);
  const effectiveRunnerConfig: TestRunnerConfig = {
    ...defaultRunnerConfig,
    ...runnerConfig,
    projectRoot: runnerConfig.projectRoot || runnerConfig.targetPath || "",
    reportPaths: runnerConfig.reportPaths?.length ? runnerConfig.reportPaths : defaultRunnerConfig.reportPaths,
  };

  useEffect(() => {
    if (!props.data) return;
    const onDragEnter = (event: DragEvent) => {
      if (Array.from(event.dataTransfer?.types || []).includes("Files")) setImportOpen(true);
    };
    document.addEventListener("dragenter", onDragEnter);
    return () => document.removeEventListener("dragenter", onDragEnter);
  }, [props.data]);

  useEffect(() => {
    const openProjectRootDialog = () => setRunnerOpen(true);
    window.addEventListener("open-project-root-dialog", openProjectRootDialog);
    return () => window.removeEventListener("open-project-root-dialog", openProjectRootDialog);
  }, []);

  function addFiles(files: FileWithPath[]) {
    setError("");
    setAllFiles((current) => uniqueFiles([...current, ...files]));
    setReportFiles((current) => uniqueReportFiles([...current, ...files.filter(isReportFile)]));
    if (!files.some(isReportFile)) setError("Aucun rapport XML ou HTML trouve dans cette selection.");
  }

  async function analyze() {
    if (!reportFiles.length) return;
    setBusy(true);
    setError("");
    try {
      const data = await analyzeReportFiles(reportFiles, allFiles);
      props.onComplete(data);
      setComparison(null);
      setCaseChanges({});
      setImportOpen(false);
      setReportFiles([]);
      setAllFiles([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d'analyser ces fichiers.");
    } finally {
      setBusy(false);
    }
  }

  async function launchTests(config: TestRunnerConfig, targetCase: TestCase | null = null, mergeIntoCurrent = false, sourceKey: string | null = null) {
    setRunningTests(true);
    setRunningCaseKey(targetCase ? getStableCaseKey(targetCase) : null);
    setRunningSourceKey(sourceKey);
    const previousData = props.data;
    try {
      const result = await runLocalTests(config);
      const files = reportsToFiles(result.reports);
      const reports = files.filter(isReportFile);
      if (!reports.length) throw new Error("Execution terminee, mais aucun rapport XML/HTML exploitable n'a ete trouve.");
      const runData = await analyzeReportFiles(reports, files);
      const data = previousData && targetCase
        ? mergeSingleCaseRun(previousData, runData, targetCase)
        : previousData && mergeIntoCurrent
          ? mergeRunData(previousData, runData)
          : runData;
      props.onComplete(data);
      const nextComparison = compareAnalyses(previousData, data);
      setComparison(nextComparison);
      setCaseChanges(Object.fromEntries((nextComparison?.statusChanges || []).map((item) => [item.caseKey, { before: item.before, after: item.after }])));
      setRunnerOpen(false);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Impossible de lancer les tests.";
      setSweetAlert({
        tone: message.includes("arretee") ? "info" : "error",
        title: message.includes("arretee") ? "Execution arretee" : "Execution impossible",
        message,
      });
    } finally {
      setRunningTests(false);
      setRunningCaseKey(null);
      setRunningSourceKey(null);
    }
  }

  function runCase(item: TestCase) {
    const config = buildCaseRunConfig(effectiveRunnerConfig, item);
    setRunnerConfig(config);
    if (!effectiveRunnerConfig.projectRoot) {
      setRunnerOpen(true);
      return;
    }
    void launchTests(config, item);
  }

  function runSource(mode: "folder" | "file", targetPath: string) {
    const config = buildSourceRunConfig(effectiveRunnerConfig, mode, targetPath);
    setRunnerConfig(config);
    if (!effectiveRunnerConfig.projectRoot) {
      setRunnerOpen(true);
      return;
    }
    void launchTests(config, null, true, `${mode}:${targetPath}`);
  }

  async function stopRunningTests() {
    try {
      await cancelLocalTests();
      setSweetAlert({
        tone: "info",
        title: "Arret demande",
        message: "L'execution Robot en cours est en train d'etre arretee.",
      });
    } catch (reason) {
      setSweetAlert({
        tone: "error",
        title: "Arret impossible",
        message: reason instanceof Error ? reason.message : "Impossible d'arreter l'execution.",
      });
    }
  }

  function deleteModules() {
    if (!props.data || !modulesToDelete.length) return;
    const ids = new Set(modulesToDelete.map((item) => item.id));
    const modules = props.data.modules.filter((item) => !ids.has(item.id));
    const cases = props.data.cases.filter((item) => !ids.has(item.moduleId));
    const failures = cases.filter((item) => item.status === "FAIL");
    props.onChangeData({
      modules,
      cases,
      failures,
      totalCount: cases.length,
      failedCount: failures.length,
      successCount: cases.filter((item) => item.status === "PASS").length,
    });
    setModulesToDelete([]);
  }

  const importPanel = (
    <ImportPanel
      modal={Boolean(props.data)}
      busy={busy}
      error={error}
      reportFiles={reportFiles}
      onAddFiles={addFiles}
      onRemoveFile={(index) => {
        const removed = reportFiles[index];
        setReportFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
        if (removed) {
          const removedPath = fileDisplayPath(removed);
          setAllFiles((current) => current.filter((file) => fileDisplayPath(file) !== removedPath));
        }
      }}
      onClear={() => { setReportFiles([]); setAllFiles([]); setError(""); }}
      onAnalyze={analyze}
      onClose={props.data ? () => setImportOpen(false) : undefined}
    />
  );

  return (
    <>
      {props.data ? (
        <ResultsWorkspace
          data={props.data}
          fixedKeys={props.fixedKeys}
          blockedKeys={props.blockedKeys}
          onImport={() => setImportOpen(true)}
          onRunCase={runCase}
          onRunSource={runSource}
          onCancelRun={stopRunningTests}
          runningTests={runningTests}
          runningCaseKey={runningCaseKey}
          runningSourceKey={runningSourceKey}
          caseChanges={caseChanges}
          comparison={comparison}
          onToggleFixed={props.onToggleFixed}
          onToggleBlocked={props.onToggleBlocked}
          onDeleteModule={(module) => setModulesToDelete([module])}
          onDeleteModules={setModulesToDelete}
        />
      ) : <main className="empty-analysis">{importPanel}</main>}
      {props.data && importOpen ? importPanel : null}
      {runnerOpen ? (
        <RunnerDialog
          config={effectiveRunnerConfig}
          busy={runningTests}
          onChange={setRunnerConfig}
          onClose={() => setRunnerOpen(false)}
          onRun={(config) => {
            setRunnerConfig(config);
            setRunnerOpen(false);
            setSweetAlert({
              tone: "success",
              title: "Dossier projet enregistre",
              message: "Le dossier racine est sauvegarde. Vous pouvez lancer les tests depuis les lignes ou les modules.",
            });
          }}
        />
      ) : null}
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
      <SweetAlert
        open={Boolean(modulesToDelete.length)}
        tone="warning"
        title={modulesToDelete.length > 1 ? `Supprimer ${modulesToDelete.length} modules ?` : `Supprimer "${modulesToDelete[0]?.name || "ce module"}" ?`}
        message={modulesToDelete.length > 1 ? "Les modules selectionnes et tous leurs tests seront retires de cette analyse." : "Le module et tous ses tests seront retires de cette analyse."}
        confirmLabel="Oui"
        cancelLabel="Non"
        onClose={() => setModulesToDelete([])}
        onConfirm={deleteModules}
      />
    </>
  );
}

function RunnerDialog({ config, busy, onChange, onClose, onRun }: {
  config: TestRunnerConfig;
  busy: boolean;
  onChange: (config: TestRunnerConfig) => void;
  onClose: () => void;
  onRun: (config: TestRunnerConfig) => void;
}) {
  function update(next: Partial<TestRunnerConfig>) {
    onChange({ ...config, ...next });
  }

  return (
    <div className="dialog-backdrop runner-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="runner-dialog" role="dialog" aria-modal="true" aria-labelledby="runner-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="runner-dialog__header">
          <div><Settings size={20} /><span><h2 id="runner-title">Dossier projet</h2><p>Indiquez le dossier racine local une seule fois.</p></span></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fermer"><X size={20} /></button>
        </header>
        <div className="runner-dialog__body">
          <label className="runner-field">
            <span>Dossier projet</span>
            <input
              value={config.projectRoot}
              onChange={(event) => update({ projectRoot: event.target.value })}
              placeholder="C:\\chemin\\vers\\mon-projet"
            />
          </label>
          <section className="runner-help" aria-label="Aide execution locale">
            <h3>Lancer les tests en local</h3>
            <p>
              Si vous ouvrez l'outil depuis GitHub Pages, le navigateur ne peut pas executer Robot sur votre PC.
              Pour que le bouton Play fonctionne sur n'importe quel PC, installez Node.js puis lancez l'application localement.
            </p>
            <pre>{`git clone https://github.com/Mohamedamid/Project-Log-Analyzer.git
cd Project-Log-Analyzer
npm install
npm run dev -- --host 127.0.0.1`}</pre>
            <ol className="runner-help__steps">
              <li>Gardez le terminal ouvert apres la derniere commande.</li>
              <li>Reperez la ligne qui commence par <code>Local:</code>.</li>
              <li>Ouvrez le lien, par exemple <code>http://127.0.0.1:5173/Project-Log-Analyzer/</code>.</li>
              <li>Une fois l'interface ouverte, revenez ici et renseignez le dossier racine du projet Robot.</li>
              <li>Cliquez sur Play a cote d'un test. Le bouton doit afficher un spinner pendant l'execution.</li>
            </ol>
            <p>
              Ouvrez l'URL Vite en <strong>127.0.0.1</strong>. Robot Framework et les libraries du projet de test doivent etre installes sur ce PC.
              Ici, indiquez le dossier racine du projet Robot, pas un seul fichier <code>.robot</code>.
            </p>
          </section>
        </div>
        <footer className="runner-dialog__footer">
          <button className="button button--secondary" type="button" onClick={onClose}>Annuler</button>
          <button className="button button--primary" type="button" disabled={busy || !config.projectRoot.trim()} onClick={() => onRun(config)}>
            <Play size={16} /> Enregistrer
          </button>
        </footer>
      </section>
    </div>
  );
}

function uniqueFiles(files: FileWithPath[]): FileWithPath[] {
  const seen = new Set<string>();
  return files.filter((file) => {
    const key = `${fileDisplayPath(file)}::${file.size}::${file.lastModified}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
