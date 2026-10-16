// Pruebas de App: la pantalla inicial se muestra con el nombre de la aplicacion.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { Variables } from '@/config/Variables';

describe('App', () => {
  it('muestra el nombre de la aplicacion como titulo principal', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: Variables.nombreApp })).toBeInTheDocument();
  });

  it('expone una region principal para lectores de pantalla', () => {
    render(<App />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});