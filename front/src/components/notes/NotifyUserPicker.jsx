import { Label } from '@/components/ui/label';

export default function NotifyUserPicker({ users, selectedIds, onToggle }) {
  return (
    <fieldset className="space-y-2">
      <Label>Avisar también a</Label>
      {users.map((u) => (
        <label key={u.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selectedIds.includes(u.id)}
            onChange={() => onToggle(u.id)}
          />
          {u.name}
        </label>
      ))}
    </fieldset>
  );
}
