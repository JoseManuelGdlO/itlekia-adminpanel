import api from './client';

export async function login(email, password) {
  const res = await api.post('/auth/login', { email, password });
  return res.data;
}

export async function logout() {
  await api.post('/auth/logout');
}

export async function me() {
  const res = await api.get('/auth/me');
  return res.data;
}
