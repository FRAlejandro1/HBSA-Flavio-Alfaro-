export function RutaAprobacion() {
  return (
    <section
      className="panel vacation-panel"
      aria-labelledby="sv-ruta-titulo"
    >
      <h2 id="sv-ruta-titulo" className="vacation-titulo">
        Quién la aprueba
      </h2>

      <ol className="vacation-ruta">
        <li>
          <span
            className="vacation-ruta-punto vacation-ruta-punto-inicio"
            aria-hidden="true"
          />
          <div className="vacation-ruta-detalle">
            <strong>Usted envía</strong>
          </div>
        </li>

        {/* Pendiente: el nombre de quien aprueba saldrá de la ruta según su nivel. */}
        <li>
          <span className="vacation-ruta-punto" aria-hidden="true" />
          <div className="vacation-ruta-detalle">
            <strong>Aprobación según su ruta</strong>
            <span>
              El nombre de quien aprueba se mostrará cuando se conecte la ruta.
            </span>
          </div>
        </li>

        <li>
          <span className="vacation-ruta-punto" aria-hidden="true" />
          <div className="vacation-ruta-detalle">
            <strong>Enviado a Talento Humano</strong>
          </div>
        </li>

        <li>
          <span className="vacation-ruta-punto" aria-hidden="true" />
          <div className="vacation-ruta-detalle">
            <strong>Verificado por Talento Humano</strong>
          </div>
        </li>
      </ol>
    </section>
  );
}