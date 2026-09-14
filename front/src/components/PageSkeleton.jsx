export default function PageSkeleton() {
  return (
    <div className="space-y-3 p-6" role="status" aria-busy="true" aria-label="Cargando">
      <div className="h-4 w-48 animate-pulse rounded bg-border" />
      <div className="h-4 w-80 animate-pulse rounded bg-border" />
      <div className="h-4 w-64 animate-pulse rounded bg-border" />
    </div>
  );
}
