export default function PageSkeleton() {
  return (
    <div className="space-y-3 p-6" aria-busy="true" aria-label="Cargando">
      <div className="h-4 w-48 rounded bg-border" />
      <div className="h-4 w-80 rounded bg-border" />
      <div className="h-4 w-64 rounded bg-border" />
    </div>
  );
}
