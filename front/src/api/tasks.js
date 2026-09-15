import api from './client';

export async function listTasks(params = {}) {
  const res = await api.get('/tasks', { params });
  return res.data;
}

export async function createTask(data) {
  const res = await api.post('/tasks', data);
  return res.data;
}

export async function updateTask(id, data) {
  const res = await api.put(`/tasks/${id}`, data);
  return res.data;
}

export async function updateTaskColumn(id, columnId) {
  const res = await api.patch(`/tasks/${id}/column`, { columnId });
  return res.data;
}

export async function listTaskActivities(taskId) {
  const res = await api.get(`/tasks/${taskId}/activities`);
  return res.data;
}
