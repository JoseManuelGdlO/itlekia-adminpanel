import api from './client';

export async function listFinance(projectId) {
  const res = await api.get(`/projects/${projectId}/finance`);
  return res.data;
}

export async function createFinance(projectId, formData) {
  const res = await api.post(`/projects/${projectId}/finance`, formData);
  return res.data;
}

export async function deleteFinance(projectId, itemId) {
  await api.delete(`/projects/${projectId}/finance/${itemId}`);
}

export async function downloadFinanceFile(projectId, itemId, fileName) {
  const res = await api.get(`/projects/${projectId}/finance/${itemId}/file`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'file';
  a.click();
  URL.revokeObjectURL(url);
}
