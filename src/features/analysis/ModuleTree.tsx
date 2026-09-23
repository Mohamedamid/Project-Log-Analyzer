import { useEffect, useState } from "react";
import { Box, ChevronDown, ChevronRight, Folder, Layers3, Play, Trash2, X } from "lucide-react";
import type { AnalysisModule, SuiteNode } from "../../types/analysis";

interface ModuleTreeProps {
  modules: AnalysisModule[];
  failureCount: number;
  activeModuleId: string | null;
  activeSuiteId: string | null;
  onSelectAll: () => void;
  onSelectModule: (module: AnalysisModule) => void;
  onSelectSuite: (module: AnalysisModule, suite: SuiteNode) => void;
  onRunSource: (mode: "folder" | "file", targetPath: string) => void;
  runningSourceKey: string | null;
  running: boolean;
  onDeleteModule: (module: AnalysisModule) => void;
  onDeleteModules: (modules: AnalysisModule[]) => void;
  onClose: () => void;
}

export function ModuleTree(props: ModuleTreeProps) {
  const { modules, failureCount, activeModuleId, activeSuiteId } = props;
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    () => new Set(modules.slice(0, 1).map((module) => module.id)),
  );
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set());
  const [selectedModuleIds, setSelectedModuleIds] = useState<Set<string>>(new Set());
  const selectedModules = modules.filter((module) => selectedModuleIds.has(module.id));

  useEffect(() => {
    if (!activeModuleId) return;
    setExpandedModules((current) => new Set(current).add(activeModuleId));
  }, [activeModuleId]);

  function toggleModule(moduleId: string) {
    setExpandedModules((current) => toggleSetValue(current, moduleId));
  }

  function toggleSuite(suiteId: string) {
    setExpandedSuites((current) => toggleSetValue(current, suiteId));
  }

  function toggleModuleSelection(moduleId: string) {
    setSelectedModuleIds((current) => toggleSetValue(current, moduleId));
  }

  function clearSelection() {
    setSelectedModuleIds(new Set());
  }

  return (
    <aside className="module-tree">
      <div className="module-tree__title">
        <Box size={16} />
        <span>Modules</span>
        <button className="icon-button module-tree__close" type="button" onClick={props.onClose} aria-label="Fermer les modules" title="Fermer les modules">
          <X size={15} />
        </button>
      </div>
      <button className={`tree-row tree-row--all ${!activeModuleId && !activeSuiteId ? "active" : ""}`} type="button" onClick={props.onSelectAll}>
        <Layers3 size={16} /><span>Tout afficher</span><b className="count count--fail">{failureCount}</b>
      </button>
      {selectedModules.length ? (
        <div className="module-tree__bulk">
          <strong>{selectedModules.length} selectionne{selectedModules.length > 1 ? "s" : ""}</strong>
          <button className="button button--danger-soft button--compact" type="button" onClick={() => {
            props.onDeleteModules(selectedModules);
            clearSelection();
          }}>
            <Trash2 size={14} /> Supprimer
          </button>
          <button className="icon-button module-tree__clear" type="button" onClick={clearSelection} aria-label="Annuler la selection" title="Annuler la selection">
            <X size={14} />
          </button>
        </div>
      ) : null}
      <div className="module-tree__scroll">
        {modules.map((module) => {
          const expanded = expandedModules.has(module.id);
          const hasSuites = Boolean(module.suiteTree?.children.length);
          return (
            <div className="tree-module" key={module.id}>
              <div className={`tree-row tree-row--module ${activeModuleId === module.id && !activeSuiteId ? "active" : ""}`}>
                <label className="tree-check" title="Selectionner le module">
                  <input
                    type="checkbox"
                    checked={selectedModuleIds.has(module.id)}
                    onChange={() => toggleModuleSelection(module.id)}
                    aria-label={`Selectionner ${module.name}`}
                  />
                </label>
                <button
                  className="tree-expander"
                  type="button"
                  onClick={() => toggleModule(module.id)}
                  aria-label={expanded ? `Replier ${module.name}` : `Deplier ${module.name}`}
                  disabled={!hasSuites}
                >
                  {hasSuites ? expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : <span />}
                </button>
                <button
                  className="tree-label"
                  type="button"
                  onClick={() => {
                    props.onSelectModule(module);
                    if (hasSuites) setExpandedModules((current) => new Set(current).add(module.id));
                  }}
                >
                  <Box size={15} /><span>{module.name}</span>
                </button>
                <span className="tree-counts">
                  <b className="count count--pass">{module.successCount}</b>
                  <b className="count count--fail">{module.failedCount}</b>
                </span>
                <button className={`icon-button tree-run ${props.runningSourceKey === runSourceKey(sourceMode(suiteSource(module.suiteTree)), suiteSource(module.suiteTree)) ? "active" : ""}`} type="button" disabled={props.running} onClick={() => {
                  const source = suiteSource(module.suiteTree);
                  props.onRunSource(sourceMode(source), source);
                }} aria-label={`Lancer ${module.name}`} title="Lancer module">
                  {props.runningSourceKey === runSourceKey(sourceMode(suiteSource(module.suiteTree)), suiteSource(module.suiteTree)) ? <span className="button-spinner button-spinner--small" /> : <Play size={13} />}
                </button>
                <button className="icon-button tree-delete" type="button" onClick={() => props.onDeleteModule(module)} aria-label={`Supprimer ${module.name}`}>
                  <Trash2 size={14} />
                </button>
              </div>
              {expanded ? module.suiteTree?.children.map((suite) => (
                <SuiteBranch
                  key={suite.id}
                  module={module}
                  suite={suite}
                  depth={0}
                  activeSuiteId={activeSuiteId}
                  expandedSuites={expandedSuites}
                  onToggle={toggleSuite}
                  onSelect={props.onSelectSuite}
                  onRunSource={props.onRunSource}
                  runningSourceKey={props.runningSourceKey}
                  running={props.running}
                />
              )) : null}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function SuiteBranch({ module, suite, depth, activeSuiteId, expandedSuites, onToggle, onSelect, onRunSource, runningSourceKey, running }: {
  module: AnalysisModule;
  suite: SuiteNode;
  depth: number;
  activeSuiteId: string | null;
  expandedSuites: ReadonlySet<string>;
  onToggle: (suiteId: string) => void;
  onSelect: (module: AnalysisModule, suite: SuiteNode) => void;
  onRunSource: (mode: "folder" | "file", targetPath: string) => void;
  runningSourceKey: string | null;
  running: boolean;
}) {
  const expanded = expandedSuites.has(suite.id);
  const hasChildren = suite.children.length > 0;
  return (
    <div className="tree-branch">
      <div
        className={`tree-row tree-row--suite ${activeSuiteId === suite.id ? "active" : ""}`}
        style={{ paddingLeft: `${16 + Math.min(depth, 4) * 14}px` }}
      >
        <button
          className="tree-expander"
          type="button"
          onClick={() => onToggle(suite.id)}
          aria-label={expanded ? `Replier ${suite.name}` : `Deplier ${suite.name}`}
          disabled={!hasChildren}
        >
          {hasChildren ? expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} /> : <span />}
        </button>
        <button className="tree-label" type="button" onClick={() => onSelect(module, suite)}>
          <Folder size={15} /><span>{suite.name}</span>
        </button>
        {suite.failCount ? <b className="count count--fail">{suite.failCount}</b> : null}
        <button className={`icon-button tree-run ${runningSourceKey === runSourceKey(sourceMode(suiteSource(suite)), suiteSource(suite)) ? "active" : ""}`} type="button" disabled={running} onClick={() => {
          const source = suiteSource(suite);
          onRunSource(sourceMode(source), source);
        }} aria-label={`Lancer ${suite.name}`} title="Lancer dossier/fichier">
          {runningSourceKey === runSourceKey(sourceMode(suiteSource(suite)), suiteSource(suite)) ? <span className="button-spinner button-spinner--small" /> : <Play size={13} />}
        </button>
      </div>
      {expanded ? suite.children.map((child) => (
        <SuiteBranch
          key={child.id}
          module={module}
          suite={child}
          depth={depth + 1}
          activeSuiteId={activeSuiteId}
          expandedSuites={expandedSuites}
          onToggle={onToggle}
          onSelect={onSelect}
          onRunSource={onRunSource}
          runningSourceKey={runningSourceKey}
          running={running}
        />
      )) : null}
    </div>
  );
}

function sourceMode(source?: string): "folder" | "file" {
  return source?.toLowerCase().endsWith(".robot") ? "file" : "folder";
}

function runSourceKey(mode: "folder" | "file", source: string): string {
  return `${mode}:${source}`;
}

function suiteSource(suite?: SuiteNode | null): string {
  if (!suite) return "";
  if (suite.source) return suite.source;
  for (const child of suite.children) {
    const source = suiteSource(child);
    if (source) return source;
  }
  return "";
}

function toggleSetValue(current: Set<string>, value: string): Set<string> {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
