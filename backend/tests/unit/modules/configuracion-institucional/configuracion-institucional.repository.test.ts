// Pruebas unitarias del repositorio de configuracion institucional.
// Verifica persistencia, aislamiento por hospital, conversion numerica y auditoria.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IConexionBD } from '../../../../src/config/database';
import type {
  ConfiguracionInstitucional,
  DatosActualizarConfiguracionInstitucional,
} from '../../../../src/modules/configuracion-institucional/configuracion-institucional.dominio';
import { ConfiguracionInstitucionalRepository } from '../../../../src/modules/configuracion-institucional/configuracion-institucional.repository';

const FILA_ANTERIOR = {
  plazoHoras: '48.00',
  diasVacacionesAnuales: '30.00',
  zonaHoraria: 'America/Guayaquil',
  diasAnticipacionVacaciones: '3',
};

const FILA_ACTUALIZADA = {
  plazoHoras: '36.50',
  diasVacacionesAnuales: '25.50',
  zonaHoraria: 'America/Guayaquil',
  diasAnticipacionVacaciones: '5',
};

const CONFIGURACION_ANTERIOR: ConfiguracionInstitucional = {
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

const CONFIGURACION_ACTUALIZADA: ConfiguracionInstitucional = {
  ...DATOS_ACTUALIZACION,
};

describe('ConfiguracionInstitucionalRepository', () => {
  const conexion = {
    consultar: vi.fn(),
    ejecutar: vi.fn(),
  } satisfies IConexionBD;

  const transaccion = vi.fn();

  const bd = {
    consultar: vi.fn(),
    ejecutar: vi.fn(),
    transaccion,
    verificar: vi.fn(),
    cerrar: vi.fn(),
  };

  let repositorio: ConfiguracionInstitucionalRepository;

  beforeEach(() => {
    vi.resetAllMocks();

    transaccion.mockImplementation(
      (trabajo: (conexion: IConexionBD) => Promise<unknown>) =>
        trabajo(conexion),
    );

    conexion.ejecutar.mockResolvedValue({
      filasAfectadas: 1,
      idInsertado: 0,
    });

    repositorio = new ConfiguracionInstitucionalRepository(bd);
  });

  describe('obtener', () => {
    it('consulta la configuracion del hospital y convierte los valores numericos', async () => {
      bd.consultar.mockResolvedValue([FILA_ANTERIOR]);

      const resultado = await repositorio.obtener(1);

      expect(bd.consultar).toHaveBeenCalledOnce();
      expect(bd.consultar.mock.calls[0]?.[0]).toContain(
        'WHERE empresa_id = ?',
      );
      expect(bd.consultar).toHaveBeenCalledWith(
        expect.any(String),
        [1],
      );
      expect(resultado).toEqual(CONFIGURACION_ANTERIOR);
    });

    it('devuelve null cuando el hospital no tiene configuracion', async () => {
      bd.consultar.mockResolvedValue([]);

      const resultado = await repositorio.obtener(2);

      expect(resultado).toBeNull();
      expect(bd.consultar).toHaveBeenCalledWith(
        expect.any(String),
        [2],
      );
    });

    it('mantiene aisladas las consultas entre hospitales', async () => {
      bd.consultar.mockResolvedValue([FILA_ANTERIOR]);

      await repositorio.obtener(2);

      expect(bd.consultar).toHaveBeenCalledWith(
        expect.any(String),
        [2],
      );
    });
  });

  describe('actualizar', () => {
    it('bloquea la configuracion, actualiza los parametros y registra auditoria', async () => {
      conexion.consultar
        .mockResolvedValueOnce([FILA_ANTERIOR])
        .mockResolvedValueOnce([FILA_ACTUALIZADA]);

      const resultado = await repositorio.actualizar(
        1,
        10,
        DATOS_ACTUALIZACION,
      );

      expect(bd.transaccion).toHaveBeenCalledOnce();

      expect(conexion.consultar).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('FOR UPDATE'),
        [1],
      );

      expect(conexion.ejecutar).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('UPDATE config_aprobacion'),
        [36.5, 25.5, 'America/Guayaquil', 5, 1],
      );

      expect(conexion.ejecutar).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO audit_log'),
        [
          1,
          10,
          1,
          JSON.stringify({
            antes: CONFIGURACION_ANTERIOR,
            despues: DATOS_ACTUALIZACION,
          }),
        ],
      );

      expect(conexion.consultar).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('WHERE empresa_id = ?'),
        [1],
      );

      expect(resultado).toEqual(CONFIGURACION_ACTUALIZADA);
    });

    it('rechaza la actualizacion si no existe configuracion para el hospital', async () => {
      conexion.consultar.mockResolvedValueOnce([]);

      await expect(
        repositorio.actualizar(2, 10, DATOS_ACTUALIZACION),
      ).rejects.toMatchObject({
        message: 'La configuracion institucional no existe para este hospital',
      });

      expect(conexion.ejecutar).not.toHaveBeenCalled();
      expect(conexion.consultar).toHaveBeenCalledOnce();
    });

    it('rechaza la operacion si no puede recuperar la configuracion actualizada', async () => {
      conexion.consultar
        .mockResolvedValueOnce([FILA_ANTERIOR])
        .mockResolvedValueOnce([]);

      await expect(
        repositorio.actualizar(1, 10, DATOS_ACTUALIZACION),
      ).rejects.toMatchObject({
        message: 'No se pudo recuperar la configuracion institucional actualizada',
      });

      expect(conexion.ejecutar).toHaveBeenCalledTimes(2);
      expect(conexion.consultar).toHaveBeenCalledTimes(2);
    });

    it('utiliza el identificador del hospital en todas las operaciones', async () => {
      conexion.consultar
        .mockResolvedValueOnce([FILA_ANTERIOR])
        .mockResolvedValueOnce([FILA_ACTUALIZADA]);

      await repositorio.actualizar(2, 20, DATOS_ACTUALIZACION);

      expect(conexion.consultar).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        [2],
      );

      expect(conexion.ejecutar.mock.calls[0]?.[1]).toEqual([
        36.5,
        25.5,
        'America/Guayaquil',
        5,
        2,
      ]);

      expect(conexion.ejecutar.mock.calls[1]?.[1]).toEqual([
        2,
        20,
        2,
        expect.any(String),
      ]);
    });
  });
});
