// Analizadores puros de la documentacion automatica: reciben texto y devuelven datos.
// No leen archivos ni ejecutan comandos, por eso se prueban sin preparar nada.

// Comentario de encabezado de un archivo: las primeras lineas de comentario antes del codigo, unidas en una frase.
// Ignora las lineas decorativas (solo simbolos) y la que solo nombra al archivo SQL.
export function comentarioEncabezado(contenido: string, prefijo: '//' | '--' = '//'): string {
  const lineas: string[] = [];
  for (const linea of contenido.split(/\r?\n/)) {
    const recortada = linea.trim();
    if (prefijo === '//' && recortada.startsWith('///')) {
      continue;
    }
    if (recortada.startsWith(prefijo)) {
      lineas.push(recortada.slice(prefijo.length).replace(/^[-/\s]+/, '').trim());
      continue;
    }
    if (recortada === '' && lineas.length === 0) {
      continue;
    }
    break;
  }
  return lineas.filter((texto) => /[A-Za-z]/.test(texto) && !/^\S+\.sql\b/.test(texto)).join(' ');
}

// "listarAreas" -> "listar areas"; "permisos-hora" -> "permisos hora"
export function humanizar(identificador: string): string {
  return identificador
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_.]+/g, ' ')
    .toLowerCase()
    .trim();
}

export interface RutaDetectada {
  metodo: string;
  ruta: string;
  accion: string;
  acceso: string;
}

// Extrae los nombres de rol escritos entre comillas: 'SUPERADMIN', 'TALENTO_HUMANO'
function listarRoles(argumentos: string): string[] {
  return [...argumentos.matchAll(/'([A-Z_]+)'/g)].flatMap((coincidencia) =>
    coincidencia[1] === undefined ? [] : [coincidencia[1]],
  );
}

// Lee un archivo *.routes.ts y devuelve cada ruta con su metodo, su accion y quien puede usarla
export function analizarRutas(contenido: string): RutaDetectada[] {
  // Constantes del tipo: const administraAreas = authorizeRole('SUPERADMIN');
  const rolesPorVariable = new Map<string, string[]>();
  for (const coincidencia of contenido.matchAll(/const\s+(\w+)\s*=\s*authorizeRole\(([^)]*)\)/g)) {
    const [, nombre, argumentos] = coincidencia;
    if (nombre !== undefined && argumentos !== undefined) {
      rolesPorVariable.set(nombre, listarRoles(argumentos));
    }
  }

  // Lo que se aplica a todo el router: router.use(autenticar, ..., authorizeRole(...))
  let sesionGlobal = false;
  let rolesGlobales: string[] = [];
  for (const coincidencia of contenido.matchAll(/router\.use\(([^;]*?)\);/g)) {
    const cuerpo = coincidencia[1] ?? '';
    if (/\bautenticar\b/.test(cuerpo)) {
      sesionGlobal = true;
    }
    const roles = /authorizeRole\(([^)]*)\)/.exec(cuerpo);
    if (roles?.[1] !== undefined) {
      rolesGlobales = listarRoles(roles[1]);
    }
  }

  const rutas: RutaDetectada[] = [];
  for (const coincidencia of contenido.matchAll(
    /router\.(get|post|put|patch|delete)\(\s*'([^']+)'([^;]*?)\);/g,
  )) {
    const [, metodo, ruta, resto = ''] = coincidencia;
    if (metodo === undefined || ruta === undefined) {
      continue;
    }

    // Roles de esta ruta: directos, por variable o, si no hay, los de todo el router
    let roles: string[] = [];
    const directos = /authorizeRole\(([^)]*)\)/.exec(resto);
    if (directos?.[1] !== undefined) {
      roles = listarRoles(directos[1]);
    } else {
      for (const [nombre, valor] of rolesPorVariable) {
        if (new RegExp(`\\b${nombre}\\b`).test(resto)) {
          roles = valor;
        }
      }
    }
    if (roles.length === 0) {
      roles = rolesGlobales;
    }

    const conSesion = sesionGlobal || /\bautenticar\b/.test(resto);
    let acceso = 'Público';
    if (roles.length > 0) {
      acceso = `Roles: ${roles.join(', ')}`;
    } else if (conSesion) {
      acceso = 'Cualquier persona con sesión iniciada';
    }

    // El nombre del ultimo elemento de la lista es el manejador: c.listarAreas -> "listar areas"
    const manejador = /(\w+)\s*,?\s*$/.exec(resto.trim())?.[1] ?? '';
    rutas.push({ metodo: metodo.toUpperCase(), ruta, accion: humanizar(manejador), acceso });
  }
  return rutas;
}

// Lee app.ts y devuelve, por modulo (en minusculas y sin guiones), el prefijo donde esta montado
export function analizarMontajes(contenidoApp: string): Map<string, string> {
  const montajes = new Map<string, string>();
  for (const coincidencia of contenidoApp.matchAll(/app\.use\('([^']+)',\s*crearRouter(\w+)\(\)\)/g)) {
    const [, prefijo, nombre] = coincidencia;
    if (prefijo !== undefined && nombre !== undefined) {
      montajes.set(nombre.toLowerCase(), prefijo);
    }
  }
  return montajes;
}

