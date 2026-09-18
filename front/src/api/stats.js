import api from './client';

export async function getTeamStats() {
  const res = await api.get('/stats/team');
  return res.data;
}
