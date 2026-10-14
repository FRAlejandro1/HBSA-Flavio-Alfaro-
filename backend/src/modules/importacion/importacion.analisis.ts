// Analisis de una plantilla de personal: reconoce las columnas, valida cada fila contra los datos del hospital
// y arma el plan de cambios. Es codigo puro (sin base de datos ni archivos), por eso se prueba con tablas en memoria.
import { z } from 'zod';
import type { CodigoRol } from '../../shared/types/roles';
import { parsearFecha } from '../../shared/utils/fechas';
import { normalizarEncabezado, normalizarTexto } from '../../shared/utils/texto';
import { ROLES_ASIGNABLES } from '../usuarios/usuarios.dominio';
import {
  CAMPOS_IMPORTACION,
  CAMPOS_OBLIGATORIOS,
  ETIQUETAS_CAMPO,
  ROLES_POR_TEXTO,
  SINONIMOS,
} from './importacion.dominio';
import type {
  AccionFila,
  CambiosPersona,
  CampoImportacion,
  ColumnaDetectada,
  DesconocidoRevision,
  FilaRevisada,
  ItemCatalogo,
  MapeoColumnas,
  NuevaPersona,
  PlanAplicacion,
  ResumenImportacion,
  UsuarioExistente,
} from './importacion.dominio';
import type { Celda, TablaCruda } from './lectores/tipos';

export interface ContextoAnalisis {
  // Fecha de hoy en la zona del negocio (AAAA-MM-DD): es la fecha de baja de las personas ausentes
  hoy: string;
  actor: { id: number; rol: CodigoRol };
  areas: readonly ItemCatalogo[];
  cargos: readonly ItemCatalogo[];
  usuarios: readonly UsuarioExistente[];
  bajaAusentes: boolean;
}

export interface DeteccionColumnas {
  columnas: ColumnaDetectada[];
  indices: Partial<Record<CampoImportacion, number>>;
  erroresMapeo: string[];
}

export interface ResultadoAnalisis {
  columnas: ColumnaDetectada[];
  camposSinColumna: CampoImportacion[];
  erroresMapeo: string[];
  filas: FilaRevisada[];
  resumen: ResumenImportacion;
  ausentes: { cedula: string; nombre: string }[];
  desconocidos: { areas: DesconocidoRevision[]; cargos: DesconocidoRevision[] };
  avisos: string[];
  plan: PlanAplicacion;
  puedeAplicar: boolean;
}

type Resultado<T> = { ok: true; valor: T; advertencia?: string } | { ok: false; error: string };

const esquemaCorreo = z.string().email().max(150);
const FORMATO_TELEFONO = /^[0-9+()\- ]{7,20}$/;
const MS_POR_DIA = 86_400_000;

// ---------------------------------------------------------------------------
// Columnas
// ---------------------------------------------------------------------------

// Primero se respeta el mapeo indicado por la persona; las columnas que quedan se reconocen por sinonimos
export function detectarColumnas(
  encabezados: readonly string[],
  mapeoManual: MapeoColumnas,
): DeteccionColumnas {
  const normalizados = encabezados.map(normalizarEncabezado);
  const asignadas = new Map<number, CampoImportacion>();
  const indices: Partial<Record<CampoImportacion, number>> = {};
  const erroresMapeo: string[] = [];

  for (const campo of CAMPOS_IMPORTACION) {
    const nombre = mapeoManual[campo];
    if (nombre === undefined) {
      continue;
    }
    const indice = normalizados.indexOf(normalizarEncabezado(nombre));
    if (indice === -1) {
      erroresMapeo.push(`La columna "${nombre}" indicada para ${ETIQUETAS_CAMPO[campo]} no existe en el archivo`);
    } else if (asignadas.has(indice)) {
      erroresMapeo.push(`La columna "${nombre}" no puede usarse para dos datos distintos`);
    } else {
      indices[campo] = indice;
      asignadas.set(indice, campo);
    }
  }

  for (const campo of CAMPOS_IMPORTACION) {
    if (indices[campo] !== undefined || mapeoManual[campo] !== undefined) {
      continue;
    }
    const sinonimos = SINONIMOS[campo];
    const indice = normalizados.findIndex(
      (normalizado, i) => normalizado !== '' && !asignadas.has(i) && sinonimos.includes(normalizado),
    );
    if (indice !== -1) {
      indices[campo] = indice;
      asignadas.set(indice, campo);
    }
  }

  const columnas = encabezados.map((encabezado, indice) => ({
    indice,
    encabezado,
    campo: asignadas.get(indice) ?? null,
  }));
  return { columnas, indices, erroresMapeo };
}

