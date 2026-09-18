import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TeamPage from './TeamPage';
import * as statsApi from '../api/stats';

describe('TeamPage', () => {
  it('renders member rows and headers', async () => {
    vi.spyOn(statsApi, 'getTeamStats').mockResolvedValueOnce({
      members: [
        {
          id: 2,
          name: 'Dev',
          role: 'developer',
          projects: 2,
          todo: 1,
          inProgress: 3,
          done: 4,
          estimatedHours: 6.5,
        },
      ],
    });
    render(<TeamPage />);
    expect(await screen.findByText('Dev')).toBeInTheDocument();
    expect(screen.getByText('Nombre')).toBeInTheDocument();
    expect(screen.getByText('Proyectos')).toBeInTheDocument();
    expect(screen.getByText('Por hacer')).toBeInTheDocument();
    expect(screen.getByText('En curso')).toBeInTheDocument();
    expect(screen.getByText('Hechas')).toBeInTheDocument();
    expect(screen.getByText('Horas est.')).toBeInTheDocument();
    expect(screen.getByText('6.5')).toBeInTheDocument();
  });

  it('shows Nadie en el equipo when members is empty', async () => {
    vi.spyOn(statsApi, 'getTeamStats').mockResolvedValueOnce({ members: [] });
    render(<TeamPage />);
    expect(await screen.findByText('Nadie en el equipo')).toBeInTheDocument();
  });

  it('shows No se pudo cargar on failure', async () => {
    vi.spyOn(statsApi, 'getTeamStats').mockRejectedValueOnce(new Error('nope'));
    render(<TeamPage />);
    expect(await screen.findByText('No se pudo cargar')).toBeInTheDocument();
  });
});
