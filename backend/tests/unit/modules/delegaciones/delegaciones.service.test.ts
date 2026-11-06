// Pruebas unitarias del servicio de delegaciones institucionales.
// Verifica permisos, aislamiento, vigencia, creacion y revocacion.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UsuarioAutenticado } from '../../../../src/shared/types/autenticacion';
import type {
  Delegacion,
  DatosCrearDelegacion,
  FiltrosDelegaciones,
} from '../../../../src/modules/delegaciones/delegaciones.dominio';
import { DelegacionesService } from '../../../../src/modules/delegaciones/delegaciones.service';

const AHORA = new Date('2026-11-04T15:00:00.000Z');

const JEFE: UsuarioAutenticado = {
  id: 10,
  empresaId: 1,
  rol: 'JEFE_AREA',
  jti: 'token-jefe',
  expira: 1_800_000_000,
};

const SUPERADMIN: UsuarioAutenticado = {
  ...JEFE,
  id: 1,
  rol: 'SUPERADMIN',
  jti: 'token-superadmin',
};

const OTRO_ACTOR: UsuarioAutenticado = {
  ...JEFE,
  id: 20,
  rol: 'JEFE_AREA',
  jti: 'token-otro-jefe',
};

const DELEGACION: Delegacion = {
  id: 5,
  delegante: {
    id: 10,
    nombres: 'Ana',
    apellidos: 'Lopez',
  },
  delegado: {
    id: 20,
    nombres: 'Luis',
    apellidos: 'Perez',
  },
  creadaPorId: 10,
  vigenteDesde: new Date('2026-11-05T15:00:00.000Z'),
  vigenteHasta: new Date('2026-11-10T15:00:00.000Z'),
  motivo: 'Ausencia temporal',
  revocadaAt: null,
  estado: 'PROGRAMADA',
  creadaAt: AHORA,
};

const DATOS_CREACION: DatosCrearDelegacion = {
  delegadoId: 20,
  vigenteDesde: new Date('2026-11-05T15:00:00.000Z'),
  vigenteHasta: new Date('2026-11-10T15:00:00.000Z'),
  motivo: 'Ausencia temporal',
};

const FILTROS: FiltrosDelegaciones = {
  deleganteId: 30,
  delegadoId: 40,
  estado: 'VIGENTE',
  pagina: 2,
  porPagina: 10,
};

