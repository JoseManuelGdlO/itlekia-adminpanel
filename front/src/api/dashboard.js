import api from './client';

export async function getDashboard() {
  const res = await api.get('/dashboard');
  return res.data;
}
