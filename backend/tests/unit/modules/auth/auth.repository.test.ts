// Pruebas unitarias del repositorio de autenticacion.
// Verifica consultas parametrizadas, conversion de filas y rotacion de tokens.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IBaseDatos } from '../../../../src/config/database';
import { AuthRepository } from '../../../../src/modules/auth/auth.repository';

function crearBaseDatos() {
  return {
    consultar: vi.fn(),
    ejecutar: vi.fn(),
  };
}

describe('AuthRepository', () => {
  let bd: ReturnType<typeof crearBaseDatos>;
  let repositorio: AuthRepository;

  beforeEach(() => {
    bd = crearBaseDatos();
    repositorio = new AuthRepository(bd as unknown as IBaseDatos);
  });

  describe('buscarCredencialesPorCorreo', () => {
    it('devuelve las credenciales de una fila y consulta por correo parametrizado', async () => {
      bd.consultar.mockResolvedValue([{
        id: 10,
        empresaId: 20,
        passwordHash: 'hash-seguro',
        rol: 'JEFE_AREA',
      }]);

      await expect(repositorio.buscarCredencialesPorCorreo('jefe@hospital.test'))
        .resolves.toEqual({
          id: 10,
          empresaId: 20,
          passwordHash: 'hash-seguro',
          rol: 'JEFE_AREA',
        });

      expect(bd.consultar).toHaveBeenCalledOnce();
      expect(bd.consultar.mock.calls[0]?.[0]).toContain("AND u.email = ? LIMIT 1");
      expect(bd.consultar.mock.calls[0]?.[1]).toEqual(['jefe@hospital.test']);
    });

    it('devuelve null cuando no encuentra credenciales', async () => {
      bd.consultar.mockResolvedValue([]);

      await expect(repositorio.buscarCredencialesPorCorreo('nadie@test.test'))
        .resolves.toBeNull();
    });

    it('rechaza un rol desconocido en la base de datos', async () => {
      bd.consultar.mockResolvedValue([{
        id: 10,
        empresaId: 20,
        passwordHash: null,
        rol: 'ROL_INEXISTENTE',
      }]);

      await expect(repositorio.buscarCredencialesPorCorreo('jefe@test.test'))
        .rejects.toThrow('Rol desconocido en la base de datos: ROL_INEXISTENTE');
    });
  });

  describe('buscarSesionPorId', () => {
    it('devuelve la sesion y consulta por identificador parametrizado', async () => {
      bd.consultar.mockResolvedValue([{
        id: 10,
        empresaId: 20,
        passwordHash: 'hash-no-retornado',
        rol: 'SUPERADMIN',
      }]);

      await expect(repositorio.buscarSesionPorId(10)).resolves.toEqual({
        id: 10,
        empresaId: 20,
        rol: 'SUPERADMIN',
      });

      expect(bd.consultar).toHaveBeenCalledOnce();
      expect(bd.consultar.mock.calls[0]?.[0]).toContain('AND u.id = ? LIMIT 1');
      expect(bd.consultar.mock.calls[0]?.[1]).toEqual([10]);
    });

    it('devuelve null cuando no encuentra una sesion', async () => {
      bd.consultar.mockResolvedValue([]);

      await expect(repositorio.buscarSesionPorId(99)).resolves.toBeNull();
    });

    it('rechaza un rol desconocido al recuperar una sesion', async () => {
      bd.consultar.mockResolvedValue([{
        id: 10,
        empresaId: 20,
        passwordHash: null,
        rol: 'ROL_INVALIDO',
      }]);

      await expect(repositorio.buscarSesionPorId(10))
        .rejects.toThrow('Rol desconocido en la base de datos: ROL_INVALIDO');
    });
  });

  describe('buscarPerfil', () => {
    it('devuelve el perfil completo con sus relaciones institucionales', async () => {
      bd.consultar.mockResolvedValue([{
        id: 10,
        nombres: 'Rosa',
        apellidos: 'Mena',
        correo: 'rosa@hospital.test',
        rol: 'JEFE_AREA',
        empresaId: 20,
        empresaNombre: 'Hospital San Andres',
        areaId: 30,
        areaDetalle: 'Emergencia',
        cargoId: 40,
        cargoDetalle: 'Medico',
      }]);

      await expect(repositorio.buscarPerfil(20, 10)).resolves.toEqual({
        id: 10,
        nombres: 'Rosa',
        apellidos: 'Mena',
        correo: 'rosa@hospital.test',
        rol: 'JEFE_AREA',
        empresa: { id: 20, nombre: 'Hospital San Andres' },
        area: { id: 30, detalle: 'Emergencia' },
        cargo: { id: 40, detalle: 'Medico' },
      });

      expect(bd.consultar).toHaveBeenCalledOnce();
      expect(bd.consultar.mock.calls[0]?.[0]).toContain('WHERE u.empresa_id = ? AND u.id = ?');
      expect(bd.consultar.mock.calls[0]?.[1]).toEqual([20, 10]);
    });

    it('devuelve null cuando el perfil no existe en el hospital indicado', async () => {
      bd.consultar.mockResolvedValue([]);

      await expect(repositorio.buscarPerfil(20, 99)).resolves.toBeNull();
    });

    it('rechaza un rol desconocido al recuperar el perfil', async () => {
      bd.consultar.mockResolvedValue([{
        id: 10,
        nombres: 'Rosa',
        apellidos: 'Mena',
        correo: null,
        rol: 'ROL_INVALIDO',
        empresaId: 20,
        empresaNombre: 'Hospital',
        areaId: 30,
        areaDetalle: 'Emergencia',
        cargoId: 40,
        cargoDetalle: 'Medico',
      }]);

      await expect(repositorio.buscarPerfil(20, 10))
        .rejects.toThrow('Rol desconocido en la base de datos: ROL_INVALIDO');
    });
  });

  describe('guardarTokenId', () => {
    it('guarda el identificador del token con parametros', async () => {
      bd.ejecutar.mockResolvedValue({ filasAfectadas: 1 });

      await expect(repositorio.guardarTokenId(10, 'jti-nuevo')).resolves.toBeUndefined();

      expect(bd.ejecutar).toHaveBeenCalledWith(
        'UPDATE usuarios SET token_id = ? WHERE id = ?',
        ['jti-nuevo', 10],
      );
    });

    it('permite borrar el identificador vigente con null', async () => {
      bd.ejecutar.mockResolvedValue({ filasAfectadas: 1 });

      await repositorio.guardarTokenId(10, null);

      expect(bd.ejecutar).toHaveBeenCalledWith(
        'UPDATE usuarios SET token_id = ? WHERE id = ?',
        [null, 10],
      );
    });
  });

  describe('rotarTokenId', () => {
    it('devuelve true cuando se actualiza exactamente una fila activa', async () => {
      bd.ejecutar.mockResolvedValue({ filasAfectadas: 1 });

      await expect(repositorio.rotarTokenId(10, 'jti-anterior', 'jti-nuevo'))
        .resolves.toBe(true);

      expect(bd.ejecutar).toHaveBeenCalledWith(
        "UPDATE usuarios SET token_id = ? WHERE id = ? AND token_id = ? AND estado = 'ACTIVO'",
        ['jti-nuevo', 10, 'jti-anterior'],
      );
    });

    it('devuelve false cuando no se actualiza ninguna fila', async () => {
      bd.ejecutar.mockResolvedValue({ filasAfectadas: 0 });

      await expect(repositorio.rotarTokenId(10, 'jti-anterior', 'jti-nuevo'))
        .resolves.toBe(false);
    });

    it('devuelve false cuando se actualizan varias filas', async () => {
      bd.ejecutar.mockResolvedValue({ filasAfectadas: 2 });

      await expect(repositorio.rotarTokenId(10, 'jti-anterior', 'jti-nuevo'))
        .resolves.toBe(false);
    });
  });
});