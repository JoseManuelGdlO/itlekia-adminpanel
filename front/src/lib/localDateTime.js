export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function todayInputDate(now = new Date()) {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function splitDateTime(value) {
  if (!value) return { date: '', time: '09:00' };
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { date: value, time: '09:00' };
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    const [date, rest] = value.split('T');
    return { date, time: rest.slice(0, 5) };
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { date: '', time: '09:00' };
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

export function joinDateTime(date, time) {
  if (!date) return undefined;
  return `${date}T${time || '09:00'}`;
}
