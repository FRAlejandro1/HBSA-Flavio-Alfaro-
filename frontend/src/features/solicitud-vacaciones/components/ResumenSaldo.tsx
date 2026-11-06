import { ValorPendiente } from '@/features/solicitud-vacaciones/components/ValorPendiente';

export function ResumenSaldo() {
  return (
    <section
      className="panel vacation-panel"
      aria-labelledby="sv-saldo-titulo"
    >
      <h2 id="sv-saldo-titulo" className="vacation-titulo">
        Su saldo
      </h2>

      {/* Pendiente: las cifras se alimentarán del contrato de saldo de vacaciones. */}
      <dl className="vacation-saldo">
        <div>
          <dt>Disponibles</dt>
          <dd>
            <ValorPendiente />
          </dd>
        </div>

        <div>
          <dt>En trámite</dt>
          <dd>
            <ValorPendiente />
          </dd>
        </div>

        <div>
          <dt>Esta solicitud</dt>
          <dd>
            <ValorPendiente />
          </dd>
        </div>

        <div className="vacation-saldo-total">
          <dt>Le quedarían</dt>
          <dd>
            <ValorPendiente texto="— días" />
          </dd>
        </div>
      </dl>

      <div className="vacation-barra" aria-hidden="true" />
    </section>
  );
}