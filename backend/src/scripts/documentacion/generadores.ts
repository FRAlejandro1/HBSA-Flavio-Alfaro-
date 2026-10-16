// Generadores de documentacion: leen el repositorio y arman archivos Markdown en lenguaje sencillo, sin codigo.
// La fuente de cada dato es el propio proyecto: comentarios de encabezado, migraciones, rutas, commits,
// decisiones tecnicas y reportes de cobertura. Si el codigo cambia, la documentacion cambia con el.
import { execFile } from 'node:child_process';
import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  ETIQUETAS_COMMIT,
  analizarCommits,
  analizarMigracion,
  analizarMontajes,
  analizarRutas,
  comentarioEncabezado,
  humanizar,
  resumirLcov,
} from './analizadores';
import type { CommitAnalizado } from './analizadores';

const ejecutar = promisify(execFile);

export interface DocumentoGenerado {
  archivo: string;
  titulo: string;
  // Una linea que describe el documento, para el indice
  resumen: string;
  contenido: string;
}

// Nombre de cada capa segun el sufijo del archivo: usuarios.service.ts -> Servicio
const NOMBRES_CAPA: Record<string, string> = {
  routes: 'Rutas',
  controller: 'Controlador',
  service: 'Servicio',
  repository: 'Repositorio',
  validators: 'Validaciones',
  dominio: 'Dominio',
  modulo: 'Composición',
};

const NOMBRES_COBERTURA: Record<string, string> = {
  'cobertura-be-unit': 'Backend: unitarias',
  'cobertura-be-integracion-modulos': 'Backend: integración de módulos',
  'cobertura-be-integracion-bd': 'Backend: integración de repositorios (MySQL real)',
  'cobertura-be-e2e': 'Backend: E2E (MySQL y Redis reales)',
  'cobertura-fe-unit': 'Frontend: unitarias',
};

// Lee un archivo; si no existe devuelve texto vacio
async function leerOpcional(ruta: string): Promise<string> {
  try {
    return await readFile(ruta, 'utf8');
  } catch {
    return '';
  }
}

async function listarDirectorios(directorio: string): Promise<string[]> {
  const entradas = await readdir(directorio, { withFileTypes: true }).catch((): Dirent[] => []);
  return entradas
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => entrada.name)
    .sort();
}

// Archivos con la extension indicada; devuelve rutas relativas al directorio
async function listarArchivos(
  directorio: string,
  extension: RegExp,
  recursivo: boolean,
  prefijo = '',
): Promise<string[]> {
  const entradas = await readdir(path.join(directorio, prefijo), { withFileTypes: true }).catch(
    (): Dirent[] => [],
  );
  const resultado: string[] = [];
  for (const entrada of [...entradas].sort((a, b) => a.name.localeCompare(b.name))) {
    const relativa = prefijo === '' ? entrada.name : `${prefijo}/${entrada.name}`;
    if (entrada.isDirectory()) {
      if (recursivo) {
        resultado.push(...(await listarArchivos(directorio, extension, true, relativa)));
      }
    } else if (extension.test(entrada.name) && !/\.test\./.test(entrada.name)) {
      resultado.push(relativa);
    }
  }
  return resultado;
}

interface ArchivoDescrito {
  nombre: string;
  descripcion: string;
}

