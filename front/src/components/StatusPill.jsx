import { statusLabel } from '../lib/projectStatus';

export default function StatusPill({ status }) {
  const statusClasses =
    status === 'trabajando'
      ? 'bg-teal-soft/20 text-rail'
      : status === 'parado'
        ? 'bg-accent text-rail'
        : 'bg-muted text-muted-foreground';

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses}`}
    >
      {statusLabel(status)}
    </span>
  );
}