// ---------------------------------------------------------------------------
// Conversion de valores de celda
// ---------------------------------------------------------------------------

function celdaATexto(celda: Celda): string | null {
  if (celda === null) {
    return null;
  }
  if (celda instanceof Date) {
    return celda.toISOString().slice(0, 10);
  }
  const texto = String(celda).replace(/\s+/g, ' ').trim();
  return texto === '' ? null : texto;
}

// La cedula llega como numero cuando la columna de Excel es numerica: ahi se pierde el cero inicial
export function normalizarCedula(celda: Celda): Resultado<string> {
  const bruto = celda === null ? '' : typeof celda === 'number' ? String(Math.trunc(celda)) : String(celda);
  const digitos = bruto.replace(/[\s.-]/g, '');
  if (digitos === '') {
    return { ok: false, error: 'Falta la cédula' };
  }
  if (!/^\d+$/.test(digitos)) {
    return { ok: false, error: 'La cédula solo debe tener números' };
  }
  if (digitos.length === 9) {
    return {
      ok: true,
      valor: `0${digitos}`,
      advertencia: 'La cédula tenía 9 dígitos: se completó con un cero inicial (Excel lo borra en columnas numéricas)',
    };
  }
  if (digitos.length !== 10) {
    return { ok: false, error: 'La cédula debe tener 10 dígitos' };
  }
  return { ok: true, valor: digitos };
}

