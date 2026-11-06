import { SECCIONES_ADMIN } from '@/features/superadmin/model/superadmin.secciones';
import type { IdSeccionAdmin } from '@/features/superadmin/model/superadmin.types';

interface Props {
  alAbrir: (id: IdSeccionAdmin) => void;
}

export function AdminInicio({ alAbrir }: Props) {
  return (
    <section className="admin-hub" aria-label="Secciones de administración">
      <p className="admin-intro">
        Elija qué desea administrar. Cada sección se abre en su propia pantalla.
      </p>

      <ul className="admin-hub-lista">
        {SECCIONES_ADMIN.map((seccion) => (
          <li key={seccion.id}>
            <button
              type="button"
              className="admin-tarjeta"
              onClick={() => alAbrir(seccion.id)}
            >
              <span className="admin-tarjeta-icono" aria-hidden="true">
                {seccion.icono}
              </span>
              <span className="admin-tarjeta-texto">
                <strong>{seccion.titulo}</strong>
                <span>{seccion.descripcion}</span>
              </span>
              <span className="count-chip admin-tarjeta-estado">
                {seccion.conectada ? 'Disponible' : 'En desarrollo'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}