export default function StatusPill({ status }) {
  const active = status === 'active';
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? 'bg-teal-soft/20 text-rail' : 'bg-muted text-muted-foreground'
      }`}
    >
      {active ? 'Activo' : 'Archivado'}
    </span>
  );
}