describe('DelegacionesService', () => {
  let repositorio: {
    listar: ReturnType<typeof vi.fn>;
    obtener: ReturnType<typeof vi.fn>;
    crear: ReturnType<typeof vi.fn>;
    revocar: ReturnType<typeof vi.fn>;
  };
  let servicio: DelegacionesService;

  beforeEach(() => {
    repositorio = {
      listar: vi.fn().mockResolvedValue({
        delegaciones: [DELEGACION],
        total: 1,
      }),
      obtener: vi.fn().mockResolvedValue(DELEGACION),
      crear: vi.fn().mockResolvedValue(DELEGACION),
      revocar: vi.fn().mockResolvedValue({
        ...DELEGACION,
        revocadaAt: AHORA,
        estado: 'REVOCADA',
      }),
    };

    servicio = new DelegacionesService({
      repositorio,
      ahora: () => new Date(AHORA),
    });
  });

  it('utiliza el reloj del sistema cuando no se inyecta uno', async () => {
    const servicioConRelojPredeterminado = new DelegacionesService({
      repositorio,
    });
    const ahora = Date.now();
    const entrada: DatosCrearDelegacion = {
      delegadoId: 20,
      vigenteDesde: new Date(ahora + 60_000),
      vigenteHasta: new Date(ahora + 120_000),
      motivo: null,
    };

    await servicioConRelojPredeterminado.crear(JEFE, entrada);

    expect(repositorio.crear).toHaveBeenCalledOnce();
  });
  describe('listar', () => {
    it('permite al jefe consultar solamente sus propias delegaciones', async () => {
      const resultado = await servicio.listar(JEFE, FILTROS);

      expect(repositorio.listar).toHaveBeenCalledOnce();
      expect(repositorio.listar).toHaveBeenCalledWith(1, {
        ...FILTROS,
        deleganteId: JEFE.id,
      });
      expect(resultado.total).toBe(1);
    });

    it('permite a SUPERADMIN consultar con los filtros recibidos', async () => {
      await servicio.listar(SUPERADMIN, FILTROS);

      expect(repositorio.listar).toHaveBeenCalledWith(1, FILTROS);
    });

    it('rechaza el listado para roles sin permiso administrativo', async () => {
      const actor: UsuarioAutenticado = {
        ...JEFE,
        rol: 'TALENTO_HUMANO',
      };

      await expect(servicio.listar(actor, FILTROS)).rejects.toBeDefined();
      expect(repositorio.listar).not.toHaveBeenCalled();
    });

    it('utiliza la empresa del actor autenticado', async () => {
      const actor = { ...JEFE, empresaId: 2 };

      await servicio.listar(actor, FILTROS);

      expect(repositorio.listar).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ deleganteId: JEFE.id }),
      );
    });
  });

  describe('obtener', () => {
    it('obtiene una delegacion propia del jefe', async () => {
      const resultado = await servicio.obtener(JEFE, DELEGACION.id);

      expect(repositorio.obtener).toHaveBeenCalledWith(1, DELEGACION.id);
      expect(resultado).toEqual(DELEGACION);
    });

    it('permite a SUPERADMIN consultar delegaciones de cualquier jefe del hospital', async () => {
      await servicio.obtener(SUPERADMIN, DELEGACION.id);

      expect(repositorio.obtener).toHaveBeenCalledWith(1, DELEGACION.id);
    });

    it('rechaza la consulta si la delegacion no existe', async () => {
      repositorio.obtener.mockResolvedValue(null);

      await expect(
        servicio.obtener(JEFE, DELEGACION.id),
      ).rejects.toMatchObject({
        message: 'La delegacion no existe en este hospital',
      });
    });

    it('impide que un jefe consulte delegaciones de otro jefe', async () => {
      await expect(
        servicio.obtener(OTRO_ACTOR, DELEGACION.id),
      ).rejects.toBeDefined();
    });

    it('rechaza la consulta para roles sin permiso administrativo', async () => {
      const actor: UsuarioAutenticado = {
        ...JEFE,
        rol: 'TALENTO_HUMANO',
      };

      await expect(
        servicio.obtener(actor, DELEGACION.id),
      ).rejects.toBeDefined();

      expect(repositorio.obtener).not.toHaveBeenCalled();
    });

    it('mantiene el aislamiento por empresa', async () => {
      const actor = { ...JEFE, empresaId: 2 };

      await servicio.obtener(actor, DELEGACION.id);

      expect(repositorio.obtener).toHaveBeenCalledWith(2, DELEGACION.id);
    });
  });

  describe('crear', () => {
    it('permite al jefe crear su propia delegacion', async () => {
      const resultado = await servicio.crear(JEFE, DATOS_CREACION);

      expect(repositorio.crear).toHaveBeenCalledOnce();
      expect(repositorio.crear).toHaveBeenCalledWith(1, JEFE.id, {
        ...DATOS_CREACION,
        deleganteId: JEFE.id,
      });
      expect(resultado).toEqual(DELEGACION);
    });

    it('permite a SUPERADMIN crear una delegacion en nombre de otro jefe', async () => {
      const entrada: DatosCrearDelegacion = {
        ...DATOS_CREACION,
        deleganteId: 30,
      };

      await servicio.crear(SUPERADMIN, entrada);

      expect(repositorio.crear).toHaveBeenCalledWith(1, SUPERADMIN.id, {
        ...entrada,
        deleganteId: 30,
      });
    });

    it('rechaza que SUPERADMIN omita el delegante', async () => {
      const entrada: DatosCrearDelegacion = {
        ...DATOS_CREACION,
        deleganteId: undefined,
      };

      await expect(
        servicio.crear(SUPERADMIN, entrada),
      ).rejects.toMatchObject({
        message: 'SUPERADMIN debe indicar el jefe responsable de la delegacion',
      });

      expect(repositorio.crear).not.toHaveBeenCalled();
    });

    it('impide que una persona se delegue a si misma', async () => {
      const entrada: DatosCrearDelegacion = {
        ...DATOS_CREACION,
        delegadoId: JEFE.id,
      };

      await expect(
        servicio.crear(JEFE, entrada),
      ).rejects.toMatchObject({
        message: 'Una persona no puede delegar sus atribuciones en si misma',
      });

      expect(repositorio.crear).not.toHaveBeenCalled();
    });

    it('rechaza una fecha de inicio anterior al instante actual', async () => {
      const entrada: DatosCrearDelegacion = {
        ...DATOS_CREACION,
        vigenteDesde: new Date(AHORA.getTime() - 1),
      };

      await expect(
        servicio.crear(JEFE, entrada),
      ).rejects.toMatchObject({
        message: 'La fecha de inicio de la delegacion no puede estar en el pasado',
      });

      expect(repositorio.crear).not.toHaveBeenCalled();
    });

    it('permite iniciar la delegacion exactamente en el instante actual', async () => {
      const entrada: DatosCrearDelegacion = {
        ...DATOS_CREACION,
        vigenteDesde: new Date(AHORA),
        vigenteHasta: new Date(AHORA.getTime() + 60_000),
      };

      await servicio.crear(JEFE, entrada);

      expect(repositorio.crear).toHaveBeenCalledOnce();
    });

    it('rechaza una fecha final igual a la fecha inicial', async () => {
      const fecha = new Date('2026-11-05T15:00:00.000Z');
      const entrada: DatosCrearDelegacion = {
        ...DATOS_CREACION,
        vigenteDesde: fecha,
        vigenteHasta: new Date(fecha),
      };

      await expect(
        servicio.crear(JEFE, entrada),
      ).rejects.toMatchObject({
        message: 'La fecha de finalizacion debe ser posterior a la fecha de inicio',
      });

      expect(repositorio.crear).not.toHaveBeenCalled();
    });

    it('rechaza una fecha final anterior a la fecha inicial', async () => {
      const entrada: DatosCrearDelegacion = {
        ...DATOS_CREACION,
        vigenteDesde: new Date('2026-11-10T15:00:00.000Z'),
        vigenteHasta: new Date('2026-11-09T15:00:00.000Z'),
      };

      await expect(
        servicio.crear(JEFE, entrada),
      ).rejects.toBeDefined();

      expect(repositorio.crear).not.toHaveBeenCalled();
    });

    it('rechaza la creacion para roles sin permiso administrativo', async () => {
      const actor: UsuarioAutenticado = {
        ...JEFE,
        rol: 'TALENTO_HUMANO',
      };

      await expect(
        servicio.crear(actor, DATOS_CREACION),
      ).rejects.toBeDefined();

      expect(repositorio.crear).not.toHaveBeenCalled();
    });

    it('utiliza la empresa y el actor autenticados al crear', async () => {
      const actor = { ...JEFE, empresaId: 3, id: 33 };

      await servicio.crear(actor, DATOS_CREACION);

      expect(repositorio.crear).toHaveBeenCalledWith(
        3,
        33,
        expect.objectContaining({ deleganteId: 33 }),
      );
    });
  });

  describe('revocar', () => {
    it('permite al jefe revocar su propia delegacion', async () => {
      const resultado = await servicio.revocar(JEFE, DELEGACION.id);

      expect(repositorio.obtener).toHaveBeenCalledWith(1, DELEGACION.id);
      expect(repositorio.revocar).toHaveBeenCalledWith(
        1,
        DELEGACION.id,
        JEFE.id,
        AHORA,
      );
      expect(resultado.estado).toBe('REVOCADA');
    });

    it('permite a SUPERADMIN revocar una delegacion de otro jefe', async () => {
      await servicio.revocar(SUPERADMIN, DELEGACION.id);

      expect(repositorio.revocar).toHaveBeenCalledWith(
        1,
        DELEGACION.id,
        SUPERADMIN.id,
        AHORA,
      );
    });

    it('rechaza la revocacion si la delegacion no existe', async () => {
      repositorio.obtener.mockResolvedValue(null);

      await expect(
        servicio.revocar(JEFE, DELEGACION.id),
      ).rejects.toMatchObject({
        message: 'La delegacion no existe en este hospital',
      });

      expect(repositorio.revocar).not.toHaveBeenCalled();
    });

    it('impide que un jefe revoque la delegacion de otro jefe', async () => {
      await expect(
        servicio.revocar(OTRO_ACTOR, DELEGACION.id),
      ).rejects.toBeDefined();

      expect(repositorio.revocar).not.toHaveBeenCalled();
    });

    it('rechaza revocar una delegacion que ya fue revocada', async () => {
      repositorio.obtener.mockResolvedValue({
        ...DELEGACION,
        revocadaAt: AHORA,
        estado: 'REVOCADA',
      });

      await expect(
        servicio.revocar(JEFE, DELEGACION.id),
      ).rejects.toMatchObject({
        message: 'La delegacion ya fue revocada',
      });

      expect(repositorio.revocar).not.toHaveBeenCalled();
    });

    it('rechaza la revocacion para roles sin permiso administrativo', async () => {
      const actor: UsuarioAutenticado = {
        ...JEFE,
        rol: 'TALENTO_HUMANO',
      };

      await expect(
        servicio.revocar(actor, DELEGACION.id),
      ).rejects.toBeDefined();

      expect(repositorio.obtener).not.toHaveBeenCalled();
      expect(repositorio.revocar).not.toHaveBeenCalled();
    });

    it('utiliza la empresa y el actor autenticados al revocar', async () => {
      const actor = { ...JEFE, empresaId: 4, id: 44 };

      repositorio.obtener.mockResolvedValue({
        ...DELEGACION,
        delegante: { ...DELEGACION.delegante, id: 44 },
      });

      await servicio.revocar(actor, DELEGACION.id);

      expect(repositorio.obtener).toHaveBeenCalledWith(4, DELEGACION.id);
      expect(repositorio.revocar).toHaveBeenCalledWith(
        4,
        DELEGACION.id,
        44,
        AHORA,
      );
    });
  });
});


