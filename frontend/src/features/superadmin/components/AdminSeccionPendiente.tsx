import type { CSSProperties, FormEvent } from 'react';
import type {
  CampoAdmin,
  SeccionAdmin,
} from '@/features/superadmin/model/superadmin.types';

interface Props {
  seccion: SeccionAdmin;
  anunciar: (mensaje: string) => void;
}

interface CampoProps {
  idBase: string;
  campo: CampoAdmin;
  // Los filtros ya traen su primera opción («Todos»); los demás empiezan en «Seleccione…»
  conMarcador: boolean;
}

function mensajeEnDesarrollo(funcion: string): string {
  return `La función «${funcion}» está en desarrollo.`;
}

function Campo({ idBase, campo, conMarcador }: CampoProps) {
  const id = `${idBase}-${campo.id}`;
  const idAyuda = campo.ayuda ? `${id}-ayuda` : undefined;
  const opciones = campo.opciones ?? [];

  return (
    <div
      className={`admin-campo${campo.tipo === 'textarea' ? ' admin-campo-ancho' : ''}`}
    >
      <label htmlFor={id}>
        {campo.etiqueta}
        {campo.requerido && <span aria-hidden="true"> *</span>}
      </label>

      {campo.tipo === 'seleccion' && (
        <select
          id={id}
          aria-required={campo.requerido}
          aria-describedby={idAyuda}
          defaultValue={conMarcador ? '' : (opciones[0] ?? '')}
        >
          {conMarcador && (
            <option value="">
              {opciones.length > 0
                ? 'Seleccione…'
                : 'Se cargará desde el servidor'}
            </option>
          )}
          {opciones.map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion}
            </option>
          ))}
        </select>
      )}

      {campo.tipo === 'textarea' && (
        <textarea
          id={id}
          rows={3}
          aria-required={campo.requerido}
          aria-describedby={idAyuda}
        />
      )}

      {campo.tipo === 'texto' && (
        <input
          id={id}
          type="text"
          aria-required={campo.requerido}
          aria-describedby={idAyuda}
        />
      )}

      {campo.ayuda && (
        <span id={idAyuda} className="admin-ayuda">
          {campo.ayuda}
        </span>
      )}
    </div>
  );
}

// Pantalla de administración que todavía no está conectada: se ve completa y avisa «en desarrollo» al usarla
export function AdminSeccionPendiente({ seccion, anunciar }: Props) {
  const detalle = seccion.detalle;

  if (!detalle) {
    return null;
  }

  const idBase = `admin-${seccion.id}`;
  const filtros = detalle.filtros ?? [];
  const acciones = detalle.acciones ?? [];
  const columnas = detalle.columnas ?? [];
  const hayHerramientas =
    Boolean(detalle.buscador) || filtros.length > 0 || acciones.length > 0;

  function avisar(funcion: string) {
    anunciar(mensajeEnDesarrollo(funcion));
  }

  function buscar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    avisar('Buscar');
  }

  function enviarFormulario(
    evento: FormEvent<HTMLFormElement>,
    accion: string,
  ) {
    evento.preventDefault();
    avisar(accion);
  }

  const herramientas = hayHerramientas && (
    <form
      className="admin-herramientas"
      role={detalle.buscador ? 'search' : undefined}
      aria-label="Herramientas de la pantalla"
      onSubmit={buscar}
    >
      {detalle.buscador && (
        <div className="admin-campo admin-campo-buscador">
          <label htmlFor={`${idBase}-buscar`}>{detalle.buscador}</label>
          <input id={`${idBase}-buscar`} type="search" />
        </div>
      )}

      {filtros.map((filtro) => (
        <Campo
          key={filtro.id}
          idBase={`${idBase}-filtro`}
          campo={filtro}
          conMarcador={false}
        />
      ))}

      <div className="admin-acciones">
        {detalle.buscador && (
          <button type="submit" className="secondary-button">
            Buscar
          </button>
        )}

        {acciones.map((accion, indice) => (
          <button
            key={accion}
            type="button"
            className={indice === 0 ? 'primary-button' : 'secondary-button'}
            onClick={() => avisar(accion)}
          >
            {accion}
          </button>
        ))}
      </div>
    </form>
  );

  const formulario = detalle.formulario && (
    <div className="admin-bloque">
      <h2>{detalle.formulario.titulo}</h2>
      <form
        className="admin-formulario"
        aria-label={detalle.formulario.titulo}
        onSubmit={(evento) =>
          enviarFormulario(evento, detalle.formulario?.accion ?? 'Guardar')
        }
        noValidate
      >
        {detalle.formulario.campos.map((campo) => (
          <Campo
            key={campo.id}
            idBase={idBase}
            campo={campo}
            conMarcador
          />
        ))}

        <div className="admin-formulario-acciones">
          <button type="submit" className="primary-button">
            {detalle.formulario.accion}
          </button>
        </div>
      </form>
    </div>
  );

  const tabla = columnas.length > 0 && (
    <div className="admin-bloque">
      {detalle.tituloTabla && <h2>{detalle.tituloTabla}</h2>}

      <div
        className="admin-tabla"
        style={{ '--columnas': String(columnas.length) } as CSSProperties}
        aria-hidden="true"
      >
        <div className="admin-tabla-encabezado">
          {columnas.map((columna) => (
            <span key={columna}>{columna}</span>
          ))}
        </div>

        {[0, 1, 2].map((fila) => (
          <div className="admin-fila" key={fila}>
            {columnas.map((columna) => (
              <span key={columna}>
                <span className="admin-barra" />
              </span>
            ))}
          </div>
        ))}
      </div>

      <span className="admin-ayuda">
        Aquí se listarán: {columnas.join(', ').toLowerCase()}. Se mostrarán al
        conectar la pantalla con el servidor.
      </span>
    </div>
  );

  return (
    <div className="admin-vista">
      <section
        className="panel admin-panel"
        aria-label={seccion.titulo}
      >
        <div className="admin-aviso" role="note">
          <span className="count-chip">En desarrollo</span>
          <span className="admin-aviso-texto">
            {seccion.descripcion} Así se verá la pantalla; las acciones se
            habilitarán al conectarla con el servidor.
          </span>
        </div>

        {herramientas}

        {detalle.formularioPrimero ? (
          <>
            {formulario}
            {tabla}
          </>
        ) : (
          <>
            {tabla}
            {formulario}
          </>
        )}
      </section>
    </div>
  );
}