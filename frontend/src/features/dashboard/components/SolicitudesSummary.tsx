import { FILTROS_SOLICITUDES } from '@/features/dashboard/dashboard.constants';

interface Props {
  total: number;
  filtro: string;
  cambiarFiltro: (filtro: string) => void;
  anunciar: (mensaje: string) => void;
}

export function SolicitudesSummary({
  total,
  filtro,
  cambiarFiltro,
  anunciar,
}: Props) {
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="panel-kicker">SEGUIMIENTO</p>
          <h3>Mis solicitudes</h3>
        </div>
        <span className="count-chip">{total} registradas</span>
      </div>

      <div className="filter-tabs" aria-label="Filtrar solicitudes">
        {FILTROS_SOLICITUDES.map((opcion) => (
          <button
            type="button"
            key={opcion.value}
            className={
              filtro === opcion.value ? 'filter-tab selected' : 'filter-tab'
            }
            aria-pressed={filtro === opcion.value}
            onClick={() => {
              cambiarFiltro(opcion.value);

              if (
                opcion.value === 'PERMISOS' ||
                opcion.value === 'LICENCIAS'
              ) {
                anunciar(
                  `El filtro ${opcion.label.toLowerCase()} estará disponible cuando se habilite ese módulo.`,
                );
              }
            }}
          >
            {opcion.label}
          </button>
        ))}
      </div>
    </>
  );
}
