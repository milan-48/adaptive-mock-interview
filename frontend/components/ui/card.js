export function Card({ children, className = "" }) {
  return <section className={`card-base ${className}`}>{children}</section>;
}

export function CardHeader({ title, subtitle, right }) {
  return (
    <header className="flex items-center justify-between gap-4">
      <div>
        <h2 className="text-title text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-body text-slate-500">{subtitle}</p> : null}
      </div>
      {right}
    </header>
  );
}
