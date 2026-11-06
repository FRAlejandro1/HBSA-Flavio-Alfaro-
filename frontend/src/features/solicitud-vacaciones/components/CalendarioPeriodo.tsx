import { useState } from 'react';
import { fechaLocal } from '@/features/solicitud-vacaciones/model/solicitud-vacaciones.utils';

interface Props {
  inicio: string;
  fin: string;
  // Pendiente: los feriados se marcarán cuando exista el contrato de feriados.
  feriados?: readonly string[];
}

interface Celda {
  clave: string;
  numero: number | null;
  clase: string;
}

const NOMBRES_DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

// Mes que se muestra primero: el de la fecha de inicio o, si no hay, el actual
function mesBase(inicio: string): { anio: number; mes: number } {
  const referencia = inicio ? new Date(`${inicio}T12:00:00`) : new Date();

  return { anio: referencia.getFullYear(), mes: referencia.getMonth() };
}

function armarCeldas(
  anio: number,
  mes: number,
  inicio: string,
  fin: string,
  feriados: readonly string[],
): Celda[] {
  const celdas: Celda[] = [];
  // La semana empieza en lunes
  const vacios = (new Date(anio, mes, 1).getDay() + 6) % 7;
  const totalDias = new Date(anio, mes + 1, 0).getDate();

  for (let indice = 0; indice < vacios; indice += 1) {
    celdas.push({
      clave: `vacio-${indice}`,
      numero: null,
      clase: 'vacation-dia vacation-dia-vacio',
    });
  }

  for (let dia = 1; dia <= totalDias; dia += 1) {
    const fecha = new Date(anio, mes, dia);
    const texto = fechaLocal(fecha);
    const diaSemana = fecha.getDay();
    const finDeSemana = diaSemana === 0 || diaSemana === 6;
    const feriado = feriados.includes(texto);
    const enRango =
      inicio !== '' && texto >= inicio && texto <= (fin || inicio);

    const clases = ['vacation-dia'];
    if (finDeSemana) clases.push('vacation-dia-fin-de-semana');
    if (feriado) clases.push('vacation-dia-feriado');
    if (enRango && !finDeSemana && !feriado) {
      clases.push('vacation-dia-periodo');
    }
    if (enRango && (finDeSemana || feriado)) {
      clases.push('vacation-dia-en-rango');
    }

    celdas.push({ clave: texto, numero: dia, clase: clases.join(' ') });
  }

  return celdas;
}

export function CalendarioPeriodo({ inicio, fin, feriados = [] }: Props) {
  const [desplazamiento, setDesplazamiento] = useState(0);

  const base = mesBase(inicio);
  const visible = new Date(base.anio, base.mes + desplazamiento, 1);
  const anio = visible.getFullYear();
  const mes = visible.getMonth();

  const nombreMes = new Intl.DateTimeFormat('es-EC', {
    month: 'long',
    year: 'numeric',
  }).format(visible);

  const celdas = armarCeldas(anio, mes, inicio, fin, feriados);
  const resumen =
    inicio && fin
      ? `período del ${inicio} al ${fin}`
      : 'sin período seleccionado';

  return (
    <div className="vacation-calendario">
      <div className="vacation-calendario-encabezado">
        <button
          type="button"
          className="vacation-calendario-nav"
          aria-label="Mes anterior"
          onClick={() => setDesplazamiento((actual) => actual - 1)}
        >
          ‹
        </button>
        <span className="vacation-calendario-mes">{nombreMes}</span>
        <button
          type="button"
          className="vacation-calendario-nav"
          aria-label="Mes siguiente"
          onClick={() => setDesplazamiento((actual) => actual + 1)}
        >
          ›
        </button>
      </div>

      <div
        className="vacation-calendario-rejilla"
        role="img"
        aria-label={`Calendario de ${nombreMes}: ${resumen}`}
      >
        {NOMBRES_DIAS.map((nombre) => (
          <span
            className="vacation-dia vacation-dia-nombre"
            key={nombre}
          >
            {nombre}
          </span>
        ))}

        {celdas.map((celda) => (
          <span className={celda.clase} key={celda.clave}>
            {celda.numero}
          </span>
        ))}
      </div>

      <ul className="vacation-leyenda">
        <li>
          <span
            className="vacation-leyenda-marca vacation-dia-periodo"
            aria-hidden="true"
          />
          Período solicitado
        </li>
        <li>
          <span
            className="vacation-leyenda-marca vacation-dia-fin-de-semana"
            aria-hidden="true"
          />
          Fin de semana
        </li>
        <li>
          <span
            className="vacation-leyenda-marca vacation-dia-feriado"
            aria-hidden="true"
          />
          Feriado (se marcará al conectar los feriados)
        </li>
      </ul>
    </div>
  );
}