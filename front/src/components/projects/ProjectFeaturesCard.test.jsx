import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { AuthContext } from '../../context/AuthContext';
import ProjectFeaturesCard from './ProjectFeaturesCard';
import * as featuresApi from '../../api/features';

function renderCard(role) {
  return render(
    <AuthContext.Provider value={{ user: { id: 1, name: 'Ada', role }, loading: false }}>
      <ProjectFeaturesCard projectId={7} />
    </AuthContext.Provider>
  );
}

describe('ProjectFeaturesCard', () => {
  it('lets an admin create a feature', async () => {
    vi.spyOn(featuresApi, 'listFeatures').mockResolvedValue([]);
    vi.spyOn(featuresApi, 'createFeature').mockResolvedValue({
      id: 3,
      title: 'SSO',
      description: 'Login',
      status: 'pending',
      isReminder: false,
    });

    renderCard('admin');
    expect(await screen.findByText('Sin features')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('Nuevo feature'));
    });
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'SSO' } });
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Login' } });
    fireEvent.click(screen.getByText('Guardar'));

    await waitFor(() =>
      expect(featuresApi.createFeature).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ title: 'SSO', description: 'Login' })
      )
    );
    expect(await screen.findByText('SSO')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
  });

  it('hides write controls for a developer', async () => {
    vi.spyOn(featuresApi, 'listFeatures').mockResolvedValue([
      { id: 3, title: 'SSO', description: 'Login', status: 'done' },
    ]);
    renderCard('developer');
    expect(await screen.findByText('SSO')).toBeInTheDocument();
    expect(screen.getByText('Hecho')).toBeInTheDocument();
    expect(screen.queryByText('Nuevo feature')).not.toBeInTheDocument();
    expect(screen.queryByText('Quitar')).not.toBeInTheDocument();
  });
});
