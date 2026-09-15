import api from './client';

export async function listFeatures(projectId) {
  const res = await api.get(`/projects/${projectId}/features`);
  return res.data;
}

export async function createFeature(projectId, data) {
  const res = await api.post(`/projects/${projectId}/features`, data);
  return res.data;
}

export async function deleteFeature(projectId, featureId) {
  await api.delete(`/projects/${projectId}/features/${featureId}`);
}
