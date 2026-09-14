export default function EmptyState({ message, action }) {
  return (
    <div className="px-4 py-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
