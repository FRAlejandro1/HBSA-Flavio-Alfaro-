// Gestiona la creación de periodos de vacaciones según la configuración
// individual, del área o institucional. Los periodos existentes no se modifican.
import { calcularPeriodosVigentes } from './vacaciones.periodos';
import type { IPeriodosRepository } from './vacaciones.periodos.repository';

export interface DependenciasPeriodosService {
  repositorio: IPeriodosRepository;
  // Obtiene los días anuales vigentes para el hospital cuando no hay excepciones.
  obtenerDiasVacacionesAnuales: (empresaId: number) => Promise<number>;
}

export class PeriodosService {
  constructor(private readonly deps: DependenciasPeriodosService) {}

  // Resuelve los días anuales respetando la prioridad empleado, área e institución.
  private async resolverDiasDerecho(
    empresaId: number,
    diasVacacionesPersona: number | null,
    diasVacacionesArea: number | null,
  ): Promise<number> {
    if (diasVacacionesPersona !== null) {
      return diasVacacionesPersona;
    }

    if (diasVacacionesArea !== null) {
      return diasVacacionesArea;
    }

    return this.deps.obtenerDiasVacacionesAnuales(empresaId);
  }

  // Crea únicamente los periodos pendientes, sin consultar configuración si todos existen.
  async asegurar(empresaId: number, usuarioId: number, hoy: string): Promise<void> {
    const datos = await this.deps.repositorio.buscarDatosDePeriodos(empresaId, usuarioId);

    // Quien llama ya comprobó que la persona existe.
    if (datos === null) {
      return;
    }

    const periodos = calcularPeriodosVigentes(datos.fechaIngreso, hoy);

    if (periodos.length === 0) {
      return;
    }

    const periodosFaltantes = await this.deps.repositorio.filtrarPeriodosFaltantes(
      empresaId,
      usuarioId,
      periodos,
    );

    if (periodosFaltantes.length === 0) {
      return;
    }

    const diasDerecho = await this.resolverDiasDerecho(
      empresaId,
      datos.diasVacacionesPersona,
      datos.diasVacacionesArea,
    );

    await this.deps.repositorio.crearPeriodosFaltantes(
      empresaId,
      usuarioId,
      periodosFaltantes,
      diasDerecho,
    );
  }
}