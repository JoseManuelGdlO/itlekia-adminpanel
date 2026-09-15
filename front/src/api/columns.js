import api from './client';

export async function listColumns(projectId) {
  const res = await api.get(`/projects/${projectId}/columns`);
  return res.data;
}

export async function createColumn(projectId, data) {
  const res = await api.post(`/projects/${projectId}/columns`, data);
  return res.data;
}

export async function updateColumn(projectId, columnId, data) {
  const res = await api.put(`/projects/${projectId}/columns/${columnId}`, data);
  return res.data;
}

export async function reorderColumns(projectId, columnIds) {
  const res = await api.put(`/projects/${projectId}/columns/reorder`, { columnIds });
  return res.data;
}

export async function deleteColumn(projectId, columnId) {
  await api.delete(`/projects/${projectId}/columns/${columnId}`);
}
