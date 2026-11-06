/**
 * Presenta la cronología de aprobación de una solicitud.
 * Permite desplegar el detalle de cada paso de la ruta.
 */
import { useId, useState } from 'react';
import type { ReactNode } from 'react';

export interface ItemSeguimiento {
  clave: string;
  clase: string;
  marcador: string;
  mensaje: string;
  chip: { texto: string; clase: string };
  detalle: ReactNode;
}

interface Props {
  items: ItemSeguimiento[];
  solicitudId: number;
}

export function SolicitudRutaAprobacion({
  items,
  solicitudId,
}: Props) {
  const identificador = useId();

  // Los pasos abiertos pertenecen a una solicitud concreta.
  const [abiertos, setAbiertos] = useState<{
    solicitudId: number;
    claves: string[];
  }>({ solicitudId: 0, claves: [] });

  const clavesAbiertas =
    abiertos.solicitudId === solicitudId ? abiertos.claves : [];

  function alternarPaso(clave: string) {
    setAbiertos((actual) => {
      const base =
        actual.solicitudId === solicitudId ? actual.claves : [];

      return {
        solicitudId,
        claves: base.includes(clave)
          ? base.filter((existente) => existente !== clave)
          : [...base, clave],
      };
    });
  }

  return (
    <section
      className="tracking-timeline-panel"
      aria-labelledby={`${identificador}-title`}
    >
      <h3 id={`${identificador}-title`}>Ruta de aprobación</h3>

      <ol className="tracking-timeline">
        {items.map((item) => {
          const abierto = clavesAbiertas.includes(item.clave);
          const idDetalle = `${identificador}-detail-${solicitudId}-${item.clave}`;

          return (
            <li
              className={`tracking-step ${item.clase}`}
              key={item.clave}
            >
              <span className="tracking-marker" aria-hidden="true">
                {item.marcador}
              </span>

              <div className="tracking-step-content">
                <button
                  type="button"
                  className="tracking-step-toggle"
                  aria-expanded={abierto}
                  aria-controls={idDetalle}
                  onClick={() => alternarPaso(item.clave)}
                >
                  <span>{item.mensaje}</span>
                  <span
                    className="tracking-step-chevron"
                    aria-hidden="true"
                  >
                    {abierto ? '▴' : '▾'}
                  </span>
                </button>

                {abierto && (
                  <div
                    id={idDetalle}
                    className="tracking-step-detail"
                  >
                    <span className={item.chip.clase}>
                      {item.chip.texto}
                    </span>
                    {item.detalle}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}