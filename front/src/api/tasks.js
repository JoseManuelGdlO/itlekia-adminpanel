import api from './client';

export async function listTasks(params = {}) {
  const res = await api.get('/tasks', { params });
  return res.data;
}

export async function createTask(data) {
  const res = await api.post('/tasks', data);
  return res.data;
}

export async function updateTaskStatus(id, status) {
  const res = await api.patch(`/tasks/${id}/status`, { status });
  return res.data;
}

export async function listTaskActivities(taskId) {
  const res = await api.get(`/tasks/${taskId}/activities`);
  return res.data;
}
