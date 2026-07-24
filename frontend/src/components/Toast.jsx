import React, { createContext, useContext, useState, useCallback, useRef } from "react";

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

let _toastIdCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 350);
  }, []);

  const toast = useCallback(({ type = "info", title, message, duration = 4000 }) => {
    const id = ++_toastIdCounter;
    setToasts((prev) => [...prev, { id, type, title, message, exiting: false }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  const success = useCallback((title, message, duration) => toast({ type: "success", title, message, duration }), [toast]);
  const error   = useCallback((title, message, duration) => toast({ type: "error",   title, message, duration }), [toast]);
  const warning = useCallback((title, message, duration) => toast({ type: "warning", title, message, duration }), [toast]);
  const info    = useCallback((title, message, duration) => toast({ type: "info",    title, message, duration }), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const TOAST_ICONS = {
  success: "✅",
  error:   "❌",
  warning: "⚠️",
  info:    "ℹ️",
};

function ToastContainer({ toasts, dismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.type} ${t.exiting ? "toast-exit" : "toast-enter"}`}
          role="alert"
        >
          <div className="toast-icon">{TOAST_ICONS[t.type]}</div>
          <div className="toast-body">
            {t.title && <div className="toast-title">{t.title}</div>}
            {t.message && <div className="toast-message">{t.message}</div>}
          </div>
          <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">×</button>
          <div className="toast-progress" />
        </div>
      ))}
    </div>
  );
}
