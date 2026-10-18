// Pruebas de como el service de vacaciones asegura los periodos de la persona antes de comprobar su saldo.
import { describe, expect, it } from 'vitest';
import { VacacionesService } from '../../../../src/modules/vacaciones/vacaciones.service';
import type { UsuarioAutenticado } from '../../../../src/shared/types/autenticacion';
import type { PersonaDePrueba } from '../../../helpers/vacaciones';
import { contarDiasLaborablesDePrueba, crearVacacionesEnMemoria } from '../../../helpers/vacaciones';

// Jueves 15 de octubre de 2026, 10:00 en Guayaquil (15:00 UTC)
const AHORA = new Date('2026-10-15T15:00:00Z');

const programada = { fechaInicio: '2026-11-02', fechaFin: '2026-11-06' };

function persona(id: number, cambios: Partial<PersonaDePrueba> = {}): PersonaDePrueba {
  return {
    id,
    empresaId: 5,
    cedula: `09000000${String(id).padStart(2, '0')}`,
    nombres: `Nombre${String(id)}`,
    apellidos: `Apellido${String(id)}`,
    areaId: 10,
    cargoId: 20,
    nivelJerarquico: 5,
    telefono: '0990000000',
    jefeInmediatoId: null,
    estado: 'ACTIVO',
    lugar: 'Flavio Alfaro',
    ...cambios,
  };
}

function actor(id: number): UsuarioAutenticado {
  return { id, empresaId: 5, rol: 'EMPLEADO', jti: `jti-${String(id)}`, expira: 9_999_999_999 };
}

// Luis (1) es empleado de Laura (2). La persona no tiene saldo hasta que se aseguran sus periodos.
function crearEscenario(asegurar: (empresaId: number, usuarioId: number, hoy: string) => Promise<void>) {
  const memoria = crearVacacionesEnMemoria();
  memoria.personas.set(2, persona(2, { nivelJerarquico: 3 }));
  memoria.personas.set(1, persona(1, { jefeInmediatoId: 2 }));
  memoria.rutas.set(5, ['JEFE_INMEDIATO']);
  memoria.feriados.add('2026-11-02');
  memoria.feriados.add('2026-11-03');
  const servicio = new VacacionesService({
    repositorio: memoria.repositorio,
    calcularDiasLaborables: contarDiasLaborablesDePrueba,
    plazoAprobacionHoras: 1,
    asegurarPeriodos: asegurar,
    ahora: () => AHORA,
  });
  return { ...memoria, servicio };
}

describe('crear asegura los periodos', () => {
  it('los asegura con el dia de hoy del hospital y antes de comprobar el saldo', async () => {
    const llamadas: [number, number, string][] = [];
    const { servicio, saldos } = crearEscenario((empresaId, usuarioId, hoy) => {
      llamadas.push([empresaId, usuarioId, hoy]);
      // Al crear los periodos la persona pasa a tener saldo
      saldos.set(usuarioId, 60);
      return Promise.resolve();
    });
    expect(saldos.get(1)).toBeUndefined();

    const solicitud = await servicio.crear(actor(1), programada);

    expect(solicitud.estado).toBe('PENDIENTE');
    expect(llamadas).toEqual([[5, 1, '2026-10-15']]);
  });

  it('sin periodos que alcancen, la solicitud se rechaza por saldo', async () => {
    const { servicio } = crearEscenario(() => Promise.resolve());
    await expect(servicio.crear(actor(1), programada)).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });
  });

  it('no los asegura si la solicitud ya falla antes por sus fechas', async () => {
    const llamadas: number[] = [];
    const { servicio } = crearEscenario((_empresaId, usuarioId) => {
      llamadas.push(usuarioId);
      return Promise.resolve();
    });
    await expect(
      servicio.crear(actor(1), { fechaInicio: '2026-10-14', fechaFin: '2026-10-16', justificacion: 'x' }),
    ).rejects.toMatchObject({ codigo: 'REGLA_DE_NEGOCIO' });
    expect(llamadas).toHaveLength(0);
  });

  it('si no se pueden crear los periodos, la solicitud no se crea', async () => {
    const { servicio, solicitudes } = crearEscenario(() => Promise.reject(new Error('Base de datos caida')));
    await expect(servicio.crear(actor(1), programada)).rejects.toThrow('Base de datos caida');
    expect(solicitudes).toHaveLength(0);
  });
});