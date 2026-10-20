import { useState, type FormEvent } from 'react';
import { peticionApi } from '@/api/http';

interface Props {
  onCancel: () => void;
  onCreated: () => void | Promise<void>;
}

function fechaLocal(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

export function SolicitudVacacionesForm({ onCancel, onCreated }: Props) {
  const hoy = fechaLocal(new Date());
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [telefono, setTelefono] = useState('');
  const [justificacion, setJustificacion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const requiereJustificacion = (() => {
    if (!fechaInicio) return false;
    const inicio = new Date(`${fechaInicio}T12:00:00`);
    const actual = new Date(`${hoy}T12:00:00`);
    return (inicio.getTime() - actual.getTime()) / 86400000 < 7;
  })();

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError('');

    if (!fechaInicio || !fechaFin) {
      setError('Debe seleccionar las fechas de inicio y fin.');
      return;
    }

    if (fechaInicio < hoy) {
      setError('La fecha de inicio no puede ser anterior a hoy.');
      return;
    }
    if (fechaFin < fechaInicio) {
      setError('La fecha final no puede ser anterior a la inicial.');
      return;
    }
    if (requiereJustificacion && !justificacion.trim()) {
      setError('La justificación es obligatoria para solicitudes con menos de siete días de anticipación.');
      return;
    }
    if (telefono.trim() && !/^[0-9+()\- ]{7,20}$/.test(telefono.trim())) {
      setError('Ingrese un teléfono válido de entre 7 y 20 caracteres.');
      return;
    }

    setGuardando(true);
    try {
      await peticionApi('/api/vacaciones/solicitudes', {
        method: 'POST',
        autenticada: true,
        body: {
          fechaInicio,
          fechaFin,
          ...(telefono.trim() ? { telefonoLocalizacion: telefono.trim() } : {}),
          ...(justificacion.trim() ? { justificacion: justificacion.trim() } : {}),
        },
      });
      await onCreated();
    } catch (desconocido) {
      setError(
        desconocido instanceof Error
          ? desconocido.message
          : 'No se pudo registrar la solicitud.',
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="panel panel-wide vacation-form-panel" aria-labelledby="vacation-form-title">
      <h3 id="vacation-form-title">Nueva solicitud de vacaciones</h3>
      <p>Complete las fechas y los datos de contacto. El sistema validará los días laborables y las condiciones aplicables.</p>

      <form onSubmit={(evento) => void enviar(evento)} noValidate>
        <div className="vacation-form-grid">
          <label>
            Fecha de inicio
            <input
              type="date"
              value={fechaInicio}
              min={hoy}
              required
              onChange={(evento) => setFechaInicio(evento.target.value)}
            />
          </label>

          <label>
            Fecha de fin
            <input
              type="date"
              value={fechaFin}
              min={fechaInicio || hoy}
              required
              onChange={(evento) => setFechaFin(evento.target.value)}
            />
          </label>

          <label>
            Teléfono de localización (opcional)
            <input
              type="tel"
              value={telefono}
              minLength={7}
              maxLength={20}
              placeholder="Ej. 0991234567"
              onChange={(evento) => setTelefono(evento.target.value)}
            />
          </label>

          <label className="vacation-justification">
            Justificación {requiereJustificacion ? '(obligatoria)' : '(opcional)'}
            <textarea
              value={justificacion}
              maxLength={500}
              required={requiereJustificacion}
              rows={3}
              placeholder="Explique el motivo de la solicitud cuando corresponda."
              onChange={(evento) => setJustificacion(evento.target.value)}
            />
            <span>{justificacion.length}/500 caracteres</span>
          </label>
        </div>

        {error && <p className="feedback feedback-error" role="alert">{error}</p>}

        <div className="vacation-form-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={guardando}>
            Cancelar
          </button>
          <button type="submit" className="primary-button" disabled={guardando}>
            {guardando ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        </div>
      </form>
    </section>
  );
}
