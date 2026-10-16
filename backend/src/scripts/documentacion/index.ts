// Comando que genera la documentacion del sistema en archivos Markdown, sin codigo, leyendo el repositorio.
// Uso: npm run docs:generar -w backend -- [--salida <carpeta>] [--cobertura <carpeta>]
// Por defecto escribe en docs/generada. Lo ejecuta el flujo de integracion continua al final de la validacion.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  generarApi,
  generarArquitectura,
  generarBaseDeDatos,
  generarCambios,
  generarDecisiones,
  generarFrontend,
  generarIndice,
} from './generadores';
import type { DocumentoGenerado } from './generadores';

// Valor que sigue a una opcion: --salida docs/generada
function leerOpcion(argumentos: readonly string[], nombre: string): string | undefined {
  const posicion = argumentos.indexOf(nombre);
  return posicion === -1 ? undefined : argumentos[posicion + 1];
}

async function principal(): Promise<void> {
  const raiz = path.resolve(__dirname, '../../../..');
  const argumentos = process.argv.slice(2);
  const salida = path.resolve(raiz, leerOpcion(argumentos, '--salida') ?? 'docs/generada');
  const cobertura = leerOpcion(argumentos, '--cobertura');

  const documentos: DocumentoGenerado[] = [
    await generarArquitectura(raiz),
    await generarBaseDeDatos(raiz),
    await generarApi(raiz),
    await generarFrontend(raiz),
    await generarDecisiones(raiz),
    await generarCambios(raiz),
  ];
  const indice = await generarIndice(
    raiz,
    documentos,
    cobertura === undefined ? undefined : path.resolve(raiz, cobertura),
  );

  await mkdir(salida, { recursive: true });
  for (const documento of [indice, ...documentos]) {
    await writeFile(path.join(salida, documento.archivo), documento.contenido, 'utf8');
    process.stdout.write(`Generado: ${path.join(salida, documento.archivo)}\n`);
  }
}

principal().catch((error: unknown) => {
  process.stderr.write(`No se pudo generar la documentacion: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});