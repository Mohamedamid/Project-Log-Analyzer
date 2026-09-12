import { useEffect, useState } from "react";
import { Box, ChevronDown, ChevronRight, Folder, Layers3, Trash2, X } from "lucide-react";
import type { AnalysisModule, SuiteNode } from "../../types/analysis";

interface ModuleTreeProps {
  modules: AnalysisModule[];
  failureCount: number;
  activeModuleId: string | null;
  activeSuiteId: string | null;
  onSelectAll: () => void;
  onSelectModule: (module: AnalysisModule) => void;
  onSelectSuite: (module: AnalysisModule, suite: SuiteNode) => void;
  onDeleteModule: (module: AnalysisModule) => void;
  onClose: () => void;
}

export function ModuleTree(props: ModuleTreeProps) {
  const { modules, failureCount, activeModuleId, activeSuiteId } = props;
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    () => new Set(modules.slice(0, 1).map((module) => module.id)),
  );
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set());

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
      <div className="module-tree__scroll">
        {modules.map((module) => {
          const expanded = expandedModules.has(module.id);
          const hasSuites = Boolean(module.suiteTree?.children.length);
          return (
            <div className="tree-module" key={module.id}>
              <div className={`tree-row tree-row--module ${activeModuleId === module.id && !activeSuiteId ? "active" : ""}`}>
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
                />
              )) : null}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function SuiteBranch({ module, suite, depth, activeSuiteId, expandedSuites, onToggle, onSelect }: {
  module: AnalysisModule;
  suite: SuiteNode;
  depth: number;
  activeSuiteId: string | null;
  expandedSuites: ReadonlySet<string>;
  onToggle: (suiteId: string) => void;
  onSelect: (module: AnalysisModule, suite: SuiteNode) => void;
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
        />
      )) : null}
    </div>
  );
}

function toggleSetValue(current: Set<string>, value: string): Set<string> {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
