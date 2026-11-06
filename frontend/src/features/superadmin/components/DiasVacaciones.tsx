import { useState } from 'react';
import type { FormEvent } from 'react';
import type { UsuarioAutenticado } from '@/features/auth/auth.types';
import {
  fijarDias,
  obtenerDias,
} from '@/features/superadmin/api/superadmin.api';
import type {
  ConfiguracionDias,
  ObjetivoDias,
  OrigenDias,
} from '@/features/superadmin/model/superadmin.types';

interface Props {
  usuario: UsuarioAutenticado;
  anunciar: (mensaje: string) => void;
}

const ORIGENES: Record<OrigenDias, string> = {
  PROPIO: 'Valor propio',
  HEREDADO: 'Heredado de un área superior',
  PREDETERMINADO: 'Valor por defecto del hospital',
};

const FORMATO_DIAS = new Intl.NumberFormat('es-EC', {
  maximumFractionDigits: 2,
});

// Días positivos, de medio en medio y hasta 366 (la misma regla que valida el servidor)
function leerDias(texto: string): number | null {
  if (texto.trim() === '') {
    return null;
  }

  const valor = Number(texto.replace(',', '.'));

  if (!Number.isFinite(valor) || valor <= 0 || valor > 366) {
    return null;
  }

  return Math.round(valor * 2) === valor * 2 ? valor : null;
}

function textoDeDias(dias: number | null): string {
  return dias === null ? '' : String(dias);
}

