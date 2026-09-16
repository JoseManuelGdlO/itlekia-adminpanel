export const PROJECT_STATUS_OPTIONS = [
  { value: 'trabajando', label: 'Trabajando' },
  { value: 'parado', label: 'Parado' },
  { value: 'oculto', label: 'Oculto' },
  { value: 'archivado', label: 'Archivado' },
];

export function isKanbanListed(status) {
  return status === 'trabajando' || status === 'parado';
}

export function statusLabel(status) {
  return PROJECT_STATUS_OPTIONS.find((option) => option.value === status)?.label || status;
}
