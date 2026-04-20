"use client";

import Button from "@/components/ui/button";

export default function ConfirmDialog({
  open,
  title,
  message,
  error = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
  danger = false,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{message}</p>
        {error ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          {danger ? (
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="btn-base rounded-[10px] border border-transparent bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {loading ? "Please wait…" : confirmLabel}
            </button>
          ) : (
            <Button type="button" onClick={onConfirm} disabled={loading}>
              {loading ? "Please wait…" : confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
