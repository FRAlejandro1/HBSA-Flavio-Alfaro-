import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UsuarioAutenticado } from '@/features/auth/auth.types';
import type { Solicitud } from '@/features/dashboard/model/dashboard.types';
import { AccessibilityTools } from '@/features/dashboard/components/layout/AccessibilityTools';
import { DashboardHeader } from '@/features/dashboard/components/layout/DashboardHeader';
import { DashboardModules } from '@/features/dashboard/components/inicio/DashboardModules';
import { DashboardSidebar } from '@/features/dashboard/components/layout/DashboardSidebar';
import { SolicitudesList } from '@/features/dashboard/components/solicitudes/SolicitudesList';
import { SolicitudesSummary } from '@/features/dashboard/components/solicitudes/SolicitudesSummary';
afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty('--escala-texto');
  vi.restoreAllMocks();
});

const usuario: UsuarioAutenticado = {
  id: 1,
  nombres: 'Ana',
  apellidos: 'Pérez',
  correo: 'ana@example.com',
  rol: 'SUPERADMIN',
  empresa: { id: 1, nombre: 'Hospital de prueba' },
  area: { id: 1, detalle: 'Administración' },
  cargo: { id: 1, detalle: 'Analista' },
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

describe('DashboardHeader', () => {
  it.each([
    ['claro', '☾'],
    ['oscuro', '☀'],
    ['alto-contraste', '◐'],
  ])('muestra el icono correspondiente al tema %s', (tema, icono) => {
    render(
      <DashboardHeader
        usuario={usuario}
        tema={tema}
        cambiarTema={vi.fn()}
        anunciar={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', {
        name: `Cambiar tema. Tema actual: ${tema}`,
      }),
    ).toHaveTextContent(icono);
    expect(screen.getByRole('heading', { name: 'Hola, Ana' })).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('Analista · Administración')).toBeInTheDocument();
  });

  it('permite cambiar el tema y anunciar las notificaciones', () => {
    const cambiarTema = vi.fn();
    const anunciar = vi.fn();

    render(
      <DashboardHeader
        usuario={usuario}
        tema="claro"
        cambiarTema={cambiarTema}
        anunciar={anunciar}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Cambiar tema/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones' }));

    expect(cambiarTema).toHaveBeenCalledOnce();
    expect(anunciar).toHaveBeenCalledWith(
      'Las notificaciones estarán disponibles próximamente.',
    );
  });

  it('usa el cargo institucional predeterminado cuando está vacío', () => {
    const usuarioSinCargo: UsuarioAutenticado = {
      ...usuario,
      cargo: { ...usuario.cargo, detalle: '' },
    };

    render(
      <DashboardHeader
        usuario={usuarioSinCargo}
        tema="claro"
        cambiarTema={vi.fn()}
        anunciar={vi.fn()}
      />,
    );

    expect(screen.getByText('Personal institucional · Administración')).toBeInTheDocument();
  });
});