export function DiasVacaciones({ usuario, anunciar }: Props) {
  const [objetivo, setObjetivo] = useState<ObjetivoDias>('areas');
  const [idTexto, setIdTexto] = useState('');
  const [consulta, setConsulta] = useState<{
    objetivo: ObjetivoDias;
    id: number;
  } | null>(null);
  const [configuracion, setConfiguracion] = useState<ConfiguracionDias | null>(
    null,
  );
  const [diasTexto, setDiasTexto] = useState('');
  const [consultando, setConsultando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const esArea = objetivo === 'areas';

  function limpiarResultado() {
    setConsulta(null);
    setConfiguracion(null);
    setDiasTexto('');
    setError('');
  }

  function cambiarObjetivo(nuevo: ObjetivoDias) {
    setObjetivo(nuevo);
    setIdTexto('');
    limpiarResultado();
  }

  function cambiarIdentificador(texto: string) {
    setIdTexto(texto);
    limpiarResultado();
  }

  // Atajo con lo único que se conoce hoy: el área y el usuario de quien tiene la sesión
  function usarMio() {
    setIdTexto(String(esArea ? usuario.area.id : usuario.id));
    limpiarResultado();
  }

  async function consultar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError('');

    const id = Number(idTexto);
    if (!Number.isSafeInteger(id) || id <= 0) {
      setError('Ingrese un identificador numérico mayor que cero.');
      return;
    }

    setConsultando(true);
    try {
      const respuesta = await obtenerDias(objetivo, id);
      setConsulta({ objetivo, id });
      setConfiguracion(respuesta.configuracion);
      setDiasTexto(textoDeDias(respuesta.configuracion.diasVacaciones));
    } catch (desconocido) {
      setConsulta(null);
      setConfiguracion(null);
      setError(
        desconocido instanceof Error
          ? desconocido.message
          : 'No se pudo consultar la configuración de días.',
      );
    } finally {
      setConsultando(false);
    }
  }

  async function guardar(dias: number | null) {
    if (!consulta) {
      return;
    }

    setError('');
    setGuardando(true);
    try {
      const respuesta = await fijarDias(consulta.objetivo, consulta.id, dias);
      setConfiguracion(respuesta.configuracion);
      setDiasTexto(textoDeDias(respuesta.configuracion.diasVacaciones));
      anunciar(
        dias === null
          ? 'Se quitó el valor propio de días de vacaciones.'
          : 'Los días de vacaciones se guardaron correctamente.',
      );
    } catch (desconocido) {
      setError(
        desconocido instanceof Error
          ? desconocido.message
          : 'No se pudieron guardar los días de vacaciones.',
      );
    } finally {
      setGuardando(false);
    }
  }

  function enviarDias(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    const dias = leerDias(diasTexto);
    if (dias === null) {
      setError('Ingrese los días de 0,5 en 0,5, mayores que cero y hasta 366.');
      return;
    }

    void guardar(dias);
  }

  return (
    <div className="admin-vista">
      <section className="panel admin-panel" aria-labelledby="dias-seleccion-titulo">
        <h2 id="dias-seleccion-titulo">Área o persona</h2>

        <form
          className="admin-cuerpo"
          onSubmit={(evento) => void consultar(evento)}
          noValidate
        >
          <fieldset className="dias-objetivo">
            <legend>¿Qué desea configurar?</legend>

            <label className="dias-opcion" htmlFor="dias-objetivo-areas">
              <input
                id="dias-objetivo-areas"
                type="radio"
                name="dias-objetivo"
                checked={esArea}
                onChange={() => cambiarObjetivo('areas')}
              />
              Un área o subárea
            </label>

            <label className="dias-opcion" htmlFor="dias-objetivo-usuarios">
              <input
                id="dias-objetivo-usuarios"
                type="radio"
                name="dias-objetivo"
                checked={!esArea}
                onChange={() => cambiarObjetivo('usuarios')}
              />
              Una persona
            </label>
          </fieldset>

          <div className="dias-consulta">
            <div className="admin-campo">
              <label htmlFor="dias-identificador">
                {esArea ? 'Identificador del área' : 'Identificador de la persona'}
              </label>
              <input
                id="dias-identificador"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={idTexto}
                aria-describedby="dias-identificador-ayuda"
                onChange={(evento) => cambiarIdentificador(evento.target.value)}
              />
              <span id="dias-identificador-ayuda" className="admin-ayuda">
                Todavía no hay un listado para elegir: escriba el número o use el
                botón de al lado.
              </span>
            </div>

            <div className="admin-acciones">
              <button
                type="button"
                className="secondary-button"
                onClick={usarMio}
              >
                {esArea ? 'Usar mi área' : 'Usar mi usuario'}
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={consultando}
              >
                {consultando ? 'Consultando…' : 'Consultar'}
              </button>
            </div>
          </div>

          <span className="admin-ayuda">
            Rige el valor de la persona; si no tiene, el de su área (o el de un
            área superior); y si tampoco, el valor por defecto del hospital.
          </span>
        </form>
      </section>

      {error && (
        <p className="feedback feedback-error" role="alert">
          {error}
        </p>
      )}

      {configuracion && consulta && (
        <section
          className="panel admin-panel"
          aria-labelledby="dias-resultado-titulo"
        >
          <h2 id="dias-resultado-titulo">
            Días de {consulta.objetivo === 'areas' ? 'el área' : 'la persona'} n.º{' '}
            {consulta.id}
          </h2>

          <div className="admin-cuerpo">
            <dl className="dias-resumen">
              <div>
                <dt>Días propios</dt>
                <dd>
                  {configuracion.diasVacaciones === null
                    ? 'Sin valor propio'
                    : FORMATO_DIAS.format(configuracion.diasVacaciones)}
                </dd>
              </div>
              <div>
                <dt>Días que rigen</dt>
                <dd>{FORMATO_DIAS.format(configuracion.diasEfectivos)}</dd>
              </div>
              <div>
                <dt>Origen</dt>
                <dd>{ORIGENES[configuracion.origen]}</dd>
              </div>
            </dl>

            <form className="admin-cuerpo" onSubmit={enviarDias} noValidate>
              <div className="admin-campo dias-campo-dias">
                <label htmlFor="dias-valor">Días por período</label>
                <input
                  id="dias-valor"
                  type="number"
                  inputMode="decimal"
                  min={0.5}
                  max={366}
                  step={0.5}
                  value={diasTexto}
                  aria-describedby="dias-valor-ayuda"
                  onChange={(evento) => setDiasTexto(evento.target.value)}
                />
                <span id="dias-valor-ayuda" className="admin-ayuda">
                  De 0,5 en 0,5, hasta 366. El cambio queda registrado en la
                  bitácora.
                </span>
              </div>

              <div className="admin-acciones">
                <button
                  type="submit"
                  className="primary-button"
                  disabled={guardando}
                >
                  {guardando ? 'Guardando…' : 'Guardar días'}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={guardando || configuracion.diasVacaciones === null}
                  onClick={() => void guardar(null)}
                >
                  Quitar valor propio
                </button>
              </div>
            </form>
          </div>
        </section>
      )}
    </div>
  );
}