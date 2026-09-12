import { Ban, Check, Clock3, ImageOff, RotateCcw, Wrench, X } from "lucide-react";
import type { TestCase } from "../../types/analysis";
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
  if (!item) return null;
  let failureReached = false;
  return (
    <div className="dialog-backdrop detail-backdrop" role="presentation" onMouseDown={props.onClose}>
      <section className="detail-dialog" role="dialog" aria-modal="true" aria-labelledby="detail-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="detail-dialog__header">
          <div>
            <div className="breadcrumbs">{item.suitePath.slice(1).map((suite) => <span key={suite.id}>{suite.name}</span>)}</div>
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
          {item.screenshots.length ? (
            <section className="detail-section">
              <h3>Screenshots</h3>
              <div className="screenshot-grid">
                {item.screenshots.map((shot) => (
                  <a href={shot.url} target="_blank" rel="noreferrer" key={shot.ref}>
                    {shot.foundLocalFile ? <img src={shot.url} alt={shot.label} /> : <span><ImageOff size={22} /> Image non trouvee</span>}
                    <small>{shot.label}</small>
                  </a>
                ))}
              </div>
            </section>
          ) : null}
          <section className="detail-section">
            <h3>Execution</h3>
            <div className="timeline">
              {item.timeline.length ? item.timeline.map((step, index) => {
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
              }) : <p className="muted"><Wrench size={15} /> Utilisez output.xml pour afficher la timeline.</p>}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
