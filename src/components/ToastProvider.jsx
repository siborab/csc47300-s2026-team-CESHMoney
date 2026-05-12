import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

// Notification context that powers two UX primitives across the app:
//   - toast.success / toast.error / toast.info : self-dismissing notifications
//   - confirm({ title, message, ... }) : promise-based replacement for window.confirm
// All UI lives in this file so pages just call hooks; no extra wiring needed.

const ToastContext = createContext(null);

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const confirmResolverRef = useRef(null);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind, message, options = {}) => {
      const id = nextId++;
      const duration = options.duration ?? (kind === "error" ? 5000 : 3000);
      setToasts((current) => [...current, { id, kind, message }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const toast = useMemo(
    () => ({
      success: (msg, opts) => push("success", msg, opts),
      error: (msg, opts) => push("error", msg, opts),
      info: (msg, opts) => push("info", msg, opts),
      dismiss
    }),
    [push, dismiss]
  );

  // Promise-based confirm dialog. Resolves to true on confirm, false on cancel.
  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmState({
        title: options?.title || "Are you sure?",
        message: options?.message || "",
        confirmLabel: options?.confirmLabel || "Confirm",
        cancelLabel: options?.cancelLabel || "Cancel",
        danger: options?.danger !== false
      });
    });
  }, []);

  function resolveConfirm(value) {
    const resolver = confirmResolverRef.current;
    confirmResolverRef.current = null;
    setConfirmState(null);
    if (resolver) resolver(value);
  }

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast viewport pinned to the top-right corner */}
      <div className="sw-toast-viewport" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div key={t.id} className={`sw-toast sw-toast--${t.kind}`} role="status">
            <span className="sw-toast__icon" aria-hidden="true">
              {t.kind === "success" ? "✓" : t.kind === "error" ? "!" : "i"}
            </span>
            <span className="sw-toast__msg">{t.message}</span>
            <button
              type="button"
              className="sw-toast__close"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Confirm dialog overlay - one at a time */}
      {confirmState && (
        <div
          className="sw-confirm-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) resolveConfirm(false);
          }}
        >
          <div className="sw-confirm" role="alertdialog" aria-modal="true">
            <h3 className="sw-confirm__title">{confirmState.title}</h3>
            {confirmState.message && (
              <p className="sw-confirm__message">{confirmState.message}</p>
            )}
            <div className="sw-confirm__actions">
              <button
                type="button"
                className="sw-btn sw-btn--ghost"
                onClick={() => resolveConfirm(false)}
              >
                {confirmState.cancelLabel}
              </button>
              <button
                type="button"
                className={`sw-btn ${confirmState.danger ? "sw-btn--danger" : "sw-btn--primary"}`}
                onClick={() => resolveConfirm(true)}
                autoFocus
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast() must be used inside <ToastProvider>");
  }
  return ctx;
}
