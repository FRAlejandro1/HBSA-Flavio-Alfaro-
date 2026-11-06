// Pruebas unitarias del servicio de configuracion institucional.
// Verifica consultas, actualizaciones, validaciones y aislamiento por hospital.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UsuarioAutenticado } from '../../../../src/shared/types/autenticacion';
import type {
  ConfiguracionInstitucional,
  DatosActualizarConfiguracionInstitucional,
} from '../../../../src/modules/configuracion-institucional/configuracion-institucional.dominio';
import { ConfiguracionInstitucionalService } from '../../../../src/modules/configuracion-institucional/configuracion-institucional.service';

const CONFIGURACION: ConfiguracionInstitucional = {
  plazoHoras: 48,
  diasVacacionesAnuales: 30,
  zonaHoraria: 'America/Guayaquil',
  diasAnticipacionVacaciones: 3,
};

const DATOS_ACTUALIZACION: DatosActualizarConfiguracionInstitucional = {
  plazoHoras: 36.5,
  diasVacacionesAnuales: 25.5,
  zonaHoraria: 'America/Guayaquil',
  diasAnticipacionVacaciones: 5,
};

const ACTOR: UsuarioAutenticado = {
  id: 10,
  empresaId: 1,
  rol: 'SUPERADMIN',
  jti: 'token-superadmin',
  expira: 1_800_000_000,
};

describe('ConfiguracionInstitucionalService', () => {
  let repositorio: {
    obtener: ReturnType<typeof vi.fn>;
    actualizar: ReturnType<typeof vi.fn>;
  };
  let servicio: ConfiguracionInstitucionalService;

  beforeEach(() => {
    repositorio = {
      obtener: vi.fn().mockResolvedValue(CONFIGURACION),
      actualizar: vi.fn().mockResolvedValue(DATOS_ACTUALIZACION),
    };

    servicio = new ConfiguracionInstitucionalService({
      repositorio,
    });
  });

  describe('obtener', () => {
    it('consulta la configuracion del hospital autenticado', async () => {
      const resultado = await servicio.obtener(ACTOR);

      expect(repositorio.obtener).toHaveBeenCalledOnce();
      expect(repositorio.obtener).toHaveBeenCalledWith(ACTOR.empresaId);
      expect(resultado).toEqual(CONFIGURACION);
    });

    it('rechaza la consulta cuando el hospital no tiene configuracion', async () => {
      repositorio.obtener.mockResolvedValue(null);

      await expect(servicio.obtener(ACTOR)).rejects.toMatchObject({
        message: 'No existe configuracion institucional para este hospital',
      });

      expect(repositorio.obtener).toHaveBeenCalledWith(ACTOR.empresaId);
    });

    it('mantiene aisladas las consultas entre hospitales', async () => {
      const otroActor: UsuarioAutenticado = {
        ...ACTOR,
        empresaId: 2,
      };

      await servicio.obtener(otroActor);

      expect(repositorio.obtener).toHaveBeenCalledWith(2);
      expect(repositorio.obtener).not.toHaveBeenCalledWith(ACTOR.empresaId);
    });
  });

  describe('actualizar', () => {
    it('actualiza los parametros y registra el hospital y actor responsables', async () => {
      const resultado = await servicio.actualizar(ACTOR, DATOS_ACTUALIZACION);

      expect(repositorio.actualizar).toHaveBeenCalledOnce();
      expect(repositorio.actualizar).toHaveBeenCalledWith(
        ACTOR.empresaId,
        ACTOR.id,
        DATOS_ACTUALIZACION,
      );
      expect(resultado).toEqual(DATOS_ACTUALIZACION);
    });

    it('rechaza parametros invalidos sin invocar el repositorio', async () => {
      const datosInvalidos = {
        ...DATOS_ACTUALIZACION,
        plazoHoras: 0,
      };

      await expect(
        servicio.actualizar(
          ACTOR,
          datosInvalidos,
        ),
      ).rejects.toMatchObject({
        message: 'Los parametros de configuracion institucional no son validos',
      });

      expect(repositorio.actualizar).not.toHaveBeenCalled();
    });

    it('rechaza una zona horaria invalida', async () => {
      const datosInvalidos = {
        ...DATOS_ACTUALIZACION,
        zonaHoraria: 'Zona/Inexistente',
      };

      await expect(
        servicio.actualizar(
          ACTOR,
          datosInvalidos,
        ),
      ).rejects.toBeDefined();

      expect(repositorio.actualizar).not.toHaveBeenCalled();
    });

    it('usa el hospital del actor y no un identificador externo', async () => {
      const otroActor: UsuarioAutenticado = {
        ...ACTOR,
        empresaId: 2,
        id: 20,
      };

      await servicio.actualizar(otroActor, DATOS_ACTUALIZACION);

      expect(repositorio.actualizar).toHaveBeenCalledWith(
        2,
        20,
        DATOS_ACTUALIZACION,
      );
    });
  });
});
