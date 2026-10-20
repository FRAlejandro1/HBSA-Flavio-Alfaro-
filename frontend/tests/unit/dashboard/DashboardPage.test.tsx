import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UsuarioAutenticado } from '@/features/auth/auth.types';
import type { RespuestaSolicitudes, Solicitud } from '@/features/dashboard/dashboard.types';
import { DashboardPage } from '@/features/dashboard/DashboardPage';

const mocks = vi.hoisted(() => ({
  cerrarSesion: vi.fn(),
  listarSolicitudes: vi.fn(),
}));

vi.mock('@/features/auth/auth.api', () => ({
  cerrarSesion: mocks.cerrarSesion,
}));

vi.mock('@/features/dashboard/dashboard.api', () => ({
  listarSolicitudes: mocks.listarSolicitudes,
}));

vi.mock('@/features/dashboard/SolicitudVacacionesForm', () => ({
  SolicitudVacacionesForm: ({
    onCancel,
    onCreated,
  }: {
    onCancel: () => void;
    onCreated: () => void | Promise<void>;
  }) => (
    <section aria-label="Formulario simulado">
      <button type="button" onClick={onCancel}>Cancelar formulario</button>
      <button type="button" onClick={() => void onCreated()}>Crear solicitud simulada</button>
    </section>
  ),
}));

const usuario: UsuarioAutenticado = {
  id: 1,
  nombres: 'Ana',
  apellidos: 'Pérez',
  correo: 'ana@example.com',
  rol: 'EMPLEADO',
  empresa: { id: 1, nombre: 'Hospital de prueba' },
  area: { id: 1, detalle: 'Consulta externa' },
  cargo: { id: 1, detalle: 'Enfermera' },
};

const solicitud: Solicitud = {
  id: 1,
  ordenTramite: 'VAC-001',
  fechaInicio: '2026-11-10',
  fechaFin: '2026-11-12',
  diasSolicitados: 3,
  tipo: 'PROGRAMADA',
  estado: 'PENDIENTE',
  solicitadoAt: '2026-10-19T12:00:00.000Z',
};

const respuesta: RespuestaSolicitudes = {
  solicitudes: [solicitud],
  total: 1,
  pagina: 1,
  porPagina: 20,
};

function renderDashboard() {
  const onLogout = vi.fn();
  const anunciar = vi.fn();
  const cambiarTema = vi.fn();

  render(
    <DashboardPage
      usuario={usuario}
      onLogout={onLogout}
      tema="claro"
      cambiarTema={cambiarTema}
      anunciar={anunciar}
    />,
  );

  return { onLogout, anunciar, cambiarTema };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listarSolicitudes.mockResolvedValue(respuesta);
  mocks.cerrarSesion.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe('DashboardPage', () => {
  it('carga y presenta las solicitudes del servidor', async () => {
    renderDashboard();

    expect(await screen.findByText('Solicitud VAC-001')).toBeInTheDocument();
    expect(screen.getByText('1 registradas')).toBeInTheDocument();
    expect(mocks.listarSolicitudes).toHaveBeenCalledOnce();
  });

  it('muestra el estado vacío cuando la respuesta no contiene solicitudes', async () => {
    mocks.listarSolicitudes.mockResolvedValue({
      solicitudes: [],
      total: 0,
      pagina: 1,
      porPagina: 20,
    });

    renderDashboard();

    expect(
      await screen.findByText('No hay solicitudes para mostrar'),
    ).toBeInTheDocument();
  });

  it('muestra un error del servidor y permite reintentar', async () => {
    mocks.listarSolicitudes
      .mockRejectedValueOnce(new Error('Error de conexión'))
      .mockResolvedValueOnce(respuesta);

    renderDashboard();

    expect(await screen.findByRole('alert')).toHaveTextContent('Error de conexión');

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Solicitud VAC-001')).toBeInTheDocument();
    expect(mocks.listarSolicitudes).toHaveBeenCalledTimes(2);
  });

  it('muestra un mensaje genérico si el error no es una instancia de Error', async () => {
    mocks.listarSolicitudes.mockRejectedValueOnce('fallo inesperado');

    renderDashboard();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudieron cargar las solicitudes.',
    );
  });

  it('oculta las solicitudes cuando se seleccionan filtros no disponibles', async () => {
    renderDashboard();

    expect(await screen.findByText('Solicitud VAC-001')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Permisos' }));

    expect(
      screen.getByText('No hay solicitudes para mostrar'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Solicitud VAC-001')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Vacaciones' }));

    expect(screen.getByText('Solicitud VAC-001')).toBeInTheDocument();
  });

  it('abre y cancela el formulario de vacaciones', async () => {
    renderDashboard();

    await screen.findByText('Solicitud VAC-001');

    fireEvent.click(
      screen.getByRole('button', { name: /Solicitar vacaciones/ }),
    );

    expect(screen.getByRole('region', { name: 'Formulario simulado' }))
      .toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar formulario' }));

    expect(
      screen.queryByRole('region', { name: 'Formulario simulado' }),
    ).not.toBeInTheDocument();
  });

  it('anuncia el registro y recarga las solicitudes al crear una solicitud', async () => {
    const { anunciar } = renderDashboard();

    await screen.findByText('Solicitud VAC-001');

    fireEvent.click(
      screen.getByRole('button', { name: /Solicitar vacaciones/ }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Crear solicitud simulada' }),
    );

    await waitFor(() => {
      expect(mocks.listarSolicitudes).toHaveBeenCalledTimes(2);
    });

    expect(anunciar).toHaveBeenCalledWith(
      'La solicitud de vacaciones se registró correctamente.',
    );

    expect(
      screen.queryByRole('region', { name: 'Formulario simulado' }),
    ).not.toBeInTheDocument();
  });

  it('cierra la sesión y notifica al componente superior', async () => {
    const { onLogout } = renderDashboard();

    await screen.findByText('Solicitud VAC-001');

    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));

    await waitFor(() => {
      expect(mocks.cerrarSesion).toHaveBeenCalledOnce();
      expect(onLogout).toHaveBeenCalledOnce();
    });
  });

  it('notifica el fallo del servidor, pero igualmente finaliza el cierre de sesión', async () => {
    mocks.cerrarSesion.mockRejectedValueOnce(new Error('sesión no disponible'));

    const { onLogout, anunciar } = renderDashboard();

    await screen.findByText('Solicitud VAC-001');

    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));

    await waitFor(() => {
      expect(onLogout).toHaveBeenCalledOnce();
    });

    expect(anunciar).toHaveBeenCalledWith(
      'No se pudo confirmar el cierre de sesión con el servidor.',
    );
  });

  it('permite cambiar el tema desde el encabezado', async () => {
    const { cambiarTema } = renderDashboard();

    await screen.findByText('Solicitud VAC-001');

    fireEvent.click(
      screen.getByRole('button', { name: /Cambiar tema/ }),
    );

    expect(cambiarTema).toHaveBeenCalledOnce();
  });

  it('muestra el área predeterminada cuando el usuario no tiene área detallada', async () => {
    mocks.listarSolicitudes.mockResolvedValue({
      solicitudes: [],
      total: 0,
      pagina: 1,
      porPagina: 20,
    });

    render(
      <DashboardPage
        usuario={{
          ...usuario,
          area: { ...usuario.area, detalle: '' },
        }}
        onLogout={vi.fn()}
        tema="claro"
        cambiarTema={vi.fn()}
        anunciar={vi.fn()}
      />,
    );

    expect(await screen.findByText('Área no especificada')).toBeInTheDocument();
    expect(screen.getByText('No hay solicitudes para mostrar')).toBeInTheDocument();
  });
});
