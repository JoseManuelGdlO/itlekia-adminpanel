export default function PageSkeleton({ fill = false }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Cargando"
      className={
        fill
          ? 'flex min-h-screen items-center justify-center bg-background'
          : 'flex items-center justify-center py-16'
      }
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex size-16 items-center justify-center">
          <span className="loader-ring absolute inset-0 rounded-full" />
          <img src="/intelekia-isotipo.png" alt="Intelekia" className="relative size-8 object-contain" />
        </div>
        <div className="flex h-7 items-end gap-1.5" aria-hidden="true">
          <span className="loader-bar bg-primary" />
          <span className="loader-bar bg-teal-soft" />
          <span className="loader-bar bg-rail" />
        </div>
        <p className="font-heading text-sm font-medium tracking-wide text-muted-foreground">Cargando</p>
      </div>
    </div>
  );
}
