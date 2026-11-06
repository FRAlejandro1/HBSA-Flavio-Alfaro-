import { useState } from 'react';
import type { FormEvent } from 'react';
import type { UsuarioAutenticado } from '@/features/auth/auth.types';
import { crearSolicitud } from '@/features/solicitud-vacaciones/api/solicitud-vacaciones.api';
import { CalendarioPeriodo } from '@/features/solicitud-vacaciones/components/CalendarioPeriodo';
import { DatosServidor } from '@/features/solicitud-vacaciones/components/DatosServidor';
import { ResumenSaldo } from '@/features/solicitud-vacaciones/components/ResumenSaldo';
import { RutaAprobacion } from '@/features/solicitud-vacaciones/components/RutaAprobacion';
import { ValorPendiente } from '@/features/solicitud-vacaciones/components/ValorPendiente';
import type { DatosSolicitudVacaciones } from '@/features/solicitud-vacaciones/model/solicitud-vacaciones.types';
import {
  esNoProgramada,
  fechaLocal,
} from '@/features/solicitud-vacaciones/model/solicitud-vacaciones.utils';
import '@/features/solicitud-vacaciones/solicitud-vacaciones.css';

interface Props {
  usuario: UsuarioAutenticado;
  onCancel: () => void;
  onCreated: () => void | Promise<void>;
}

export function SolicitudVacacionesForm({
  usuario,
  onCancel,
  onCreated,
}: Props) {
  const [ahora] = useState(() => new Date());
  const hoy = fechaLocal(ahora);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [telefono, setTelefono] = useState('');
  const [justificacion, setJustificacion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const requiereJustificacion = fechaInicio
    ? esNoProgramada(hoy, fechaInicio)
    : false;

  const tipoTexto = !fechaInicio
    ? 'Sin definir'
    : requiereJustificacion
      ? 'No programada'
      : 'Programada';

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

    const datos: DatosSolicitudVacaciones = {
      fechaInicio,
      fechaFin,
      ...(telefono.trim() ? { telefonoLocalizacion: telefono.trim() } : {}),
      ...(justificacion.trim() ? { justificacion: justificacion.trim() } : {}),
    };

    setGuardando(true);
    try {
      await crearSolicitud(datos);
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
    <div className="vacation-layout">
      <div className="panel vacation-panel">
        <form
          className="vacation-formulario"
          aria-label="Solicitud de vacaciones"
          onSubmit={(evento) => void enviar(evento)}
          noValidate
        >
          <p className="vacation-nota">
            Los campos marcados con <span aria-hidden="true">*</span>
            <span className="sr-only">asterisco</span> son obligatorios.
          </p>

          <DatosServidor usuario={usuario} fechaSolicitud={ahora} />

          <section
            className="vacation-seccion"
            aria-labelledby="sv-periodo-titulo"
          >
            <h2 id="sv-periodo-titulo" className="vacation-titulo">
              <span aria-hidden="true">2 · </span>Período
            </h2>

            <div className="vacation-grid">
              <div className="vacation-campo">
                <label htmlFor="sv-fecha-inicio">
                  Fecha de inicio <span aria-hidden="true">*</span>
                </label>
                <input
                  id="sv-fecha-inicio"
                  type="date"
                  value={fechaInicio}
                  min={hoy}
                  required
                  aria-required="true"
                  onChange={(evento) => setFechaInicio(evento.target.value)}
                />
              </div>

              <div className="vacation-campo">
                <label htmlFor="sv-fecha-fin">
                  Fecha de finalización <span aria-hidden="true">*</span>
                </label>
                <input
                  id="sv-fecha-fin"
                  type="date"
                  value={fechaFin}
                  min={fechaInicio || hoy}
                  required
                  aria-required="true"
                  onChange={(evento) => setFechaFin(evento.target.value)}
                />
              </div>

              {/* Pendiente: los días laborables los calcula el servidor al enviar. */}
              <div className="vacation-dato">
                <span className="vacation-dato-etiqueta">
                  Días laborables
                </span>
                <span className="vacation-dato-valor">
                  <ValorPendiente />
                </span>
                <span className="vacation-ayuda">
                  Lo calcula el sistema al enviar.
                </span>
              </div>

              <div className="vacation-dato">
                <span className="vacation-dato-etiqueta">Tipo</span>
                <span aria-live="polite">
                  <span className="count-chip">{tipoTexto}</span>
                </span>
                <span className="vacation-ayuda">
                  Es programada si faltan siete días o más.
                </span>
              </div>
            </div>

            <CalendarioPeriodo
              key={fechaInicio || 'sin-inicio'}
              inicio={fechaInicio}
              fin={fechaFin}
            />
          </section>

          <div className="vacation-campo">
            <label htmlFor="sv-telefono">
              Teléfono de localización{' '}
              <span className="vacation-opcional">(opcional)</span>
            </label>
            <input
              id="sv-telefono"
              type="tel"
              autoComplete="tel"
              value={telefono}
              minLength={7}
              maxLength={20}
              placeholder="Ej. 0991234567"
              aria-describedby="sv-telefono-ayuda"
              onChange={(evento) => setTelefono(evento.target.value)}
            />
            <span id="sv-telefono-ayuda" className="vacation-ayuda">
              Entre 7 y 20 caracteres: números, +, paréntesis, guiones y
              espacios.
            </span>
          </div>

          <div className="vacation-campo">
            <label htmlFor="sv-justificacion">
              Justificación{' '}
              <span className="vacation-opcional">
                {requiereJustificacion ? '(obligatoria)' : '(opcional)'}
              </span>
            </label>
            <textarea
              id="sv-justificacion"
              value={justificacion}
              maxLength={500}
              required={requiereJustificacion}
              aria-required={requiereJustificacion}
              rows={3}
              placeholder="Explique el motivo de la solicitud cuando corresponda."
              aria-describedby="sv-justificacion-ayuda sv-justificacion-contador"
              onChange={(evento) => setJustificacion(evento.target.value)}
            />
            <span id="sv-justificacion-ayuda" className="vacation-ayuda">
              Es obligatoria cuando faltan menos de siete días de anticipación.
            </span>
            <span id="sv-justificacion-contador" className="vacation-ayuda">
              {justificacion.length}/500 caracteres
            </span>
          </div>

          {error && (
            <p className="feedback feedback-error" role="alert">
              {error}
            </p>
          )}

          <div className="vacation-acciones">
            <button
              type="button"
              className="secondary-button"
              onClick={onCancel}
              disabled={guardando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={guardando}
            >
              {guardando ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </div>
        </form>
      </div>

      <aside className="vacation-aside" aria-label="Información de la solicitud">
        <ResumenSaldo />
        <RutaAprobacion />
      </aside>
    </div>
  );
}