export interface AnalisisMigracion {
  tablas: { nombre: string; descripcion: string }[];
  relaciones: { desde: string; hacia: string }[];
  triggers: { nombre: string; descripcion: string }[];
}

// Lee una migracion SQL y devuelve sus tablas, las relaciones entre ellas y sus triggers.
// La descripcion de cada uno es el comentario que lo precede.
export function analizarMigracion(contenido: string): AnalisisMigracion {
  const resultado: AnalisisMigracion = { tablas: [], relaciones: [], triggers: [] };
  const vistas = new Set<string>();
  let comentario = '';
  let tablaActual: string | null = null;

  for (const lineaCruda of contenido.split(/\r?\n/)) {
    const linea = lineaCruda.trim();

    if (linea.startsWith('--')) {
      const texto = linea.replace(/^-+\s*/, '').trim();
      // Solo cuentan los comentarios con letras: se ignoran las lineas decorativas
      if (/[A-Za-z]/.test(texto)) {
        comentario = texto;
      }
      continue;
    }
    if (linea === '') {
      continue;
    }

    const crearTabla = /^CREATE TABLE\s+(?:IF NOT EXISTS\s+)?`?(\w+)`?/i.exec(linea);
    const alterarTabla = /^ALTER TABLE\s+`?(\w+)`?/i.exec(linea);
    const crearTrigger = /^CREATE TRIGGER\s+`?(\w+)`?/i.exec(linea);

    if (crearTabla?.[1] !== undefined) {
      resultado.tablas.push({ nombre: crearTabla[1], descripcion: comentario });
      tablaActual = crearTabla[1];
    } else if (alterarTabla?.[1] !== undefined) {
      tablaActual = alterarTabla[1];
    } else if (crearTrigger?.[1] !== undefined) {
      resultado.triggers.push({ nombre: crearTrigger[1], descripcion: comentario });
    }

    const referencia = /REFERENCES\s+`?(\w+)`?/i.exec(linea);
    if (referencia?.[1] !== undefined && tablaActual !== null) {
      const clave = `${tablaActual}>${referencia[1]}`;
      if (!vistas.has(clave)) {
        vistas.add(clave);
        resultado.relaciones.push({ desde: tablaActual, hacia: referencia[1] });
      }
    }

    comentario = '';
  }
  return resultado;
}

export interface CommitAnalizado {
  hash: string;
  fecha: string;
  tipo: string;
  alcance: string | null;
  descripcion: string;
}

// Titulos con que se muestran los tipos de commit, en el orden en que aparecen
export const ETIQUETAS_COMMIT: Record<string, string> = {
  feat: 'Nuevas funciones',
  fix: 'Correcciones',
  refactor: 'Mejoras internas',
  perf: 'Rendimiento',
  test: 'Pruebas',
  docs: 'Documentación',
  ci: 'Integración continua',
  chore: 'Mantenimiento',
  otros: 'Otros cambios',
};

// Lee lineas "hash|fecha|asunto" y las separa segun Conventional Commits: tipo(alcance): descripcion
export function analizarCommits(lineas: readonly string[]): CommitAnalizado[] {
  const commits: CommitAnalizado[] = [];
  for (const linea of lineas) {
    const [hash, fecha, ...resto] = linea.split('|');
    if (hash === undefined || fecha === undefined || resto.length === 0) {
      continue;
    }
    const asunto = resto.join('|').trim();
    const partes = /^(\w+)(?:\(([^)]+)\))?!?:\s*(.+)$/.exec(asunto);
    const tipo = partes?.[1]?.toLowerCase();

    if (partes?.[3] !== undefined && tipo !== undefined && tipo in ETIQUETAS_COMMIT) {
      commits.push({ hash, fecha, tipo, alcance: partes[2] ?? null, descripcion: partes[3] });
    } else {
      commits.push({ hash, fecha, tipo: 'otros', alcance: null, descripcion: asunto });
    }
  }
  return commits;
}

// Suma las lineas y las lineas cubiertas de un archivo LCOV
export function resumirLcov(contenido: string): { lineas: number; cubiertas: number; porcentaje: number } {
  let lineas = 0;
  let cubiertas = 0;
  for (const linea of contenido.split(/\r?\n/)) {
    const valor = Number.parseFloat(linea.slice(3));
    if (Number.isNaN(valor)) {
      continue;
    }
    if (linea.startsWith('LF:')) {
      lineas += valor;
    } else if (linea.startsWith('LH:')) {
      cubiertas += valor;
    }
  }
  const porcentaje = lineas === 0 ? 0 : Math.round((cubiertas / lineas) * 1000) / 10;
  return { lineas, cubiertas, porcentaje };
}