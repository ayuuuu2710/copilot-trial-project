import { useEffect, useRef, useState } from "react";
import { Activity, AlertCircle, Check, ChevronDown, ChevronLeft, ChevronRight, LoaderCircle, Plus, X } from "lucide-react";
import { api, localDate } from "./api.js";

export function useResource(path, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api(path));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, dependencies);
  return { data, setData, loading, error, refresh };
}

export function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action && <div className="heading-action">{action}</div>}</div>;
}

export function DateStepper({ date, onChange, label }) {
  function shift(amount) {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + amount);
    onChange(localDate(next));
  }
  return <div className="date-stepper" role="group" aria-label={`${label} date navigation`}>
    <IconButton label="Previous day" onClick={() => shift(-1)}><ChevronLeft size={17} /></IconButton>
    <label className="date-picker"><span className="visually-hidden">{label} date</span><input aria-label={`${label} date`} type="date" value={date} onChange={(event) => onChange(event.target.value)} /></label>
    <IconButton label="Next day" onClick={() => shift(1)} disabled={date >= localDate()}><ChevronRight size={17} /></IconButton>
    {date !== localDate() && <Button variant="ghost" className="button-small" onClick={() => onChange(localDate())}>Today</Button>}
  </div>;
}

export function Button({ children, variant = "primary", className = "", ...props }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>;
}

export function IconButton({ label, children, ...props }) {
  return <button className="icon-button" aria-label={label} title={label} {...props}>{children}</button>;
}

export function Modal({ title, subtitle, onClose, children, wide = false }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
      if (event.key === "Tab") {
        const focusable = [...dialogRef.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    const previousFocus = document.activeElement;
    const initialFocus = dialogRef.current.querySelector("[autofocus], input, button, select, textarea");
    initialFocus?.focus();
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className={`modal-card${wide ? " modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby={subtitle ? "modal-subtitle" : undefined}>
      <div className="modal-heading"><div><h2 id="modal-title">{title}</h2>{subtitle && <p id="modal-subtitle">{subtitle}</p>}</div><IconButton label="Close dialog" onClick={onClose}><X size={19} /></IconButton></div>
      {children}
    </section>
  </div>;
}

export function FormField({ label, hint, error, children }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <span className="field-hint">{hint}</span>}{error && <span className="field-error">{error}</span>}</label>;
}

export function LoadingState({ label = "Loading your data…" }) {
  return <div className="loading-state" role="status" aria-live="polite"><span className="visually-hidden">{label}</span><div className="loading-skeleton loading-skeleton-wide" /><div className="loading-skeleton" /><div className="loading-skeleton loading-skeleton-short" /><LoaderCircle className="spin loading-indicator" size={18} aria-hidden="true" /></div>;
}

export function ErrorState({ message, onRetry }) {
  return <div className="state-card state-error"><AlertCircle size={21} /><span>{message || "We couldn't load this information."}</span>{onRetry && <Button variant="ghost" onClick={onRetry}>Try again</Button>}</div>;
}

export function EmptyState({ icon: Icon = Activity, title, description, action }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={22} /></div><strong>{title}</strong><p>{description}</p>{action}</div>;
}

export function InlineNotice({ children, variant = "success" }) {
  return <div className={`inline-notice notice-${variant}`} role={variant === "error" ? "alert" : "status"}>{variant === "success" ? <Check size={16} /> : <AlertCircle size={16} />}{children}</div>;
}

export function ConfirmDelete({ title, description, onCancel, onConfirm, busy }) {
  return <Modal title={title} subtitle={description} onClose={onCancel}>
    <div className="modal-actions"><Button variant="ghost" onClick={onCancel} disabled={busy}>Keep it</Button><Button variant="danger" onClick={onConfirm} disabled={busy}>{busy ? "Deleting…" : "Delete"}</Button></div>
  </Modal>;
}

export function SelectField({ label, value, onChange, children }) {
  return <FormField label={label}><span className="select-wrap"><select value={value} onChange={onChange}>{children}</select><ChevronDown size={15} /></span></FormField>;
}

export function AddButton({ children, ...props }) {
  return <Button {...props}><Plus size={17} />{children}</Button>;
}
