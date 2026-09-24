import { Ban, Check, ChevronDown, Clock3, FileText, ImageOff, MessageSquare, RotateCcw, TerminalSquare, Wrench, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { KeywordDetailNode, TestCase, TimelineStep } from "../../types/analysis";
import { StatusBadge } from "../../components/common/StatusBadge";

interface TestDetailDialogProps {
  item: TestCase | null;
  fixed: boolean;
  blocked: boolean;
  onClose: () => void;
  onToggleFixed: () => void;
  onToggleBlocked: () => void;
}

export function TestDetailDialog(props: TestDetailDialogProps) {
  const { item, fixed, blocked } = props;
  const [openKeywordIds, setOpenKeywordIds] = useState<Set<string>>(new Set());
  const [detailKeywordIds, setDetailKeywordIds] = useState<Set<string>>(new Set());

  const defaultKeywordState = useMemo(() => {
    const openIds = new Set<string>();
    const detailIds = new Set<string>();
    if (!item) return { openIds, detailIds };
    const keywordTree = item.keywordTree || [];
    keywordTree.forEach((node) => collectDefaultKeywordState(node, openIds, detailIds));
    if (!openIds.size && keywordTree[0]) {
      openIds.add(keywordTree[0].id);
      detailIds.add(keywordTree[0].id);
    }
    return { openIds, detailIds };
  }, [item]);

  useEffect(() => {
    setOpenKeywordIds(defaultKeywordState.openIds);
    setDetailKeywordIds(defaultKeywordState.detailIds);
  }, [defaultKeywordState]);

  if (!item) return null;
  const keywordTree = item.keywordTree || [];
  const timeline = item.timeline || [];
  const screenshots = item.screenshots || [];
  const suitePath = item.suitePath || [];

  function toggleKeyword(id: string) {
    setOpenKeywordIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        setDetailKeywordIds((details) => {
          const nextDetails = new Set(details);
          nextDetails.delete(id);
          return nextDetails;
        });
      } else {
        next.add(id);
        setDetailKeywordIds((details) => new Set(details).add(id));
      }
      return next;
    });
  }

  return (
    <div className="dialog-backdrop detail-backdrop" role="presentation" onMouseDown={props.onClose}>
      <section className="detail-dialog" role="dialog" aria-modal="true" aria-labelledby="detail-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="detail-dialog__header">
          <div>
            <div className="breadcrumbs">{suitePath.slice(1).map((suite) => <span key={suite.id}>{suite.name}</span>)}</div>
            <h2 id="detail-title">{item.caseName}</h2>
          </div>
          <button className="icon-button" type="button" onClick={props.onClose} aria-label="Fermer"><X size={20} /></button>
        </header>
        <div className="detail-dialog__meta">
          <StatusBadge item={item} fixed={fixed} blocked={blocked} />
          <span className="tag">{item.moduleName}</span>
          {item.elapsed ? <span><Clock3 size={14} /> {item.elapsed}</span> : null}
          {item.status === "FAIL" ? (
            <button className="button button--secondary" type="button" onClick={props.onToggleFixed}>
              {fixed ? <RotateCcw size={16} /> : <Check size={16} />}{fixed ? "Annuler correction" : "Marquer corrige"}
            </button>
          ) : null}
          {item.status !== "PASS" ? (
            <button className="button button--secondary" type="button" onClick={props.onToggleBlocked}>
              <Ban size={16} />{blocked ? "Debloquer" : "Marquer bloque"}
            </button>
          ) : null}
        </div>
        <div className="detail-dialog__body">
          {item.documentation ? <section className="detail-section"><h3>Documentation</h3><p>{item.documentation}</p></section> : null}
          {screenshots.length ? (
            <section className="detail-section">
              <h3>Screenshots</h3>
              <div className="screenshot-grid">
                {screenshots.map((shot) => (
                  <a href={shot.url} target="_blank" rel="noreferrer" key={shot.ref}>
                    {shot.foundLocalFile ? <img src={shot.url} alt={shot.label} /> : <span><ImageOff size={22} /> Image non trouvee</span>}
                    <small>{shot.label}</small>
                  </a>
                ))}
              </div>
            </section>
          ) : null}
          <section className="detail-section">
            <div className="detail-section__heading">
              <h3>Execution</h3>
              {keywordTree.length ? <span>{keywordTree.length} keyword{keywordTree.length > 1 ? "s" : ""} racine</span> : null}
            </div>
            {keywordTree.length ? (
              <div className="keyword-tree" role="tree">
                {keywordTree.map((node) => (
                  <KeywordNodeView key={node.id} node={node} depth={0} openIds={openKeywordIds} detailIds={detailKeywordIds} onToggle={toggleKeyword} />
                ))}
              </div>
            ) : timeline.length ? <FlatTimeline steps={timeline} /> : <p className="muted"><Wrench size={15} /> Utilisez output.xml pour afficher la timeline.</p>}
          </section>
        </div>
      </section>
    </div>
  );
}

