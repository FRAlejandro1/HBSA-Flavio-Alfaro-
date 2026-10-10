// Repositorio de usuarios en memoria, para probar sin MySQL. Reproduce las reglas de la base:
// cedula unica por hospital, correo unico en todo el sistema y jefe inmediato del mismo hospital.
import type {
  CambiosUsuario,
  FiltrosUsuarios,
  UsuarioDetalle,
} from '../../src/modules/usuarios/usuarios.dominio';
import type { IUsuariosRepository } from '../../src/modules/usuarios/usuarios.repository';
import { AppError } from '../../src/shared/errors/AppError';

interface Guardado {
  empresaId: number;
  usuario: UsuarioDetalle;
  passwordHash: string | null;
}

// Fecha que el repositorio real obtiene de CURDATE() cuando no se indica una
const HOY = '2026-10-09';

export function crearUsuariosEnMemoria(): {
  repositorio: IUsuariosRepository;
  // Ids de las personas a las que se les borro el refresh token
  sesionesCerradas: number[];
  claveGuardada: (id: number) => string | null | undefined;
} {
  let siguienteId = 200;
  const guardados = new Map<number, Guardado>();
  const sesionesCerradas: number[] = [];

  const buscarGuardado = (empresaId: number, id: number): Guardado | undefined => {
    const guardado = guardados.get(id);
    return guardado !== undefined && guardado.empresaId === empresaId ? guardado : undefined;
  };

  const datosJefe = (empresaId: number, jefeId: number | null): UsuarioDetalle['jefeInmediato'] => {
    if (jefeId === null) {
      return null;
    }
    const jefe = buscarGuardado(empresaId, jefeId);
    return jefe ? { id: jefe.usuario.id, nombres: jefe.usuario.nombres, apellidos: jefe.usuario.apellidos } : null;
  };

  const repositorio: IUsuariosRepository = {
    buscar: (empresaId, filtros: FiltrosUsuarios) => {
      const terminos = (filtros.busqueda ?? '')
        .toLowerCase()
        .split(/\s+/)
        .filter((termino) => termino.length > 0);

      const coincidentes = [...guardados.values()]
        .filter((g) => g.empresaId === empresaId)
        .map((g) => g.usuario)
        .filter((u) => filtros.estado === undefined || u.estado === filtros.estado)
        .filter((u) => filtros.areaId === undefined || u.area.id === filtros.areaId)
        .filter((u) =>
          terminos.every((termino) =>
            [u.cedula, u.apellidos, u.nombres, u.correo ?? ''].some((campo) =>
              campo.toLowerCase().startsWith(termino),
            ),
          ),
        )
        .sort((a, b) => a.apellidos.localeCompare(b.apellidos) || a.nombres.localeCompare(b.nombres));

      const desde = (filtros.pagina - 1) * filtros.porPagina;
      return Promise.resolve({
        usuarios: coincidentes.slice(desde, desde + filtros.porPagina),
        total: coincidentes.length,
      });
    },

    obtener: (empresaId, id) => Promise.resolve(buscarGuardado(empresaId, id)?.usuario ?? null),

    crear: (empresaId, datos) => {
      const todos = [...guardados.values()];
      const cedulaRepetida = todos.some(
        (g) => g.empresaId === empresaId && g.usuario.cedula === datos.cedula,
      );
      const correoRepetido = datos.correo !== null && todos.some((g) => g.usuario.correo === datos.correo);
      if (cedulaRepetida || correoRepetido) {
        return Promise.reject(AppError.conflicto('Ya existe una persona con esa cedula o ese correo'));
      }
      if (datos.jefeInmediatoId !== null && buscarGuardado(empresaId, datos.jefeInmediatoId) === undefined) {
        return Promise.reject(AppError.reglaDeNegocio('El jefe inmediato no existe en este hospital'));
      }

      siguienteId += 1;
      guardados.set(siguienteId, {
        empresaId,
        passwordHash: datos.passwordHash,
        usuario: {
          id: siguienteId,
          cedula: datos.cedula,
          nombres: datos.nombres,
          apellidos: datos.apellidos,
          correo: datos.correo,
          telefono: datos.telefono,
          rol: datos.rol,
          area: { id: datos.areaId, detalle: `Area ${datos.areaId}` },
          cargo: { id: datos.cargoId, detalle: `Cargo ${datos.cargoId}` },
          jefeInmediato: datosJefe(empresaId, datos.jefeInmediatoId),
          fechaIngreso: datos.fechaIngreso,
          estado: 'ACTIVO',
          fechaBaja: null,
          tieneCuenta: datos.passwordHash !== null,
        },
      });
      return Promise.resolve(siguienteId);
    },

    actualizar: (empresaId, id, cambios: CambiosUsuario) => {
      const guardado = buscarGuardado(empresaId, id);
      if (!guardado) {
        return Promise.resolve();
      }
      const u = guardado.usuario;
      if (cambios.jefeInmediatoId !== undefined && cambios.jefeInmediatoId !== null) {
        if (buscarGuardado(empresaId, cambios.jefeInmediatoId) === undefined) {
          return Promise.reject(AppError.reglaDeNegocio('El jefe inmediato no existe en este hospital'));
        }
      }

      if (cambios.cedula !== undefined) u.cedula = cambios.cedula;
      if (cambios.nombres !== undefined) u.nombres = cambios.nombres;
      if (cambios.apellidos !== undefined) u.apellidos = cambios.apellidos;
      if (cambios.correo !== undefined) u.correo = cambios.correo;
      if (cambios.telefono !== undefined) u.telefono = cambios.telefono;
      if (cambios.areaId !== undefined) u.area = { id: cambios.areaId, detalle: `Area ${cambios.areaId}` };
      if (cambios.cargoId !== undefined) u.cargo = { id: cambios.cargoId, detalle: `Cargo ${cambios.cargoId}` };
      if (cambios.rol !== undefined) u.rol = cambios.rol;
      if (cambios.fechaIngreso !== undefined) u.fechaIngreso = cambios.fechaIngreso;
      if (cambios.jefeInmediatoId !== undefined) {
        u.jefeInmediato = datosJefe(empresaId, cambios.jefeInmediatoId);
      }
      if (cambios.passwordHash !== undefined) {
        guardado.passwordHash = cambios.passwordHash;
        u.tieneCuenta = cambios.passwordHash !== null;
      }
      if (cambios.cerrarSesion === true) {
        sesionesCerradas.push(id);
      }
      return Promise.resolve();
    },

    darDeBaja: (empresaId, id, fechaBaja) => {
      const guardado = buscarGuardado(empresaId, id);
      if (guardado) {
        guardado.usuario.estado = 'INACTIVO';
        guardado.usuario.fechaBaja = fechaBaja ?? HOY;
        sesionesCerradas.push(id);
      }
      return Promise.resolve();
    },

    reactivar: (empresaId, id) => {
      const guardado = buscarGuardado(empresaId, id);
      if (guardado) {
        guardado.usuario.estado = 'ACTIVO';
        guardado.usuario.fechaBaja = null;
      }
      return Promise.resolve();
    },
  };

  return {
    repositorio,
    sesionesCerradas,
    claveGuardada: (id) => guardados.get(id)?.passwordHash,
  };
}