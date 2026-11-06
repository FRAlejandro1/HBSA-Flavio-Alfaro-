// Pruebas unitarias del controlador de usuarios.
// Verifica extraccion del actor, empresa, parametros, llamadas al servicio
// y respuestas HTTP.

import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crearUsuariosController } from '../../../../src/modules/usuarios/usuarios.controller';
import type { UsuariosService } from '../../../../src/modules/usuarios/usuarios.service';
import type { UsuarioAutenticado } from '../../../../src/shared/types/autenticacion';

const ACTOR: UsuarioAutenticado = {
    id: 10,
    empresaId: 3,
    rol: 'TALENTO_HUMANO',
    jti: 'token-talento-humano',
    expira: 1_800_000_000,
};

const USUARIO = {
    id: 20,
    empresaId: 3,
    nombres: 'Ana',
    apellidos: 'Lopez',
    email: 'ana@example.com',
};

const FILTROS = {
    activo: 'true',
    rol: 'EMPLEADO',
    pagina: '1',
    porPagina: '10',
};

const DATOS_CREACION = {
    nombres: 'Luis',
    apellidos: 'Perez',
    email: 'luis@example.com',
    rol: 'EMPLEADO',
};

const DATOS_ACTUALIZACION = {
    nombres: 'Luis Alberto',
    apellidos: 'Perez',
};

function crearRequest(
    usuario: UsuarioAutenticado | undefined = ACTOR,
    opciones: {
        query?: Record<string, unknown>;
        params?: Record<string, string>;
        body?: unknown;
        empresaId?: number;
    } = {},
): Request {
    return {
        usuario,
        empresaId: opciones.empresaId ?? usuario?.empresaId,
        query: opciones.query ?? {},
        params: opciones.params ?? {},
        body: opciones.body ?? {},
    } as unknown as Request;
}

function crearRespuesta(): Response & { statusMock: ReturnType<typeof vi.fn> } {
    const status = vi.fn().mockReturnThis();

    return {
        json: vi.fn().mockReturnThis(),
        status,
        statusMock: status,
    } as unknown as Response & { statusMock: ReturnType<typeof vi.fn> };
}

describe('UsuariosController', () => {
    const servicio = {
        listar: vi.fn(),
        obtener: vi.fn(),
        crear: vi.fn(),
        actualizar: vi.fn(),
        configurarDiasVacaciones: vi.fn(),
        darDeBaja: vi.fn(),
        reactivar: vi.fn(),
    };

    const controlador = crearUsuariosController(
        servicio as unknown as UsuariosService,
    );

    beforeEach(() => {
        vi.clearAllMocks();

        servicio.listar.mockResolvedValue({
            usuarios: [USUARIO],
            total: 1,
        });
        servicio.obtener.mockResolvedValue(USUARIO);
        servicio.crear.mockResolvedValue(USUARIO);
        servicio.actualizar.mockResolvedValue(USUARIO);
        servicio.configurarDiasVacaciones.mockResolvedValue(25);
        servicio.darDeBaja.mockResolvedValue(USUARIO);
        servicio.reactivar.mockResolvedValue(USUARIO);
    });

    describe('listar', () => {
        it('extrae la empresa y los filtros y responde con los usuarios', async () => {
            const req = crearRequest(ACTOR, {
                query: FILTROS,
            });
            const res = crearRespuesta();

            await controlador.listar(req, res, vi.fn() as NextFunction);

            expect(servicio.listar).toHaveBeenCalledWith(
                ACTOR.empresaId,
                FILTROS,
            );
            expect(res.json).toHaveBeenCalledWith({
                usuarios: [USUARIO],
                total: 1,
            });
        });
    });

    describe('obtener', () => {
        it('extrae el identificador y responde con el usuario', async () => {
            const req = crearRequest(ACTOR, {
                params: { id: '20' },
            });
            const res = crearRespuesta();

            await controlador.obtener(req, res, vi.fn() as NextFunction);

            expect(servicio.obtener).toHaveBeenCalledWith(
                ACTOR.empresaId,
                20,
            );
            expect(res.json).toHaveBeenCalledWith({
                usuario: USUARIO,
            });
        });
    });

    describe('crear', () => {
        it('extrae el actor y los datos y responde con estado 201', async () => {
            const req = crearRequest(ACTOR, {
                body: DATOS_CREACION,
            });
            const res = crearRespuesta();

            await controlador.crear(req, res, vi.fn() as NextFunction);

            expect(servicio.crear).toHaveBeenCalledWith(
                ACTOR,
                DATOS_CREACION,
            );
            expect(res.statusMock).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                usuario: USUARIO,
            });
        });
    });

    describe('actualizar', () => {
        it('extrae actor, identificador y datos y responde con el usuario', async () => {
            const req = crearRequest(ACTOR, {
                params: { id: '20' },
                body: DATOS_ACTUALIZACION,
            });
            const res = crearRespuesta();

            await controlador.actualizar(req, res, vi.fn() as NextFunction);

            expect(servicio.actualizar).toHaveBeenCalledWith(
                ACTOR,
                20,
                DATOS_ACTUALIZACION,
            );
            expect(res.json).toHaveBeenCalledWith({
                usuario: USUARIO,
            });
        });
    });

    describe('configurarDiasVacaciones', () => {
        it('extrae actor, identificador y dias de vacaciones', async () => {
            const req = crearRequest(ACTOR, {
                params: { id: '20' },
                body: {
                    diasVacaciones: 25,
                },
            });
            const res = crearRespuesta();

            await controlador.configurarDiasVacaciones(
                req,
                res,
                vi.fn() as NextFunction,
            );

            expect(servicio.configurarDiasVacaciones).toHaveBeenCalledWith(
                ACTOR,
                20,
                25,
            );
            expect(res.json).toHaveBeenCalledWith({
                diasVacaciones: 25,
            });
        });
    });

    describe('darDeBaja', () => {
        it('extrae la fecha de baja y responde con el usuario', async () => {
            const fechaBaja = '2026-11-05';
            const req = crearRequest(ACTOR, {
                params: { id: '20' },
                body: {
                    fechaBaja,
                },
            });
            const res = crearRespuesta();

            await controlador.darDeBaja(
                req,
                res,
                vi.fn() as NextFunction,
            );

            expect(servicio.darDeBaja).toHaveBeenCalledWith(
                ACTOR,
                20,
                fechaBaja,
            );
            expect(res.json).toHaveBeenCalledWith({
                usuario: USUARIO,
            });
        });
    });

    describe('reactivar', () => {
        it('extrae actor e identificador y responde con el usuario', async () => {
            const req = crearRequest(ACTOR, {
                params: { id: '20' },
            });
            const res = crearRespuesta();

            await controlador.reactivar(
                req,
                res,
                vi.fn() as NextFunction,
            );

            expect(servicio.reactivar).toHaveBeenCalledWith(
                ACTOR,
                20,
            );
            expect(res.json).toHaveBeenCalledWith({
                usuario: USUARIO,
            });
        });
    });
});
