export interface AvisoDashboard {
  solicitudId: number;
  mensaje: string;
}

interface Props {
  aviso: AvisoDashboard | null;
  alVerDetalles: (solicitudId: number) => void;
}

export function DashboardAviso({ aviso, alVerDetalles }: Props) {
  if (!aviso) {
    return null;
  }

  return (
    <section
      className="dashboard-notice dashboard-notice-entrada"
      role="status"
      aria-label="Aviso sobre sus solicitudes"
    >
      <span className="dashboard-notice-icon" aria-hidden="true">
        ✓
      </span>

      <div className="dashboard-notice-content">
        <strong>Aviso</strong>
        <p>{aviso.mensaje}</p>
      </div>

      <button
        type="button"
        className="secondary-button dashboard-notice-action"
        onClick={() => alVerDetalles(aviso.solicitudId)}
      >
        Ver detalles
      </button>
    </section>
  );
}