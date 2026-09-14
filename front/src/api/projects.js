import api from './client';

export async function listProjects() {
  const res = await api.get('/projects');
  return res.data;
}

export async function createProject(data) {
  const res = await api.post('/projects', data);
  return res.data;
}

export async function updateProject(id, data) {
  const res = await api.put(`/projects/${id}`, data);
  return res.data;
}

export async function deleteProject(id) {
  await api.delete(`/projects/${id}`);
}

export async function listMembers(projectId) {
  const res = await api.get(`/projects/${projectId}/members`);
  return res.data;
}

export async function addMember(projectId, userId) {
  const res = await api.post(`/projects/${projectId}/members`, { userId });
  return res.data;
}

export async function removeMember(projectId, userId) {
  await api.delete(`/projects/${projectId}/members/${userId}`);
}
