import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { peticionApi } from '@/api/http';
import { SolicitudVacacionesForm } from '@/features/dashboard/SolicitudVacacionesForm';

vi.mock('@/api/http', () => ({
  peticionApi: vi.fn(),
}));

const peticionApiMock = vi.mocked(peticionApi);

function fechaRelativa(dias: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function renderFormulario() {
  const onCancel = vi.fn();
  const onCreated = vi.fn().mockResolvedValue(undefined);

  render(
    <SolicitudVacacionesForm
      onCancel={onCancel}
      onCreated={onCreated}
    />,
  );

  return { onCancel, onCreated };
}

function completarFechas(inicio: string, fin: string) {
  fireEvent.change(screen.getByLabelText('Fecha de inicio'), {
    target: { value: inicio },
  });
  fireEvent.change(screen.getByLabelText('Fecha de fin'), {
    target: { value: fin },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  peticionApiMock.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe('SolicitudVacacionesForm', () => {
  it('muestra los campos y permite cancelar', () => {
    const { onCancel } = renderFormulario();

    expect(screen.getByRole('heading', { name: 'Nueva solicitud de vacaciones' }))
      .toBeInTheDocument();
    expect(screen.getByLabelText('Fecha de inicio')).toBeRequired();
    expect(screen.getByLabelText('Fecha de fin')).toBeRequired();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(peticionApiMock).not.toHaveBeenCalled();
  });

  it('rechaza el envío cuando faltan fechas', async () => {
    renderFormulario();

    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Debe seleccionar las fechas de inicio y fin.',
    );
    expect(peticionApiMock).not.toHaveBeenCalled();
  });

  it('rechaza una fecha de inicio anterior al día actual', async () => {
    renderFormulario();

    completarFechas(fechaRelativa(-1), fechaRelativa(1));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La fecha de inicio no puede ser anterior a hoy.',
    );
    expect(peticionApiMock).not.toHaveBeenCalled();
  });

  it('rechaza una fecha final anterior a la inicial', async () => {
    renderFormulario();

    completarFechas(fechaRelativa(10), fechaRelativa(9));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La fecha final no puede ser anterior a la inicial.',
    );
    expect(peticionApiMock).not.toHaveBeenCalled();
  });

  it('exige justificación para una solicitud con menos de siete días de anticipación', async () => {
    renderFormulario();

    completarFechas(fechaRelativa(2), fechaRelativa(3));

    expect(screen.getByLabelText(/Justificación/)).toBeRequired();

    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La justificación es obligatoria para solicitudes con menos de siete días de anticipación.',
    );
    expect(peticionApiMock).not.toHaveBeenCalled();
  });

  it('acepta una solicitud próxima cuando se proporciona justificación', async () => {
    const { onCreated } = renderFormulario();

    completarFechas(fechaRelativa(2), fechaRelativa(3));
    fireEvent.change(screen.getByLabelText(/Justificación/), {
      target: { value: '   Motivo urgente   ' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    await waitFor(() => {
      expect(peticionApiMock).toHaveBeenCalledOnce();
    });

    expect(peticionApiMock).toHaveBeenCalledWith(
      '/api/vacaciones/solicitudes',
      {
        method: 'POST',
        autenticada: true,
        body: {
          fechaInicio: fechaRelativa(2),
          fechaFin: fechaRelativa(3),
          justificacion: 'Motivo urgente',
        },
      },
    );
    expect(onCreated).toHaveBeenCalledOnce();
  });

  it('rechaza un teléfono que no cumple el formato permitido', async () => {
    renderFormulario();

    completarFechas(fechaRelativa(10), fechaRelativa(11));
    fireEvent.change(
      screen.getByLabelText('Teléfono de localización (opcional)'),
      { target: { value: 'abc' } },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ingrese un teléfono válido de entre 7 y 20 caracteres.',
    );
    expect(peticionApiMock).not.toHaveBeenCalled();
  });

  it('envía las fechas y el teléfono opcional sin añadir campos vacíos', async () => {
    const { onCreated } = renderFormulario();

    completarFechas(fechaRelativa(10), fechaRelativa(11));
    fireEvent.change(
      screen.getByLabelText('Teléfono de localización (opcional)'),
      { target: { value: ' 0991234567 ' } },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledOnce();
    });

    expect(peticionApiMock).toHaveBeenCalledWith(
      '/api/vacaciones/solicitudes',
      {
        method: 'POST',
        autenticada: true,
        body: {
          fechaInicio: fechaRelativa(10),
          fechaFin: fechaRelativa(11),
          telefonoLocalizacion: '0991234567',
        },
      },
    );
  });

  it('muestra el mensaje del servidor cuando falla el registro', async () => {
    peticionApiMock.mockRejectedValueOnce(new Error('Solicitud duplicada'));

    renderFormulario();

    completarFechas(fechaRelativa(10), fechaRelativa(11));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Solicitud duplicada',
    );
  });

  it('muestra un mensaje genérico cuando el error no es una instancia de Error', async () => {
    peticionApiMock.mockRejectedValueOnce('fallo desconocido');

    renderFormulario();

    completarFechas(fechaRelativa(10), fechaRelativa(11));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo registrar la solicitud.',
    );
  });

  it('muestra un error si falla la función posterior al registro', async () => {
    const onCreated = vi.fn().mockRejectedValue(new Error('Error al actualizar la vista'));

    render(
      <SolicitudVacacionesForm
        onCancel={vi.fn()}
        onCreated={onCreated}
      />,
    );

    completarFechas(fechaRelativa(10), fechaRelativa(11));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Error al actualizar la vista',
    );
  });

  it('actualiza el contador de caracteres de la justificación', () => {
    renderFormulario();

    fireEvent.change(screen.getByLabelText(/Justificación/), {
      target: { value: 'Motivo de prueba' },
    });

    expect(screen.getByText('16/500 caracteres')).toBeInTheDocument();
  });
});
