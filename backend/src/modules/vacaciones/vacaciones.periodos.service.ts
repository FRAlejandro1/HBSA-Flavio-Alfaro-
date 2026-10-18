// Periodos de vacaciones y dias que da cada area o persona: crea los periodos que faltan y deja que el SUPERADMIN
// cambie los dias. Las restricciones de la base las traduce el repository.
import { AppError } from '../../shared/errors/AppError';
import type { UsuarioAutenticado } from '../../shared/types/autenticacion';
import { calcularPeriodosVigentes } from './vacaciones.periodos';
import type { DatosDePeriodos, DiasDeArea, IPeriodosRepository } from './vacaciones.periodos.repository';

export interface DependenciasPeriodosService {
  repositorio: IPeriodosRepository;
  // Dias por periodo cuando ni la persona ni su area (ni sus areas padre) tienen un valor propio
  diasPorDefecto: number;
}

// De donde sale el valor que rige: de la propia persona o area, de un area superior o del valor por defecto
export type OrigenDias = 'PROPIO' | 'HEREDADO' | 'PREDETERMINADO';

export interface ConfiguracionDias {
  // Los dias propios (null si no tiene) y los que de verdad le tocan
  diasVacaciones: number | null;
  diasEfectivos: number;
  origen: OrigenDias;
}

// El primer valor configurado en la cadena de areas (la propia area primero)
function primeraConfigurada(cadena: DiasDeArea[]): { nivel: number; dias: number } | null {
  for (const area of cadena) {
    if (area.diasVacaciones !== null) {
      return { nivel: area.nivel, dias: area.diasVacaciones };
    }
  }
  return null;
}

export class PeriodosService {
  constructor(private readonly deps: DependenciasPeriodosService) {}

  // Crea los periodos de la persona que falten a la fecha de hoy (el dia en la zona del hospital).
  // Se puede llamar las veces que haga falta: lo que ya existe no se toca.
  async asegurar(empresaId: number, usuarioId: number, hoy: string): Promise<void> {
    const repositorio = this.deps.repositorio;
    const datos = await repositorio.buscarDatosDePeriodos(empresaId, usuarioId);
    // Quien llama ya comprobo que la persona existe
    if (!datos) {
      return;
    }
    const periodos = calcularPeriodosVigentes(datos.fechaIngreso, hoy);
    if (periodos.length === 0) {
      return;
    }
    const { diasEfectivos } = await this.configuracionDe(empresaId, datos);
    await repositorio.crearPeriodosFaltantes(empresaId, usuarioId, periodos, diasEfectivos);
  }

  async obtenerDeArea(empresaId: number, areaId: number): Promise<ConfiguracionDias> {
    const cadena = await this.deps.repositorio.listarDiasDeCadenaDeAreas(empresaId, areaId);
    const propia = cadena[0];
    if (propia === undefined) {
      throw AppError.noEncontrado('El area no existe');
    }
    const configurada = primeraConfigurada(cadena);
    if (configurada === null) {
      return { diasVacaciones: null, diasEfectivos: this.deps.diasPorDefecto, origen: 'PREDETERMINADO' };
    }
    return {
      diasVacaciones: propia.diasVacaciones,
      diasEfectivos: configurada.dias,
      origen: configurada.nivel === 0 ? 'PROPIO' : 'HEREDADO',
    };
  }

  async obtenerDePersona(empresaId: number, usuarioId: number): Promise<ConfiguracionDias> {
    const datos = await this.deps.repositorio.buscarDatosDePeriodos(empresaId, usuarioId);
    if (!datos) {
      throw AppError.noEncontrado('La persona no existe');
    }
    return this.configuracionDe(empresaId, datos);
  }

  // Fija los dias del area (null: vuelve a heredar) y devuelve lo que rige despues del cambio
  async fijarDeArea(actor: UsuarioAutenticado, areaId: number, dias: number | null): Promise<ConfiguracionDias> {
    const existe = await this.deps.repositorio.fijarDiasDeArea(actor.empresaId, areaId, dias, actor.id);
    if (!existe) {
      throw AppError.noEncontrado('El area no existe');
    }
    return this.obtenerDeArea(actor.empresaId, areaId);
  }

  // Fija los dias de la persona (null: vuelve a los de su area) y devuelve lo que rige despues del cambio
  async fijarDePersona(actor: UsuarioAutenticado, usuarioId: number, dias: number | null): Promise<ConfiguracionDias> {
    const existe = await this.deps.repositorio.fijarDiasDePersona(actor.empresaId, usuarioId, dias, actor.id);
    if (!existe) {
      throw AppError.noEncontrado('La persona no existe');
    }
    return this.obtenerDePersona(actor.empresaId, usuarioId);
  }

  // Manda lo de la persona; si no tiene, lo del primer area con valor (la suya o una superior); si no, el por defecto
  private async configuracionDe(empresaId: number, datos: DatosDePeriodos): Promise<ConfiguracionDias> {
    if (datos.diasVacaciones !== null) {
      return { diasVacaciones: datos.diasVacaciones, diasEfectivos: datos.diasVacaciones, origen: 'PROPIO' };
    }
    const cadena = await this.deps.repositorio.listarDiasDeCadenaDeAreas(empresaId, datos.areaId);
    const configurada = primeraConfigurada(cadena);
    if (configurada === null) {
      return { diasVacaciones: null, diasEfectivos: this.deps.diasPorDefecto, origen: 'PREDETERMINADO' };
    }
    return { diasVacaciones: null, diasEfectivos: configurada.dias, origen: 'HEREDADO' };
  }
}