function collectDefaultKeywordState(node: KeywordDetailNode, openIds: Set<string>, detailIds: Set<string>): boolean {
  const childHasFailure = node.children.some((child) => collectDefaultKeywordState(child, openIds, detailIds));
  const selfFailed = node.status === "FAIL" || Boolean(node.errorMessage);
  const hasFailure = selfFailed || childHasFailure;
  if (hasFailure) openIds.add(node.id);
  if (selfFailed && !childHasFailure) detailIds.add(node.id);
  return hasFailure;
}

function KeywordNodeView({ node, depth, openIds, detailIds, onToggle }: {
  node: KeywordDetailNode;
  depth: number;
  openIds: ReadonlySet<string>;
  detailIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const hasDetails = node.args.length || node.assigns.length || node.documentation || node.messages.length || node.errorMessage;
  const open = openIds.has(node.id);
  const showDetails = open && detailIds.has(node.id);
  const status = node.status || "INFO";
  const tone = status === "FAIL" ? "fail" : status === "NOT RUN" || status === "SKIP" ? "skipped" : "pass";
  return (
    <div className={`keyword-node keyword-node--${tone}`} style={{ "--keyword-depth": depth } as CSSProperties} role="treeitem" aria-expanded={hasChildren || hasDetails ? open : undefined}>
      <button className="keyword-node__summary" type="button" onClick={() => onToggle(node.id)}>
        <span className={`keyword-node__status keyword-node__status--${tone}`}>{status}</span>
        <ChevronDown className={`keyword-node__chevron ${open ? "open" : ""}`} size={16} />
        <span className="keyword-node__name" title={node.name}>{node.name}</span>
        {node.type ? <span className="keyword-node__type">{node.type}</span> : null}
        {node.elapsed ? <span className="keyword-node__elapsed">{node.elapsed}</span> : null}
      </button>
      {open ? (
        <div className="keyword-node__content">
          {showDetails && node.assigns.length ? <DetailChips icon={<TerminalSquare size={14} />} label="Assign" values={node.assigns} /> : null}
          {showDetails && node.args.length ? <DetailChips icon={<TerminalSquare size={14} />} label="Args" values={node.args} /> : null}
          {showDetails && node.documentation ? <div className="keyword-node__doc"><FileText size={14} /><p>{node.documentation}</p></div> : null}
          {showDetails && node.errorMessage ? <div className="keyword-node__error"><X size={14} /><p>{node.errorMessage}</p></div> : null}
          {showDetails && node.messages.length ? (
            <div className="keyword-messages">
              {node.messages.map((message, index) => (
                <div className={`keyword-message keyword-message--${message.level.toLowerCase()}`} key={`${message.timestamp}-${index}`}>
                  <MessageSquare size={14} />
                  <div><strong>{message.level}</strong>{message.timestamp ? <small>{message.timestamp}</small> : null}<p>{message.text}</p></div>
                </div>
              ))}
            </div>
          ) : null}
          {hasChildren ? (
            <div className="keyword-node__children" role="group">
              {node.children.map((child) => <KeywordNodeView key={child.id} node={child} depth={depth + 1} openIds={openIds} detailIds={detailIds} onToggle={onToggle} />)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DetailChips({ icon, label, values }: { icon: ReactNode; label: string; values: string[] }) {
  return (
    <div className="keyword-node__chips">
      <span>{icon}{label}</span>
      <div>{values.map((value, index) => <code key={`${value}-${index}`}>{value}</code>)}</div>
    </div>
  );
}

function FlatTimeline({ steps }: { steps: TimelineStep[] }) {
  let failureReached = false;
  return (
    <div className="timeline">
      {steps.map((step, index) => {
        const failed = step.status === "FAIL";
        const skipped = failureReached && !failed;
        if (failed) failureReached = true;
        return (
          <div className={`timeline-step timeline-step--${failed ? "fail" : skipped ? "skipped" : "pass"}`} key={`${step.name}-${index}`}>
            <i>{failed ? <X size={14} /> : skipped ? <span /> : <Check size={14} />}</i>
            <div><strong>{step.name}</strong>{step.args.length ? <small>{step.args.join(", ")}</small> : null}{step.errorMessage ? <p>{step.errorMessage}</p> : null}</div>
            <span>{skipped ? "Non execute" : step.elapsed}</span>
          </div>
        );
      })}
    </div>
  );
}
