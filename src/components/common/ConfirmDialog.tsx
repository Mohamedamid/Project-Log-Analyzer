import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="icon-button dialog-close" type="button" onClick={onCancel} aria-label="Fermer">
          <X size={18} />
        </button>
        <div className="confirm-dialog__content">
          <span className="confirm-dialog__icon"><AlertTriangle size={22} /></span>
          <div>
            <h2 id="confirm-title">{title}</h2>
            <p>{message}</p>
          </div>
        </div>
        <div className="dialog-actions">
          <button className="button button--secondary" type="button" onClick={onCancel}>Annuler</button>
          <button className="button button--danger" type="button" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
