interface Props {
  onSolicitarVacaciones: () => void;
  anunciar: (mensaje: string) => void;
}

export function DashboardModules({ onSolicitarVacaciones, anunciar }: Props) {
  return (
    <>
      <article className="panel panel-vacaciones">
        <div className="panel-heading">
          <span className="panel-icon icon-blue" aria-hidden="true">▤</span>
          <span className="panel-kicker">GESTIÓN DE TIEMPO LIBRE</span>
        </div>
        <h3>Vacaciones</h3>
        <p>Consulte el estado de sus solicitudes o prepare una nueva petición.</p>
        <button type="button" className="primary-button" onClick={onSolicitarVacaciones}>
          Solicitar vacaciones <span aria-hidden="true">→</span>
        </button>
      </article>

      <article className="panel">
        <div className="panel-heading">
          <span className="panel-icon icon-green" aria-hidden="true">◷</span>
          <span className="panel-kicker">GESTIÓN DE JORNADA</span>
        </div>
        <h3>Permisos por horas</h3>
        <p>La gestión de permisos por horas se habilitará en una próxima versión.</p>
        <button
          type="button"
          className="secondary-button"
          onClick={() => anunciar('El módulo de permisos por horas está en desarrollo.')}
        >Próximamente</button>
      </article>

      <article className="panel">
        <div className="panel-heading">
          <span className="panel-icon icon-amber" aria-hidden="true">＋</span>
          <span className="panel-kicker">JUSTIFICACIONES</span>
        </div>
        <h3>Licencias médicas</h3>
        <p>El registro y seguimiento de licencias médicas aún no está habilitado.</p>
        <button
          type="button"
          className="secondary-button"
          onClick={() => anunciar('El módulo de licencias médicas está en desarrollo.')}
        >Próximamente</button>
      </article>

      <article className="panel panel-wide progress-panel">
        <div>
          <p className="panel-kicker">INFORMACIÓN DEL TRÁMITE</p>
          <h3>Seguimiento de solicitudes</h3>
          <p>El detalle del trámite, las aprobaciones y los documentos estarán disponibles desde cada solicitud.</p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => anunciar('La descarga de comprobantes estará disponible próximamente.')}
        >Descargar comprobante</button>
      </article>
    </>
  );
}