describe('DashboardSidebar', () => {
  it('ejecuta la navegación al inicio', () => {
    const scrollTo = vi.fn();
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: scrollTo,
    });

    render(
      <DashboardSidebar
        cerrarSesion={vi.fn()}
        cerrando={false}
        anunciar={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Inicio/ }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('anuncia las funciones que todavía no están disponibles', () => {
    const anunciar = vi.fn();

    render(
      <DashboardSidebar
        cerrarSesion={vi.fn()}
        cerrando={false}
        anunciar={anunciar}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Aprob.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Calend.' }));

    expect(anunciar).toHaveBeenNthCalledWith(
      1,
      'La bandeja de aprobaciones estará disponible próximamente.',
    );
    expect(anunciar).toHaveBeenNthCalledWith(
      2,
      'El calendario institucional estará disponible próximamente.',
    );
  });

  it('permite cerrar sesión y deshabilita el botón mientras se cierra', () => {
    const cerrarSesion = vi.fn();

    const { rerender } = render(
      <DashboardSidebar
        cerrarSesion={cerrarSesion}
        cerrando={false}
        anunciar={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    expect(cerrarSesion).toHaveBeenCalledOnce();

    rerender(
      <DashboardSidebar
        cerrarSesion={cerrarSesion}
        cerrando
        anunciar={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Saliendo…' })).toBeDisabled();
  });
});

describe('DashboardModules', () => {
  it('invoca la apertura del formulario de vacaciones', () => {
    const onSolicitarVacaciones = vi.fn();

    render(
      <DashboardModules
        onSolicitarVacaciones={onSolicitarVacaciones}
        anunciar={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Solicitar vacaciones/ }),
    );

    expect(onSolicitarVacaciones).toHaveBeenCalledOnce();
  });

  it.each([
    {
      nombre: 'permisos',
      mensaje: 'El módulo de permisos por horas está en desarrollo.',
      nombreBoton: /Solicitar permiso/,
    },
    {
      nombre: 'licencias',
      mensaje: 'El módulo de licencias por enfermedad está en desarrollo.',
      nombreBoton: /Solicitar licencia/,
    },
  ])(
    'anuncia la disponibilidad pendiente: $nombre',
    ({ mensaje, nombreBoton }) => {
      const anunciar = vi.fn();

      render(
        <DashboardModules
          onSolicitarVacaciones={vi.fn()}
          anunciar={anunciar}
        />,
      );

      const boton = screen.getByRole('button', {
        name: nombreBoton,
      });

      expect(boton).toBeDefined();
      fireEvent.click(boton);

      expect(anunciar).toHaveBeenCalledWith(mensaje);
    },
  );
});

describe('SolicitudesList', () => {
  it('muestra el estado de carga', () => {
    render(
      <SolicitudesList solicitudes={[]} cargando anunciar={vi.fn()} />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Cargando solicitudes…',
    );
  });

  it('muestra el estado vacío cuando no hay solicitudes', () => {
    render(
      <SolicitudesList solicitudes={[]} cargando={false} anunciar={vi.fn()} />,
    );

    expect(
      screen.getByText('No hay solicitudes para mostrar'),
    ).toBeInTheDocument();
  });

  it.each([
    ['PENDIENTE', 'Pendiente'],
    ['VISTO_BUENO', 'En revisión'],
    ['AUTORIZADA', 'Autorizada'],
    ['NEGADA', 'Negada'],
    ['CANCELADA', 'Cancelada'],
  ] as const)('muestra el estado %s', (estado, etiqueta) => {
    render(
      <SolicitudesList
        solicitudes={[{ ...solicitud, estado }]}
        cargando={false}
        anunciar={vi.fn()}
      />,
    );

    expect(screen.getByText(etiqueta)).toBeInTheDocument();
    expect(screen.getByText('VAC-001')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ver el seguimiento de la solicitud VAC-001' }),
    ).toBeInTheDocument();
  });

  it('anuncia cómo consultar el detalle si no se proporciona selección', () => {
    const anunciar = vi.fn();

    render(
      <SolicitudesList
        solicitudes={[solicitud]}
        cargando={false}
        anunciar={anunciar}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ver el seguimiento de la solicitud VAC-001' }));

    expect(anunciar).toHaveBeenCalledWith(
      'Seleccione el detalle de la solicitud VAC-001 desde el panel de seguimiento.',
    );
  });

  it('selecciona la solicitud cuando se proporciona la función de selección', () => {
    const alSeleccionar = vi.fn();

    render(
      <SolicitudesList
        solicitudes={[solicitud]}
        cargando={false}
        anunciar={vi.fn()}
        alSeleccionar={alSeleccionar}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ver el seguimiento de la solicitud VAC-001' }));

    expect(alSeleccionar).toHaveBeenCalledWith(solicitud);
  });

  it('conserva el valor original si la fecha no puede interpretarse', () => {
    render(
      <SolicitudesList
        solicitudes={[
          {
            ...solicitud,
            fechaInicio: 'fecha-invalida',
            fechaFin: 'fecha-invalida',
          },
        ]}
        cargando={false}
        anunciar={vi.fn()}
      />,
    );

    expect(screen.getByText(/fecha-invalida/)).toBeInTheDocument();
  });
});

describe('SolicitudesSummary', () => {
  it('muestra el total y los cuatro filtros', () => {
    render(
      <SolicitudesSummary
        total={12}
        filtro="TODAS"
        cambiarFiltro={vi.fn()}
        anunciar={vi.fn()}
      />,
    );

    expect(screen.getByText('12 registradas')).toBeInTheDocument();

    for (const nombre of ['Todas', 'Vacaciones', 'Permisos', 'Licencias']) {
      expect(screen.getByRole('button', { name: nombre })).toBeInTheDocument();
    }
  });

  it('cambia el filtro seleccionado', () => {
    const cambiarFiltro = vi.fn();

    render(
      <SolicitudesSummary
        total={0}
        filtro="TODAS"
        cambiarFiltro={cambiarFiltro}
        anunciar={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Vacaciones' }));

    expect(cambiarFiltro).toHaveBeenCalledWith('VACACIONES');
  });

  it.each([
    ['Permisos', 'permisos'],
    ['Licencias', 'licencias'],
  ])('anuncia que el filtro %s todavía no está disponible', (nombre, modulo) => {
    const anunciar = vi.fn();

    render(
      <SolicitudesSummary
        total={0}
        filtro="TODAS"
        cambiarFiltro={vi.fn()}
        anunciar={anunciar}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: nombre }));

    expect(anunciar).toHaveBeenCalledWith(
      `El filtro ${modulo} estará disponible cuando se habilite ese módulo.`,
    );
  });
});

describe('AccessibilityTools', () => {
  it.each([
    ['Reducir tamaño del texto', '0.9', 'Tamaño de texto reducido.'],
    ['Restablecer tamaño del texto', '1', 'Tamaño de texto normal.'],
    ['Aumentar tamaño del texto', '1.15', 'Tamaño de texto aumentado.'],
  ])('aplica la escala %s', (nombre, escala, mensaje) => {
    const anunciar = vi.fn();

    render(<AccessibilityTools anunciar={anunciar} />);

    fireEvent.click(screen.getByRole('button', { name: nombre }));

    expect(
      document.documentElement.style.getPropertyValue('--escala-texto'),
    ).toBe(escala);
    expect(anunciar).toHaveBeenCalledWith(mensaje);
  });
});