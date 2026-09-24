import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export type SweetAlertTone = "success" | "error" | "info" | "warning";

interface SweetAlertProps {
  open: boolean;
  tone?: SweetAlertTone;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onClose: () => void;
  onConfirm?: () => void;
}

const toneIcon = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
  warning: AlertTriangle,
};

export function SweetAlert({
  open,
  tone = "info",
  title,
  message,
  confirmLabel = "OK",
  cancelLabel = "Non",
  onClose,
  onConfirm,
}: SweetAlertProps) {
  if (!open) return null;
  const Icon = toneIcon[tone];
  const confirm = () => {
    if (onConfirm) onConfirm();
    else onClose();
  };
  return (
    <div className="sweet-alert-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`sweet-alert sweet-alert--${tone}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sweet-alert-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="icon-button sweet-alert__close" type="button" onClick={onClose} aria-label="Fermer">
          <X size={18} />
        </button>
        <span className="sweet-alert__icon"><Icon size={30} /></span>
        <h2 id="sweet-alert-title">{title}</h2>
        <p>{message}</p>
        <div className="sweet-alert__actions">
          {onConfirm ? <button className="button button--secondary" type="button" onClick={onClose}>{cancelLabel}</button> : null}
          <button className="button button--primary" type="button" onClick={confirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