async function describirArchivos(directorio: string, recursivo: boolean): Promise<ArchivoDescrito[]> {
  const nombres = await listarArchivos(directorio, /\.(ts|tsx)$/, recursivo);
  const descritos: ArchivoDescrito[] = [];
  for (const nombre of nombres) {
    const contenido = await leerOpcional(path.join(directorio, nombre));
    descritos.push({ nombre, descripcion: comentarioEncabezado(contenido) || 'Sin descripción.' });
  }
  return descritos;
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Una linea de lista por archivo; en los modulos se antepone la capa a la que pertenece
function lineaDeArchivo(archivo: ArchivoDescrito, conCapa: boolean): string {
  if (conCapa) {
    const sufijo = archivo.nombre.replace(/\.(ts|tsx)$/, '').split('.').pop() ?? '';
    const capa = NOMBRES_CAPA[sufijo];
    if (capa !== undefined) {
      return `- **${capa}** (${archivo.nombre}): ${archivo.descripcion}`;
    }
  }
  return `- **${archivo.nombre}**: ${archivo.descripcion}`;
}

// Seccion con la lista de archivos de una carpeta; si no existe o esta vacia lo dice
async function seccionDeCarpeta(
  titulo: string,
  introduccion: string,
  directorio: string,
  recursivo = false,
): Promise<string[]> {
  const archivos = await describirArchivos(directorio, recursivo);
  const lineas = [`## ${titulo}`, '', introduccion, ''];
  if (archivos.length === 0) {
    lineas.push('Todavía no hay archivos aquí.', '');
  } else {
    lineas.push(...archivos.map((archivo) => lineaDeArchivo(archivo, false)), '');
  }
  return lineas;
}

// Una subseccion por cada modulo de una carpeta "modules"
async function seccionDeModulos(directorio: string, conCapa: boolean): Promise<string[]> {
  const lineas: string[] = [];
  const modulos = await listarDirectorios(directorio);
  for (const modulo of modulos) {
    const archivos = await describirArchivos(path.join(directorio, modulo), false);
    lineas.push(`### ${capitalizar(humanizar(modulo))}`, '');
    lineas.push(...archivos.map((archivo) => lineaDeArchivo(archivo, conCapa)), '');
  }
  if (modulos.length === 0) {
    lineas.push('Todavía no hay módulos.', '');
  }
  return lineas;
}

export async function generarArquitectura(raiz: string): Promise<DocumentoGenerado> {
  const backend = path.join(raiz, 'backend', 'src');
  const lineas: string[] = [
    '# Arquitectura del sistema',
    '',
    'El sistema es un monorepo con tres partes: el backend (la API), el frontend (la aplicación web) y la base de datos. Cada hospital es una empresa que solo ve sus propios datos.',
    '',
    'Este documento se genera solo a partir del código: describe lo que existe hoy tomando el comentario de encabezado de cada archivo.',
    '',
    '## Backend: módulos de dominio',
    '',
    'Cada módulo sigue las mismas capas: rutas, controlador, servicio, repositorio, validaciones y dominio. El servicio concentra las reglas de negocio y el repositorio es el único que habla con la base de datos.',
    '',
    ...(await seccionDeModulos(path.join(backend, 'modules'), true)),
    ...(await seccionDeCarpeta(
      'Backend: middlewares',
      'Pasos que recorre cada petición antes de llegar al módulo: seguridad, sesión, permisos, validación y errores.',
      path.join(backend, 'middlewares'),
    )),
    ...(await seccionDeCarpeta(
      'Backend: configuración',
      'Conexiones y políticas globales. Cambiar de motor de base de datos solo toca la conexión.',
      path.join(backend, 'config'),
    )),
    ...(await seccionDeCarpeta(
      'Backend: piezas compartidas',
      'Herramientas que usan varios módulos: errores, seguridad, tipos y utilidades.',
      path.join(backend, 'shared'),
      true,
    )),
    ...(await seccionDeCarpeta(
      'Backend: comandos',
      'Programas que se ejecutan desde la terminal, como la migración de la base de datos.',
      path.join(backend, 'scripts'),
      true,
    )),
  ];
  return {
    archivo: 'arquitectura.md',
    titulo: 'Arquitectura',
    resumen: 'Cómo está organizado el sistema y qué hace cada pieza.',
    contenido: `${lineas.join('\n')}\n`,
  };
}

export async function generarFrontend(raiz: string): Promise<DocumentoGenerado> {
  const frontend = path.join(raiz, 'frontend', 'src');
  const lineas: string[] = [
    '# Frontend',
    '',
    'Aplicación web de una sola página hecha con React. Las pantallas se cargan solo cuando se necesitan y los datos se piden a la API mediante consultas con caché.',
    '',
    'Este documento se genera solo a partir del código.',
    '',
    ...(await seccionDeCarpeta('Arranque', 'Punto de entrada y proveedores globales.', frontend)),
    ...(await seccionDeCarpeta('Configuración', 'Variables globales y cliente de la API.', path.join(frontend, 'config'))),
    ...(await seccionDeCarpeta('Rutas', 'Navegación y protección por sesión y rol.', path.join(frontend, 'routes'))),
    ...(await seccionDeCarpeta('Hooks', 'Lógica reutilizable de sesión, tema y otros.', path.join(frontend, 'hooks'))),
    ...(await seccionDeCarpeta(
      'Piezas compartidas',
      'Componentes, diseño general y utilidades que usan varias pantallas.',
      path.join(frontend, 'shared'),
      true,
    )),
    '## Módulos',
    '',
    'Cada módulo agrupa una pantalla contenedora, sus componentes, su servicio de datos y su validación.',
    '',
    ...(await seccionDeModulos(path.join(frontend, 'modules'), false)),
  ];
  return {
    archivo: 'frontend.md',
    titulo: 'Frontend',
    resumen: 'Las pantallas y piezas de la aplicación web.',
    contenido: `${lineas.join('\n')}\n`,
  };
}

export async function generarApi(raiz: string): Promise<DocumentoGenerado> {
  const backend = path.join(raiz, 'backend', 'src');
  const montajes = analizarMontajes(await leerOpcional(path.join(backend, 'app.ts')));
  const lineas: string[] = [
    '# API del backend',
    '',
    'Lista de las rutas que ofrece el backend, detectadas del código. Todas las rutas que cambian datos exigen además la marca de seguridad contra ataques desde otros sitios.',
    '',
  ];

  const modulos = await listarDirectorios(path.join(backend, 'modules'));
  for (const modulo of modulos) {
    const rutas = analizarRutas(
      await leerOpcional(path.join(backend, 'modules', modulo, `${modulo}.routes.ts`)),
    );
    if (rutas.length === 0) {
      continue;
    }
    const prefijo = montajes.get(modulo.replace(/-/g, '')) ?? `/api/${modulo}`;
    lineas.push(
      `## ${capitalizar(humanizar(modulo))}`,
      '',
      `Prefijo: \`${prefijo}\``,
      '',
      '| Método | Ruta | Qué hace | Quién puede usarla |',
      '|---|---|---|---|',
    );
    for (const ruta of rutas) {
      const completa = ruta.ruta === '/' ? prefijo : `${prefijo}${ruta.ruta}`;
      lineas.push(`| ${ruta.metodo} | \`${completa}\` | ${capitalizar(ruta.accion)} | ${ruta.acceso} |`);
    }
    lineas.push('');
  }

  const errores = await leerOpcional(path.join(backend, 'shared', 'errors', 'AppError.ts'));
  const codigos = [...errores.matchAll(/^\s+([A-Z_]+):\s*(\d{3}),?\s*$/gm)];
  if (codigos.length > 0) {
    lineas.push(
      '## Errores',
      '',
      'Cuando algo falla, la API responde siempre con un código estable, un mensaje y, a veces, detalles por campo.',
      '',
      '| Código | Estado HTTP |',
      '|---|---|',
      ...codigos.map((coincidencia) => `| ${coincidencia[1] ?? ''} | ${coincidencia[2] ?? ''} |`),
      '',
    );
  }

  return {
    archivo: 'api.md',
    titulo: 'API',
    resumen: 'Las rutas del backend, quién puede usarlas y cómo responde ante errores.',
    contenido: `${lineas.join('\n')}\n`,
  };
}

export async function generarBaseDeDatos(raiz: string): Promise<DocumentoGenerado> {
  const directorio = path.join(raiz, 'database');
  const migraciones = (await readdir(path.join(directorio, 'migrations')).catch(() => [] as string[]))
    .filter((nombre) => nombre.endsWith('.sql'))
    .sort();

  const tablas: { nombre: string; descripcion: string; migracion: string }[] = [];
  const relaciones = new Map<string, Set<string>>();
  const triggers: { nombre: string; descripcion: string }[] = [];
  const lineas: string[] = [
    '# Base de datos',
    '',
    'MySQL 8.0. Cada hospital es una empresa y todas las tablas con datos de negocio guardan a cuál pertenecen. Este documento se genera solo a partir de las migraciones.',
    '',
    '## Migraciones',
    '',
  ];

  for (const migracion of migraciones) {
    const contenido = await leerOpcional(path.join(directorio, 'migrations', migracion));
    const analisis = analizarMigracion(contenido);
    lineas.push(`- **${migracion}**: ${comentarioEncabezado(contenido, '--') || 'Sin descripción.'}`);
    for (const tabla of analisis.tablas) {
      tablas.push({ ...tabla, migracion });
    }
    for (const relacion of analisis.relaciones) {
      if (relacion.desde !== relacion.hacia) {
        relaciones.set(relacion.desde, (relaciones.get(relacion.desde) ?? new Set<string>()).add(relacion.hacia));
      }
    }
    triggers.push(...analisis.triggers);
  }

  lineas.push('', '## Tablas', '', '| Tabla | Para qué sirve | Migración |', '|---|---|---|');
  for (const tabla of tablas) {
    lineas.push(`| ${tabla.nombre} | ${tabla.descripcion || 'Sin descripción.'} | ${tabla.migracion} |`);
  }

  lineas.push('', '## Relaciones entre tablas', '', 'Cada tabla depende de las que aparecen a su derecha.', '');
  for (const [desde, hacia] of [...relaciones].sort((a, b) => a[0].localeCompare(b[0]))) {
    lineas.push(`- **${desde}** depende de: ${[...hacia].join(', ')}`);
  }

  lineas.push('', '## Reglas que cumple la propia base', '');
  if (triggers.length === 0) {
    lineas.push('No hay triggers.');
  } else {
    lineas.push(...triggers.map((trigger) => `- **${trigger.nombre}**: ${trigger.descripcion || 'Sin descripción.'}`));
  }

  lineas.push('', '## Datos iniciales', '');
  const seeds = (await readdir(path.join(directorio, 'seeds')).catch(() => [] as string[]))
    .filter((nombre) => nombre.endsWith('.sql'))
    .sort();
  for (const seed of seeds) {
    const contenido = await leerOpcional(path.join(directorio, 'seeds', seed));
    const solo = seed.includes('_demo') ? ' *(solo desarrollo)*' : '';
    lineas.push(`- **${seed}**${solo}: ${comentarioEncabezado(contenido, '--') || 'Sin descripción.'}`);
  }
  if (seeds.length === 0) {
    lineas.push('No hay datos iniciales.');
  }

  return {
    archivo: 'base-de-datos.md',
    titulo: 'Base de datos',
    resumen: 'Las tablas, sus relaciones y las reglas que garantiza la propia base.',
    contenido: `${lineas.join('\n')}\n`,
  };
}

export async function generarDecisiones(raiz: string): Promise<DocumentoGenerado> {
  const directorio = path.join(raiz, 'docs', 'decisiones');
  const archivos = (await readdir(directorio).catch(() => [] as string[]))
    .filter((nombre) => nombre.endsWith('.md'))
    .sort();

  const decisiones: { titulo: string; fecha: string; estado: string; cuerpo: string }[] = [];
  for (const archivo of archivos) {
    const texto = await leerOpcional(path.join(directorio, archivo));
    const lineasTexto = texto.split(/\r?\n/);
    const titulo = lineasTexto.find((linea) => linea.startsWith('# '))?.slice(2).trim() ?? archivo;
    const fecha = /^- Fecha:\s*(.+)$/m.exec(texto)?.[1]?.trim() ?? '';
    const estado = /^- Estado:\s*(.+)$/m.exec(texto)?.[1]?.trim() ?? '';
    // Los encabezados internos bajan un nivel para quedar dentro del titulo de cada decision
    const cuerpo = lineasTexto
      .filter((linea) => !linea.startsWith('# '))
      .map((linea) => (linea.startsWith('## ') ? `#${linea}` : linea))
      .join('\n')
      .trim();
    decisiones.push({ titulo, fecha, estado, cuerpo });
  }

  const lineas: string[] = [
    '# Decisiones técnicas',
    '',
    'Las decisiones importantes del proyecto, con su motivo y sus consecuencias. Se escriben a mano en la carpeta de decisiones del repositorio y esta página las reúne.',
    '',
    '| Decisión | Fecha | Estado |',
    '|---|---|---|',
    ...decisiones.map((d) => `| ${d.titulo} | ${d.fecha} | ${d.estado} |`),
    '',
  ];
  for (const decision of decisiones) {
    lineas.push(`## ${decision.titulo}`, '', decision.cuerpo, '');
  }

  return {
    archivo: 'decisiones-tecnicas.md',
    titulo: 'Decisiones técnicas',
    resumen: 'Qué se decidió, por qué y qué consecuencias tiene.',
    contenido: `${lineas.join('\n')}\n`,
  };
}

export async function generarCambios(raiz: string): Promise<DocumentoGenerado> {
  let salida = '';
  try {
    const resultado = await ejecutar(
      'git',
      ['log', '--no-merges', '-n', '300', '--date=short', '--pretty=format:%h|%ad|%s'],
      { cwd: raiz, encoding: 'utf8' },
    );
    salida = resultado.stdout;
  } catch {
    salida = '';
  }

  const commits = analizarCommits(salida.split('\n').filter((linea) => linea.trim() !== ''));
  const lineas: string[] = [
    '# Cambios recientes',
    '',
    'Resumen de los últimos cambios del proyecto, agrupados por tipo. Se arma con los mensajes de commit, que siguen un formato fijo.',
    '',
  ];

  if (commits.length === 0) {
    lineas.push('No se pudo leer el historial de cambios.');
  }
  const porTipo = new Map<string, CommitAnalizado[]>();
  for (const commit of commits) {
    porTipo.set(commit.tipo, [...(porTipo.get(commit.tipo) ?? []), commit]);
  }
  for (const [tipo, etiqueta] of Object.entries(ETIQUETAS_COMMIT)) {
    const grupo = porTipo.get(tipo);
    if (grupo === undefined) {
      continue;
    }
    lineas.push(`## ${etiqueta}`, '');
    for (const commit of grupo) {
      const alcance = commit.alcance === null ? '' : `**${commit.alcance}**: `;
      lineas.push(`- ${alcance}${commit.descripcion} (${commit.fecha}, ${commit.hash})`);
    }
    lineas.push('');
  }

  return {
    archivo: 'cambios.md',
    titulo: 'Cambios',
    resumen: 'Qué se agregó, corrigió o mejoró recientemente.',
    contenido: `${lineas.join('\n')}\n`,
  };
}

// Lee los lcov.info que dejo cada job de pruebas: una carpeta por job
async function resumenDeCobertura(carpeta: string | undefined): Promise<string[]> {
  if (carpeta === undefined) {
    return ['La cobertura se incluye cuando el flujo de integración continua entrega los reportes de las pruebas.'];
  }
  const filas: string[] = [];
  for (const nombre of await listarDirectorios(carpeta)) {
    const contenido = await leerOpcional(path.join(carpeta, nombre, 'lcov.info'));
    if (contenido === '') {
      continue;
    }
    const resumen = resumirLcov(contenido);
    const etiqueta = NOMBRES_COBERTURA[nombre] ?? humanizar(nombre);
    filas.push(`| ${etiqueta} | ${resumen.lineas} | ${resumen.cubiertas} | ${resumen.porcentaje} % |`);
  }
  if (filas.length === 0) {
    return ['No se encontraron reportes de cobertura.'];
  }
  return [
    'Cada tipo de prueba mide qué parte del código recorre. Los porcentajes no se suman: unas pruebas cubren partes que otras no.',
    '',
    '| Pruebas | Líneas | Cubiertas | Cobertura |',
    '|---|---|---|---|',
    ...filas,
  ];
}

async function obtenerCommit(raiz: string): Promise<string> {
  try {
    const resultado = await ejecutar('git', ['rev-parse', '--short', 'HEAD'], { cwd: raiz, encoding: 'utf8' });
    return resultado.stdout.trim();
  } catch {
    return 'desconocido';
  }
}

export async function generarIndice(
  raiz: string,
  documentos: readonly DocumentoGenerado[],
  carpetaCobertura?: string,
): Promise<DocumentoGenerado> {
  const paquete = JSON.parse(await leerOpcional(path.join(raiz, 'package.json')) || '{}') as {
    version?: string;
  };
  const fecha = `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;
  const rama = process.env.GITHUB_REF_NAME ?? 'local';

  const lineas: string[] = [
    '# Documentación del sistema',
    '',
    'Sistema de Vacaciones del Personal Hospitalario. Esta documentación se genera sola al final de cada validación del proyecto y explica, sin código, lo que existe y lo que cambió.',
    '',
    '## Contenido',
    '',
    ...documentos.map((documento) => `- [${documento.titulo}](${documento.archivo}): ${documento.resumen}`),
    '',
    '## Versión documentada',
    '',
    `- Versión: ${paquete.version ?? 'sin definir'}`,
    `- Rama: ${rama}`,
    `- Cambio (commit): ${await obtenerCommit(raiz)}`,
    `- Generada: ${fecha}`,
    '',
    '## Cobertura de las pruebas',
    '',
    ...(await resumenDeCobertura(carpetaCobertura)),
    '',
  ];

  return {
    archivo: 'README.md',
    titulo: 'Índice',
    resumen: 'Punto de entrada de la documentación.',
    contenido: `${lineas.join('\n')}\n`,
  };
}