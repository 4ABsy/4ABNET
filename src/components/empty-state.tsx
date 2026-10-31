import Link from "next/link";

export function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
  icon,
}: {
  title: string;
  body?: string;
  actionHref?: string;
  actionLabel?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
        {icon ?? <span className="text-xl font-extrabold">4AB</span>}
      </div>
      <h2 className="mt-4 text-lg font-bold text-ink">{title}</h2>
      {body ? <p className="mt-2 max-w-md text-sm leading-7 text-muted">{body}</p> : null}
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="btn btn-primary mt-5">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
