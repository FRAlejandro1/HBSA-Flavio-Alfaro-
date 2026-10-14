// Reglas de la importacion de personal: lee el archivo, lo analiza contra los datos del hospital y, solo si se
// confirma con la huella de la revision, aplica el plan en una sola transaccion.
// La huella prueba que se envia el mismo archivo y las mismas opciones que se revisaron; no se guarda nada
// entre la revision y la aplicacion porque son datos personales.
import { createHash } from 'node:crypto';
import { AppError } from '../../shared/errors/AppError';
import type { UsuarioAutenticado } from '../../shared/types/autenticacion';
import { CAMPOS_IMPORTACION } from './importacion.dominio';
import type { OpcionesImportacion, ResultadoAplicacion, Revision } from './importacion.dominio';
import { analizarTabla } from './importacion.analisis';
import type { ResultadoAnalisis } from './importacion.analisis';
import type { IImportacionRepository } from './importacion.repository';
import type { ArchivoSubido, TablaCruda, TipoArchivo } from './lectores/tipos';

export interface DependenciasImportacionService {
  repositorio: IImportacionRepository;
  leerTabla: (archivo: ArchivoSubido) => Promise<{ tipo: TipoArchivo; tabla: TablaCruda }>;
  // Fecha de hoy (AAAA-MM-DD) en la zona del negocio
  hoy: () => string;
}

function calcularHuella(archivo: ArchivoSubido, opciones: OpcionesImportacion, empresaId: number): string {
  // El mapeo se ordena por campo para que el mismo mapeo dé siempre la misma huella
  const mapeo = CAMPOS_IMPORTACION.map((campo) => [campo, opciones.mapeo[campo] ?? null]);
  return createHash('sha256')
    .update(archivo.contenido)
    .update(JSON.stringify([mapeo, opciones.bajaAusentes, empresaId]))
    .digest('hex');
}

export class ImportacionService {
  constructor(private readonly deps: DependenciasImportacionService) {}

  async revisar(
    actor: UsuarioAutenticado,
    archivo: ArchivoSubido,
    opciones: OpcionesImportacion,
  ): Promise<Revision> {
    const { tipo, tabla } = await this.deps.leerTabla(archivo);
    const analisis = await this.analizar(actor, tabla, opciones);
    return {
      huella: calcularHuella(archivo, opciones, actor.empresaId),
      archivo: { nombre: archivo.nombre, tipo, filas: tabla.filas.length },
      columnas: analisis.columnas,
      camposSinColumna: analisis.camposSinColumna,
      erroresMapeo: analisis.erroresMapeo,
      resumen: analisis.resumen,
      filas: analisis.filas,
      ausentes: analisis.ausentes,
      desconocidos: analisis.desconocidos,
      avisos: analisis.avisos,
      puedeAplicar: analisis.puedeAplicar,
    };
  }

  async aplicar(
    actor: UsuarioAutenticado,
    archivo: ArchivoSubido,
    opciones: OpcionesImportacion,
    huella: string,
  ): Promise<ResultadoAplicacion> {
    if (calcularHuella(archivo, opciones, actor.empresaId) !== huella) {
      throw AppError.conflicto('El archivo o las opciones no son los que se revisaron: revísalo de nuevo antes de aplicar');
    }

    // Se vuelve a analizar con los datos de este momento: pudieron cambiar desde la revision
    const { tabla } = await this.deps.leerTabla(archivo);
    const analisis = await this.analizar(actor, tabla, opciones);
    if (analisis.resumen.conErrores > 0 || analisis.camposSinColumna.length > 0 || analisis.erroresMapeo.length > 0) {
      throw AppError.reglaDeNegocio('La revisión tiene errores y no se puede aplicar', {
        conErrores: analisis.resumen.conErrores,
      });
    }
    if (!analisis.puedeAplicar) {
      throw AppError.conflicto('No hay cambios para aplicar');
    }

    await this.deps.repositorio.aplicar(actor.empresaId, analisis.plan);
    return {
      creadas: analisis.resumen.crear,
      actualizadas: analisis.resumen.actualizar,
      bajas: analisis.resumen.baja,
      ausentesDadosDeBaja: analisis.resumen.ausentes,
      sinCambios: analisis.resumen.sinCambios,
    };
  }

  private async analizar(
    actor: UsuarioAutenticado,
    tabla: TablaCruda,
    opciones: OpcionesImportacion,
  ): Promise<ResultadoAnalisis> {
    const [areas, cargos, usuarios] = await Promise.all([
      this.deps.repositorio.listarAreas(actor.empresaId),
      this.deps.repositorio.listarCargos(actor.empresaId),
      this.deps.repositorio.listarUsuarios(actor.empresaId),
    ]);
    return analizarTabla(tabla, opciones.mapeo, {
      hoy: this.deps.hoy(),
      actor: { id: actor.id, rol: actor.rol },
      areas,
      cargos,
      usuarios,
      bajaAusentes: opciones.bajaAusentes,
    });
  }
}