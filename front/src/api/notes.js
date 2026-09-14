import api from './client';

export async function listNotes(params = {}) {
  const res = await api.get('/notes', { params });
  return res.data;
}

export async function createNote(data) {
  const res = await api.post('/notes', data);
  return res.data;
}

export async function updateNote(id, data) {
  const res = await api.put(`/notes/${id}`, data);
  return res.data;
}

export async function deleteNote(id) {
  await api.delete(`/notes/${id}`);
}
