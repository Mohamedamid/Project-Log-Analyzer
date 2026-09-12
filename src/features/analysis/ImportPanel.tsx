import { useRef, useState } from "react";
import { FileText, FolderOpen, LoaderCircle, Play, Trash2, UploadCloud, X } from "lucide-react";
import type { FileWithPath } from "../../types/analysis";
import { collectDroppedFiles, isReportFile } from "../../services/fileCollection";
import { fileDisplayPath, formatFileSize } from "../../utils/analysis";

interface ImportPanelProps {
  modal: boolean;
  busy: boolean;
  error: string;
  reportFiles: FileWithPath[];
  onAddFiles: (files: FileWithPath[]) => void;
  onRemoveFile: (index: number) => void;
  onClear: () => void;
  onAnalyze: () => void;
  onClose?: () => void;
}

export function ImportPanel({
  modal,
  busy,
  error,
  reportFiles,
  onAddFiles,
  onRemoveFile,
  onClear,
  onAnalyze,
  onClose,
}: ImportPanelProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  async function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    onAddFiles(await collectDroppedFiles(event.dataTransfer));
  }

  const content = (
    <section
      className={`import-panel ${modal ? "import-panel--modal" : ""} ${dragging ? "import-panel--dragging" : ""}`}
      onMouseDown={(event) => event.stopPropagation()}
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
      onDrop={handleDrop}
    >
      {modal && onClose ? (
        <button className="icon-button import-panel__close" type="button" onClick={onClose} aria-label="Fermer l'import">
          <X size={20} />
        </button>
      ) : null}

      <div className="import-panel__intro">
        <span className="import-panel__icon"><FolderOpen size={32} /></span>
        <div>
          <h2>Glissez vos rapports de test ici</h2>
          <p>Seuls les rapports XML seront analyses, meme depuis un dossier complet.</p>
        </div>
      </div>

      <div className="import-panel__actions">
        <button className="button button--secondary" type="button" onClick={() => fileInput.current?.click()}>
          <FileText size={17} /> Choisir fichiers
        </button>
        <button className="button button--secondary" type="button" onClick={() => folderInput.current?.click()}>
          <FolderOpen size={17} /> Choisir dossier
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".xml,application/xml,text/xml"
          multiple
          hidden
          onChange={(event) => {
            onAddFiles(Array.from(event.target.files || []) as FileWithPath[]);
            event.target.value = "";
          }}
        />
        <input
          ref={folderInput}
          type="file"
          multiple
          hidden
          {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
          onChange={(event) => {
            onAddFiles(Array.from(event.target.files || []) as FileWithPath[]);
            event.target.value = "";
          }}
        />
      </div>

      <div className="file-queue">
        <div className="file-queue__heading">
          <strong>{reportFiles.length} fichier{reportFiles.length === 1 ? "" : "s"} ajoute{reportFiles.length === 1 ? "" : "s"}</strong>
          <div>
            <button className="button button--ghost" type="button" onClick={onClear} disabled={!reportFiles.length || busy}>
              <Trash2 size={16} /> Vider
            </button>
            <button className="button button--primary" type="button" onClick={onAnalyze} disabled={!reportFiles.length || busy}>
              {busy ? <LoaderCircle className="spin" size={17} /> : <Play size={17} />}
              {busy ? "Analyse..." : "Analyser maintenant"}
            </button>
          </div>
        </div>
        {error ? <p className="inline-error">{error}</p> : null}
        {reportFiles.length ? (
          <div className="file-queue__list">
            {reportFiles.map((file, index) => (
              <div className="file-row" key={`${fileDisplayPath(file)}-${file.lastModified}`}>
                <FileText size={16} />
                <span><strong>{file.name}</strong><small>{fileDisplayPath(file)}</small></span>
                <small>{formatFileSize(file.size)}</small>
                <button className="icon-button" type="button" onClick={() => onRemoveFile(index)} aria-label={`Retirer ${file.name}`}>
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="file-queue__empty"><UploadCloud size={20} /> Deposez vos fichiers dans cette zone</div>
        )}
      </div>
    </section>
  );

  return modal ? <div className="import-backdrop" onMouseDown={onClose}>{content}</div> : content;
}

export function uniqueReportFiles(files: FileWithPath[]): FileWithPath[] {
  const seen = new Set<string>();
  return files.filter((file) => {
    if (!isReportFile(file)) return false;
    const key = `${fileDisplayPath(file)}::${file.size}::${file.lastModified}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
