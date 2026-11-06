interface Props {
  onSolicitarVacaciones: () => void;
  anunciar: (mensaje: string) => void;
}

export function DashboardModules({
  onSolicitarVacaciones,
  anunciar,
}: Props) {
  return (
    <section
      className="module-grid module-grid-saldos"
      aria-label="Resumen de solicitudes"
    >
      <article className="panel panel-vacaciones">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true">
            ▤
          </span>
          <span className="panel-kicker">GESTIÓN DE TIEMPO LIBRE</span>
        </div>

        <h2>Mis vacaciones</h2>

        {/* Pendiente: la cifra, la barra y la leyenda se alimentarán del contrato de saldo. */}
        <div className="saldo-cuerpo">
          <div className="saldo-cifra">
            <span className="sr-only">
              Días disponibles: dato no disponible por ahora
            </span>
            <span aria-hidden="true">—</span>
            <span className="saldo-unidad" aria-hidden="true">
              días disponibles
            </span>
          </div>

          <div className="saldo-barra" aria-hidden="true" />

          <span className="saldo-leyenda">
            usados · en trámite · libres · período y fecha de caducidad
          </span>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={onSolicitarVacaciones}
        >
          + Solicitar vacaciones
        </button>
      </article>

      <article className="panel">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true">
            ◷
          </span>
          <span className="panel-kicker">GESTIÓN DE JORNADA</span>
        </div>

        <h2>Permisos por hora</h2>

        <div className="saldo-cuerpo">
          <div className="saldo-cifra">
            <span className="sr-only">
              Horas de permiso disponibles: dato no disponible por ahora
            </span>
            <span aria-hidden="true">— h</span>
          </div>

          <div className="saldo-barra saldo-barra-corta" aria-hidden="true" />

          <span className="count-chip saldo-chip">Próximamente</span>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            anunciar('El módulo de permisos por horas está en desarrollo.')
          }
        >
          + Solicitar permiso
        </button>
      </article>

      <article className="panel">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true">
            ＋
          </span>
          <span className="panel-kicker">JUSTIFICACIONES</span>
        </div>

        <h2>Licencia por enfermedad</h2>

        <div className="saldo-cuerpo">
          <div className="saldo-cifra">
            <span className="sr-only">
              Días de licencia en el año: dato no disponible por ahora
            </span>
            <span aria-hidden="true">—</span>
            <span className="saldo-unidad" aria-hidden="true">
              días en el año
            </span>
          </div>

          <span className="count-chip saldo-chip">Próximamente</span>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            anunciar('El módulo de licencias por enfermedad está en desarrollo.')
          }
        >
          + Solicitar licencia
        </button>
      </article>
    </section>
  );
}