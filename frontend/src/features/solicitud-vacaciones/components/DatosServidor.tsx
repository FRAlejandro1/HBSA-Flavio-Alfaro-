import type { UsuarioAutenticado } from '@/features/auth/auth.types';
import { ValorPendiente } from '@/features/solicitud-vacaciones/components/ValorPendiente';

interface Props {
  usuario: UsuarioAutenticado;
  fechaSolicitud: Date;
}

export function DatosServidor({ usuario, fechaSolicitud }: Props) {
  const nombreCompleto = `${usuario.nombres} ${usuario.apellidos}`.trim();
  const fecha = new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(fechaSolicitud);

  return (
    <section className="vacation-seccion" aria-labelledby="sv-datos-titulo">
      <h2 id="sv-datos-titulo" className="vacation-titulo">
        <span aria-hidden="true">1 · </span>Datos del servidor
      </h2>

      <dl className="vacation-datos">
        <div>
          <dt>Nombre</dt>
          <dd>{nombreCompleto}</dd>
        </div>

        {/* Pendiente: la cédula y el lugar no vienen en la sesión del usuario. */}
        <div>
          <dt>Cédula</dt>
          <dd>
            <ValorPendiente />
          </dd>
        </div>

        <div>
          <dt>Cargo</dt>
          <dd>{usuario.cargo.detalle || 'No especificado'}</dd>
        </div>

        <div>
          <dt>Área / subárea</dt>
          <dd>{usuario.area.detalle || 'No especificada'}</dd>
        </div>

        <div>
          <dt>Lugar</dt>
          <dd>
            <ValorPendiente />
          </dd>
        </div>

        <div>
          <dt>Fecha de solicitud</dt>
          <dd>{fecha}</dd>
        </div>
      </dl>
    </section>
  );
}