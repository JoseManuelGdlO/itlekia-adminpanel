import { statusLabel } from '../lib/projectStatus';

export default function StatusPill({ status }) {
  const statusClasses =
    status === 'trabajando'
      ? 'bg-primary/12 text-primary'
      : status === 'parado'
        ? 'bg-filament/18 text-[#8a5a12]'
        : 'bg-muted text-muted-foreground';

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses}`}
    >
      {statusLabel(status)}
    </span>
  );
}
