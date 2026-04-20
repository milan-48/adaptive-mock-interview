export function LoadingState({ label = "Loading data..." }) {
  return (
    <div className="card-base flex min-h-52 items-center justify-center">
      <div className="flex items-center gap-3 text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
        <span className="text-body">{label}</span>
      </div>
    </div>
  );
}

export function EmptyState({ title, subtitle, action }) {
  return (
    <div className="card-base flex min-h-60 flex-col items-center justify-center px-6 text-center">
      <h3 className="text-subtitle text-slate-900">{title}</h3>
      <p className="mt-2 max-w-md text-body text-slate-500">{subtitle}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
