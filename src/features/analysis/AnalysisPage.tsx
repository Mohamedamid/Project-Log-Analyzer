import { useEffect, useState } from "react";
import type { AnalysisData, AnalysisModule, FileWithPath, TestCase } from "../../types/analysis";
import { analyzeReportFiles } from "../../services/robotParser";
import { isReportFile } from "../../services/fileCollection";
import { fileDisplayPath } from "../../utils/analysis";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
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

export function AnalysisPage(props: AnalysisPageProps) {
  const [reportFiles, setReportFiles] = useState<FileWithPath[]>([]);
  const [allFiles, setAllFiles] = useState<FileWithPath[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [moduleToDelete, setModuleToDelete] = useState<AnalysisModule | null>(null);

  useEffect(() => {
    if (!props.data) return;
    const onDragEnter = (event: DragEvent) => {
      if (Array.from(event.dataTransfer?.types || []).includes("Files")) setImportOpen(true);
    };
    document.addEventListener("dragenter", onDragEnter);
    return () => document.removeEventListener("dragenter", onDragEnter);
  }, [props.data]);

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
      setImportOpen(false);
      setReportFiles([]);
      setAllFiles([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d'analyser ces fichiers.");
    } finally {
      setBusy(false);
    }
  }

  function deleteModule() {
    if (!props.data || !moduleToDelete) return;
    const modules = props.data.modules.filter((item) => item.id !== moduleToDelete.id);
    const cases = props.data.cases.filter((item) => item.moduleId !== moduleToDelete.id);
    const failures = cases.filter((item) => item.status === "FAIL");
    props.onChangeData({
      modules,
      cases,
      failures,
      totalCount: cases.length,
      failedCount: failures.length,
      successCount: cases.filter((item) => item.status === "PASS").length,
    });
    setModuleToDelete(null);
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
          onToggleFixed={props.onToggleFixed}
          onToggleBlocked={props.onToggleBlocked}
          onDeleteModule={setModuleToDelete}
        />
      ) : <main className="empty-analysis">{importPanel}</main>}
      {props.data && importOpen ? importPanel : null}
      <ConfirmDialog
        open={Boolean(moduleToDelete)}
        title={`Supprimer "${moduleToDelete?.name || "ce module"}" ?`}
        message="Le module et tous ses tests seront retires de cette analyse."
        confirmLabel="Supprimer"
        onCancel={() => setModuleToDelete(null)}
        onConfirm={deleteModule}
      />
    </>
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
