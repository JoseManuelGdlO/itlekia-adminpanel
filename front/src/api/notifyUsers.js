import api from './client';

export async function listNotifyUsers() {
  const res = await api.get('/notify-users');
  return res.data;
}
