function parseMoney(raw) {
  if (raw === undefined) return { skip: true };
  if (raw === null || raw === '') return { value: null };
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return { error: 'Invalid amount' };
  return { value: n };
}

function parsePayDay(raw) {
  if (raw === undefined) return { skip: true };
  if (raw === null || raw === '') return { value: null };
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 31) return { error: 'Invalid pay day' };
  return { value: n };
}

function parseContractDate(raw) {
  if (raw === undefined) return { skip: true };
  if (raw === null || raw === '') return { value: null };
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { error: 'Invalid contract date' };
  }
  return { value: raw };
}

function toPublicProject(project) {
  const json = typeof project.toJSON === 'function' ? project.toJSON() : { ...project };
  json.costAmount = json.costAmount == null ? null : Number(json.costAmount);
  json.monthlyAmount = json.monthlyAmount == null ? null : Number(json.monthlyAmount);
  json.contractSignedAt = json.contractSignedAt
    ? String(json.contractSignedAt).slice(0, 10)
    : null;
  json.monthlyPayDay = json.monthlyPayDay == null ? null : Number(json.monthlyPayDay);
  return json;
}

module.exports = { parseMoney, parsePayDay, parseContractDate, toPublicProject };