// Acepta AAAA-MM-DD, DD/MM/AAAA (dia primero), fechas de Excel y numeros de serie de Excel
export function convertirFecha(celda: Celda): Resultado<string> {
  if (celda === null) {
    return { ok: false, error: 'Falta la fecha' };
  }
  if (celda instanceof Date) {
    return Number.isNaN(celda.getTime())
      ? { ok: false, error: 'Fecha inválida' }
      : { ok: true, valor: celda.toISOString().slice(0, 10) };
  }
  if (typeof celda === 'number') {
    if (celda < 1 || celda > 100_000) {
      return { ok: false, error: 'Fecha inválida' };
    }
    // Los numeros de serie de Excel cuentan los dias desde el 30 de diciembre de 1899
    return { ok: true, valor: new Date(Date.UTC(1899, 11, 30) + Math.round(celda) * MS_POR_DIA).toISOString().slice(0, 10) };
  }
  if (typeof celda !== 'string') {
    return { ok: false, error: 'Fecha inválida' };
  }

  const texto = celda.trim();
  const anioPrimero = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(texto);
  const diaPrimero = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(texto);
  const [anio, mes, dia] = anioPrimero
    ? [anioPrimero[1], anioPrimero[2], anioPrimero[3]]
    : diaPrimero
      ? [diaPrimero[3], diaPrimero[2], diaPrimero[1]]
      : [undefined, undefined, undefined];
  if (anio === undefined || mes === undefined || dia === undefined) {
    return { ok: false, error: `Fecha no reconocida: "${texto}" (usa AAAA-MM-DD o DD/MM/AAAA)` };
  }
  const iso = `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  try {
    parsearFecha(iso);
    return { ok: true, valor: iso };
  } catch {
    return { ok: false, error: `La fecha "${texto}" no existe` };
  }
}

// ---------------------------------------------------------------------------
// Analisis de filas
// ---------------------------------------------------------------------------

type Candidata =
  | { tipo: 'CREAR'; persona: NuevaPersona; cedulaJefe: string | null }
  | { tipo: 'ACTUALIZAR'; id: number; cedula: string; cambios: CambiosPersona; cerrarSesion: boolean; cedulaJefe: string | null }
  | { tipo: 'BAJA'; id: number; fechaBaja: string }
  | { tipo: 'NINGUNA' };

interface Registro {
  revisada: FilaRevisada;
  candidata: Candidata;
  cedulaJefe: string | null;
}

function resumenVacio(): ResumenImportacion {
  return { crear: 0, actualizar: 0, sinCambios: 0, baja: 0, omitidas: 0, conErrores: 0, ausentes: 0 };
}

function indexarCatalogo(items: readonly ItemCatalogo[]): Map<string, number> {
  return new Map(items.map((item) => [normalizarTexto(item.detalle), item.id]));
}

export function analizarTabla(
  tabla: TablaCruda,
  mapeoManual: MapeoColumnas,
  contexto: ContextoAnalisis,
): ResultadoAnalisis {
  const deteccion = detectarColumnas(tabla.encabezados, mapeoManual);
  const camposSinColumna = CAMPOS_OBLIGATORIOS.filter((campo) => deteccion.indices[campo] === undefined);
  const plan: PlanAplicacion = { crear: [], actualizar: [], jefes: [], bajas: [] };
  const base: ResultadoAnalisis = {
    columnas: deteccion.columnas,
    camposSinColumna,
    erroresMapeo: deteccion.erroresMapeo,
    filas: [],
    resumen: resumenVacio(),
    ausentes: [],
    desconocidos: { areas: [], cargos: [] },
    avisos: [],
    plan,
    puedeAplicar: false,
  };
  if (camposSinColumna.length > 0 || deteccion.erroresMapeo.length > 0) {
    return base;
  }

  const { indices } = deteccion;
  const porCedula = new Map(contexto.usuarios.map((u) => [u.cedula, u]));
  const areas = indexarCatalogo(contexto.areas);
  const cargos = indexarCatalogo(contexto.cargos);
  const rolesPermitidos = ROLES_ASIGNABLES[contexto.actor.rol];

  const desconocidosAreas = new Map<string, DesconocidoRevision>();
  const desconocidosCargos = new Map<string, DesconocidoRevision>();
  const cedulaEnFila = new Map<string, number>();
  const correoEnFila = new Map<string, number>();
  const registros: Registro[] = [];

  const anotarDesconocido = (mapa: Map<string, DesconocidoRevision>, nombre: string): void => {
    const clave = normalizarTexto(nombre);
    const actual = mapa.get(clave);
    mapa.set(clave, { nombre: actual?.nombre ?? nombre, filas: (actual?.filas ?? 0) + 1 });
  };

  for (const [posicion, celdas] of tabla.filas.entries()) {
    const numero = posicion + 2;
    const errores: string[] = [];
    const advertencias: string[] = [];
    const valorDe = (campo: CampoImportacion): Celda => {
      const indice = indices[campo];
      return indice === undefined ? null : (celdas[indice] ?? null);
    };
    const textoDe = (campo: CampoImportacion): string | null => celdaATexto(valorDe(campo));
    const textoObligatorio = (campo: CampoImportacion, maximo: number): string | null => {
      const texto = textoDe(campo);
      if (texto === null) {
        errores.push(`Falta ${ETIQUETAS_CAMPO[campo].toLowerCase()}`);
        return null;
      }
      if (texto.length > maximo) {
        errores.push(`${ETIQUETAS_CAMPO[campo]} supera los ${maximo} caracteres`);
        return null;
      }
      return texto;
    };

    // --- cedula ---
    let cedula: string | null = null;
    const cedulaLeida = normalizarCedula(valorDe('cedula'));
    if (cedulaLeida.ok) {
      cedula = cedulaLeida.valor;
      if (cedulaLeida.advertencia !== undefined) {
        advertencias.push(cedulaLeida.advertencia);
      }
    } else {
      errores.push(cedulaLeida.error);
    }

    // --- datos de la persona ---
    const nombres = textoObligatorio('nombres', 100);
    const apellidos = textoObligatorio('apellidos', 100);

    let correo: string | null = null;
    const textoCorreo = textoDe('correo');
    if (textoCorreo !== null) {
      const candidato = textoCorreo.toLowerCase();
      if (esquemaCorreo.safeParse(candidato).success) {
        correo = candidato;
      } else {
        errores.push(`El correo "${textoCorreo}" no es válido`);
      }
    }

    let telefono: string | null = null;
    const textoTelefono = textoDe('telefono');
    if (textoTelefono !== null) {
      if (FORMATO_TELEFONO.test(textoTelefono)) {
        telefono = textoTelefono;
      } else {
        errores.push(`El teléfono "${textoTelefono}" no es válido`);
      }
    }

    // --- area y cargo, siempre por nombre ---
    let areaId: number | null = null;
    const textoArea = textoObligatorio('area', 150);
    if (textoArea !== null) {
      areaId = areas.get(normalizarTexto(textoArea)) ?? null;
      if (areaId === null) {
        errores.push(`El área "${textoArea}" no existe en este hospital`);
        anotarDesconocido(desconocidosAreas, textoArea);
      }
    }
    let cargoId: number | null = null;
    const textoCargo = textoObligatorio('cargo', 150);
    if (textoCargo !== null) {
      cargoId = cargos.get(normalizarTexto(textoCargo)) ?? null;
      if (cargoId === null) {
        errores.push(`El cargo "${textoCargo}" no existe en este hospital`);
        anotarDesconocido(desconocidosCargos, textoCargo);
      }
    }

    // --- fechas ---
    let fechaIngreso: string | null = null;
    const ingresoLeido = convertirFecha(valorDe('fechaIngreso'));
    if (ingresoLeido.ok) {
      fechaIngreso = ingresoLeido.valor;
    } else {
      errores.push(`Fecha de ingreso: ${ingresoLeido.error}`);
    }
    let fechaBaja: string | null = null;
    if (valorDe('fechaBaja') !== null) {
      const bajaLeida = convertirFecha(valorDe('fechaBaja'));
      if (bajaLeida.ok) {
        fechaBaja = bajaLeida.valor;
      } else {
        errores.push(`Fecha de baja: ${bajaLeida.error}`);
      }
    }

    // --- rol y jefe ---
    let rol: CodigoRol | null = null;
    const textoRol = textoDe('rol');
    if (textoRol !== null) {
      rol = ROLES_POR_TEXTO[normalizarEncabezado(textoRol)] ?? null;
      if (rol === null) {
        errores.push(`El rol "${textoRol}" no es válido`);
      }
    }
    let cedulaJefe: string | null = null;
    if (valorDe('cedulaJefe') !== null) {
      const jefeLeido = normalizarCedula(valorDe('cedulaJefe'));
      if (jefeLeido.ok) {
        cedulaJefe = jefeLeido.valor;
        if (cedulaJefe === cedula) {
          errores.push('Una persona no puede ser su propio jefe inmediato');
        }
      } else {
        errores.push(`Cédula del jefe: ${jefeLeido.error}`);
      }
    }

    // --- repeticiones dentro del archivo ---
    if (cedula !== null) {
      const anterior = cedulaEnFila.get(cedula);
      if (anterior === undefined) {
        cedulaEnFila.set(cedula, numero);
      } else {
        errores.push(`La cédula ya aparece en la fila ${anterior}`);
      }
    }
    if (correo !== null) {
      const anterior = correoEnFila.get(correo);
      if (anterior === undefined) {
        correoEnFila.set(correo, numero);
      } else {
        errores.push(`El correo ya aparece en la fila ${anterior}`);
      }
    }

    // --- decision segun si la persona ya existe ---
    const existente = cedula === null ? undefined : porCedula.get(cedula);
    if (correo !== null) {
      const duenio = contexto.usuarios.find((u) => u.correo === correo);
      if (duenio !== undefined && duenio.cedula !== cedula) {
        errores.push(`El correo "${correo}" ya pertenece a otra persona`);
      }
    }
    if (existente !== undefined) {
      if (existente.id === contexto.actor.id) {
        errores.push('No puedes modificarte a ti mismo desde la importación');
      }
      if (!rolesPermitidos.includes(existente.rol)) {
        errores.push(`No puedes gestionar a una persona con el rol ${existente.rol}`);
      }
    }
    if (rol !== null && !rolesPermitidos.includes(rol)) {
      errores.push(`No puedes asignar el rol ${rol}`);
    }

    let candidata: Candidata = { tipo: 'NINGUNA' };
    let accion: AccionFila = 'ERROR';

    if (errores.length === 0 && cedula !== null && nombres !== null && apellidos !== null && areaId !== null && cargoId !== null && fechaIngreso !== null) {
      if (existente === undefined) {
        if (fechaBaja !== null) {
          accion = 'OMITIR';
          advertencias.push('La persona no está en el sistema y ya figura con fecha de baja: no se crea');
        } else {
          accion = 'CREAR';
          candidata = {
            tipo: 'CREAR',
            persona: { cedula, nombres, apellidos, correo, telefono, areaId, cargoId, rol: rol ?? 'EMPLEADO', fechaIngreso },
            cedulaJefe,
          };
        }
      } else if (existente.estado === 'INACTIVO') {
        if (fechaBaja !== null) {
          accion = 'SIN_CAMBIOS';
        } else {
          accion = 'OMITIR';
          advertencias.push('La persona está dada de baja en el sistema: reactívala desde Personal si corresponde');
        }
      } else if (fechaBaja !== null) {
        accion = 'BAJA';
        candidata = { tipo: 'BAJA', id: existente.id, fechaBaja };
      } else {
        // Solo cambia lo que difiere; una celda vacia en un dato opcional no borra lo que ya hay
        const cambios: CambiosPersona = {};
        if (nombres !== existente.nombres) cambios.nombres = nombres;
        if (apellidos !== existente.apellidos) cambios.apellidos = apellidos;
        if (correo !== null && correo !== existente.correo) cambios.correo = correo;
        if (telefono !== null && telefono !== existente.telefono) cambios.telefono = telefono;
        if (areaId !== existente.areaId) cambios.areaId = areaId;
        if (cargoId !== existente.cargoId) cambios.cargoId = cargoId;
        if (rol !== null && rol !== existente.rol) cambios.rol = rol;
        if (fechaIngreso !== existente.fechaIngreso) cambios.fechaIngreso = fechaIngreso;
        const cambiaJefe = cedulaJefe !== null && cedulaJefe !== existente.jefeCedula;

        if (Object.keys(cambios).length === 0 && !cambiaJefe) {
          accion = 'SIN_CAMBIOS';
        } else {
          accion = 'ACTUALIZAR';
          candidata = {
            tipo: 'ACTUALIZAR',
            id: existente.id,
            cedula,
            cambios,
            // Cambiar el rol o el correo obliga a iniciar sesion de nuevo
            cerrarSesion: cambios.rol !== undefined || cambios.correo !== undefined,
            cedulaJefe: cambiaJefe ? cedulaJefe : null,
          };
        }
      }
    }

    registros.push({
      revisada: {
        fila: numero,
        cedula,
        nombre: [apellidos, nombres].filter((parte) => parte !== null).join(' '),
        accion,
        errores,
        advertencias,
      },
      candidata,
      cedulaJefe,
    });
  }

  // El jefe puede ser alguien del hospital o alguien que se crea en este mismo archivo, en cualquier fila
  const cedulasConocidas = new Set<string>(porCedula.keys());
  for (const registro of registros) {
    if (registro.candidata.tipo === 'CREAR') {
      cedulasConocidas.add(registro.candidata.persona.cedula);
    }
  }
  for (const registro of registros) {
    const { candidata } = registro;
    const jefe =
      candidata.tipo === 'CREAR' || candidata.tipo === 'ACTUALIZAR' ? candidata.cedulaJefe : null;
    if (jefe !== null && !cedulasConocidas.has(jefe)) {
      registro.revisada.errores.push(`El jefe inmediato con cédula ${jefe} no existe en el hospital ni en el archivo`);
      registro.revisada.accion = 'ERROR';
      registro.candidata = { tipo: 'NINGUNA' };
    }
  }

  // Plan: solo lo que no tiene errores
  for (const registro of registros) {
    const { candidata } = registro;
    if (registro.revisada.errores.length > 0) {
      registro.revisada.accion = 'ERROR';
      continue;
    }
    if (candidata.tipo === 'CREAR') {
      plan.crear.push(candidata.persona);
      if (candidata.cedulaJefe !== null) {
        plan.jefes.push({ cedula: candidata.persona.cedula, cedulaJefe: candidata.cedulaJefe });
      }
    } else if (candidata.tipo === 'ACTUALIZAR') {
      plan.actualizar.push({
        id: candidata.id,
        cedula: candidata.cedula,
        cambios: candidata.cambios,
        cerrarSesion: candidata.cerrarSesion,
      });
      if (candidata.cedulaJefe !== null) {
        plan.jefes.push({ cedula: candidata.cedula, cedulaJefe: candidata.cedulaJefe });
      }
    } else if (candidata.tipo === 'BAJA') {
      plan.bajas.push({ id: candidata.id, fechaBaja: candidata.fechaBaja });
    }
  }

  // Quienes no aparecen en el archivo: solo con la opcion pedida, nunca el propio actor ni quien no puede gestionar
  const avisos: string[] = [];
  const ausentes: { cedula: string; nombre: string }[] = [];
  if (contexto.bajaAusentes) {
    for (const usuario of contexto.usuarios) {
      if (
        usuario.estado === 'ACTIVO' &&
        usuario.id !== contexto.actor.id &&
        rolesPermitidos.includes(usuario.rol) &&
        !cedulaEnFila.has(usuario.cedula)
      ) {
        ausentes.push({ cedula: usuario.cedula, nombre: `${usuario.apellidos} ${usuario.nombres}` });
        plan.bajas.push({ id: usuario.id, fechaBaja: contexto.hoy });
      }
    }
    const activos = contexto.usuarios.filter((u) => u.estado === 'ACTIVO').length;
    if (activos > 0 && ausentes.length > activos / 2) {
      avisos.push(
        `Se darían de baja ${ausentes.length} de ${activos} personas activas: revisa que el archivo esté completo`,
      );
    }
  }

  const filas = registros.map((registro) => registro.revisada);
  const resumen = resumenVacio();
  for (const fila of filas) {
    if (fila.accion === 'CREAR') resumen.crear += 1;
    else if (fila.accion === 'ACTUALIZAR') resumen.actualizar += 1;
    else if (fila.accion === 'SIN_CAMBIOS') resumen.sinCambios += 1;
    else if (fila.accion === 'BAJA') resumen.baja += 1;
    else if (fila.accion === 'OMITIR') resumen.omitidas += 1;
    else resumen.conErrores += 1;
  }
  resumen.ausentes = ausentes.length;

  return {
    ...base,
    filas,
    resumen,
    ausentes,
    desconocidos: { areas: [...desconocidosAreas.values()], cargos: [...desconocidosCargos.values()] },
    avisos,
    plan,
    puedeAplicar:
      resumen.conErrores === 0 && resumen.crear + resumen.actualizar + resumen.baja + resumen.ausentes > 0,
  };
}