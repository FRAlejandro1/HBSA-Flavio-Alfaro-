import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorApi } from '@/api/http';
import type { UsuarioAutenticado } from '@/features/auth/auth.types';
import { LoginPage } from '@/features/auth/LoginPage';

const mocks = vi.hoisted(() => ({ iniciarSesion: vi.fn() }));
vi.mock('@/features/auth/auth.api', () => ({ iniciarSesion: mocks.iniciarSesion }));

const usuario: UsuarioAutenticado = {
  id: 7,
  nombres: 'Ana',
  apellidos: 'Prueba',
  correo: 'ana@example.com',
  rol: 'EMPLEADO',
  empresa: { id: 1, nombre: 'Hospital' },
  area: { id: 2, detalle: 'Consulta' },
  cargo: { id: 3, detalle: 'Médica' },
};

function renderLogin(tema = 'claro') {
  const onLogin = vi.fn();
  const cambiarTema = vi.fn();
  render(<LoginPage onLogin={onLogin} tema={tema} cambiarTema={cambiarTema} />);
  return { onLogin, cambiarTema };
}

beforeEach(() => vi.clearAllMocks());

describe('LoginPage', () => {
  it('muestra el contenido y los campos obligatorios', () => {
    renderLogin();
    expect(screen.getByRole('heading', {
      name: 'Sistema de Permisos y Vacaciones',
    })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Correo electrónico' })).toBeRequired();
    expect(screen.getByLabelText('Contraseña')).toBeRequired();
    expect(screen.getByText(/Talento Humano/)).toBeInTheDocument();
  });

  it.each([
    ['claro', '☾'],
    ['oscuro', '☀'],
    ['alto-contraste', '◐'],
  ])('muestra el icono correcto para el tema %s', (tema, icono) => {
    renderLogin(tema);
    expect(screen.getByRole('button', {
      name: `Cambiar tema. Tema actual: ${tema}`,
    })).toHaveTextContent(icono);
  });

  it('permite cambiar el tema', async () => {
    const user = userEvent.setup();
    const { cambiarTema } = renderLogin('oscuro');
    await user.click(screen.getByRole('button', { name: /Cambiar tema/ }));
    expect(cambiarTema).toHaveBeenCalledOnce();
  });

  it('muestra y oculta la contraseña', async () => {
    const user = userEvent.setup();
    renderLogin();
    const campo = screen.getByLabelText('Contraseña');

    expect(campo).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(campo).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(campo).toHaveAttribute('type', 'password');
  });

  it('envía las credenciales y comunica el usuario autenticado', async () => {
    const user = userEvent.setup();
    const { onLogin } = renderLogin();
    mocks.iniciarSesion.mockResolvedValue(usuario);

    await user.type(screen.getByRole('textbox', { name: 'Correo electrónico' }), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'secreto');
    await user.click(screen.getByRole('button', { name: /Ingresar/ }));

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(usuario));
    expect(mocks.iniciarSesion).toHaveBeenCalledWith('ana@example.com', 'secreto');
  });

  it('muestra el mensaje para credenciales incorrectas', async () => {
    const user = userEvent.setup();
    renderLogin();
    mocks.iniciarSesion.mockRejectedValue(new ErrorApi('error', 401));

    await user.type(screen.getByRole('textbox', { name: 'Correo electrónico' }), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'incorrecta');
    await user.click(screen.getByRole('button', { name: /Ingresar/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o clave incorrectos.');
  });

  it('muestra el mensaje para demasiados intentos', async () => {
    const user = userEvent.setup();
    renderLogin();
    mocks.iniciarSesion.mockRejectedValue(new ErrorApi('error', 429));

    await user.type(screen.getByRole('textbox', { name: 'Correo electrónico' }), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'secreto');
    await user.click(screen.getByRole('button', { name: /Ingresar/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Demasiados intentos. Espere un momento antes de intentarlo de nuevo.',
    );
  });

  it('muestra el mensaje de un error general', async () => {
    const user = userEvent.setup();
    renderLogin();
    mocks.iniciarSesion.mockRejectedValue(new Error('Conexión interrumpida'));

    await user.type(screen.getByRole('textbox', { name: 'Correo electrónico' }), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'secreto');
    await user.click(screen.getByRole('button', { name: /Ingresar/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Conexión interrumpida');
  });

  it('muestra un mensaje alternativo si el rechazo no es un Error', async () => {
    const user = userEvent.setup();
    renderLogin();
    mocks.iniciarSesion.mockRejectedValue('fallo desconocido');

    await user.type(screen.getByRole('textbox', { name: 'Correo electrónico' }), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'secreto');
    await user.click(screen.getByRole('button', { name: /Ingresar/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No fue posible iniciar sesión. Inténtelo nuevamente.',
    );
  });

  it('limpia el error anterior tras un nuevo envío correcto', async () => {
    const user = userEvent.setup();
    renderLogin();
    mocks.iniciarSesion
      .mockRejectedValueOnce(new Error('Primer error'))
      .mockResolvedValueOnce(usuario);

    await user.type(screen.getByRole('textbox', { name: 'Correo electrónico' }), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'secreto');
    await user.click(screen.getByRole('button', { name: /Ingresar/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Primer error');

    await user.click(screen.getByRole('button', { name: /Ingresar/ }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
