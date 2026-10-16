// Pruebas del analisis de la plantilla: columnas, validacion de filas y plan de cambios, con tablas en memoria.
import { describe, expect, it } from 'vitest';
import {
  analizarTabla,
  convertirFecha,
  detectarColumnas,
  normalizarCedula,
} from '../../../../src/modules/importacion/importacion.analisis';
import type { ContextoAnalisis } from '../../../../src/modules/importacion/importacion.analisis';
import type { Celda, TablaCruda } from '../../../../src/modules/importacion/lectores/tipos';
import { usuarioExistente } from '../../../helpers/importacion';

const ENCABEZADOS = ['Cédula', 'Nombres', 'Apellidos', 'Área', 'Cargo', 'Fecha de ingreso'];

function tabla(filas: Celda[][], encabezados: string[] = ENCABEZADOS): TablaCruda {
  return { encabezados, filas };
}

// Fila completa y valida de una persona nueva
function fila(cedula: Celda, area: Celda = 'Emergencia', cargo: Celda = 'Medico', ingreso: Celda = '2021-05-10'): Celda[] {
  return [cedula, 'Rosa', 'Mena', area, cargo, ingreso];
}

function contexto(cambios: Partial<ContextoAnalisis> = {}): ContextoAnalisis {
  return {
    hoy: '2026-10-13',
    actor: { id: 99, rol: 'TALENTO_HUMANO' },
    areas: [
      { id: 1, detalle: 'Emergencia' },
      { id: 2, detalle: 'Consulta Externa' },
    ],
    cargos: [
      { id: 1, detalle: 'Médico' },
      { id: 2, detalle: 'Enfermera' },
    ],
    usuarios: [usuarioExistente()],
    bajaAusentes: false,
    ...cambios,
  };
}

describe('detectarColumnas', () => {
  it('reconoce los encabezados por sinonimos, sin importar tildes ni mayusculas', () => {
    const { indices } = detectarColumnas(['CI', 'NOMBRE', 'Apellido', 'Unidad', 'Puesto', 'Fecha_de_Ingreso', 'E-mail'], {});
    expect(indices).toEqual({ cedula: 0, nombres: 1, apellidos: 2, area: 3, cargo: 4, fechaIngreso: 5, correo: 6 });
  });

  it('el mapeo indicado manda sobre los sinonimos', () => {
    const { indices } = detectarColumnas(['Cédula', 'Documento'], { cedula: 'documento' });
    expect(indices.cedula).toBe(1);
  });

  it('informa de una columna del mapeo que no existe o repetida', () => {
    expect(detectarColumnas(['A'], { cedula: 'Inexistente' }).erroresMapeo[0]).toMatch(/no existe/);
    expect(detectarColumnas(['A', 'B'], { cedula: 'A', nombres: 'A' }).erroresMapeo[0]).toMatch(/dos datos/);
  });

  it.each([
    'Cédula jefe',
    'Cédula del jefe',
    'Cédula del jefe inmediato',
    'CI jefe inmediato',
    'C.I. del jefe',
    'Identificación del jefe',
    'Cedula_Jefe_Directo',
    'Cédula del supervisor',
  ])('reconoce "%s" como la cédula del jefe y no la confunde con la de la persona', (variante) => {
    const { indices } = detectarColumnas(['Cédula', variante], {});
    expect(indices).toEqual({ cedula: 0, cedulaJefe: 1 });
  });
});

describe('conversiones', () => {
  it('completa con cero una cedula de 9 digitos y avisa', () => {
    expect(normalizarCedula(102030405)).toMatchObject({ ok: true, valor: '0102030405' });
    expect(normalizarCedula('1020304050')).toEqual({ ok: true, valor: '1020304050' });
    expect(normalizarCedula('010-203-0405')).toEqual({ ok: true, valor: '0102030405' });
  });

  it('rechaza cedulas vacias, con letras o de largo incorrecto', () => {
    expect(normalizarCedula(null)).toMatchObject({ ok: false });
    expect(normalizarCedula('01020304AB')).toMatchObject({ ok: false });
    expect(normalizarCedula('12345')).toMatchObject({ ok: false });
  });

  it('entiende fechas en texto, de Excel y numeros de serie', () => {
    expect(convertirFecha('2021-05-10')).toEqual({ ok: true, valor: '2021-05-10' });
    expect(convertirFecha('10/05/2021')).toEqual({ ok: true, valor: '2021-05-10' });
    expect(convertirFecha('5-6-2021')).toEqual({ ok: true, valor: '2021-06-05' });
    expect(convertirFecha(new Date(Date.UTC(2021, 4, 10)))).toEqual({ ok: true, valor: '2021-05-10' });
    expect(convertirFecha(44326)).toEqual({ ok: true, valor: '2021-05-10' });
  });

  it('rechaza fechas inexistentes o no reconocidas', () => {
    expect(convertirFecha('31/02/2021')).toMatchObject({ ok: false });
    expect(convertirFecha('ayer')).toMatchObject({ ok: false });
    expect(convertirFecha(null)).toMatchObject({ ok: false });
  });
});

describe('analizarTabla: estructura', () => {
  it('sin una columna obligatoria no se puede aplicar y se dice cual falta', () => {
    const resultado = analizarTabla(tabla([], ['Cédula', 'Nombres']), {}, contexto());
    expect(resultado.camposSinColumna).toEqual(['apellidos', 'area', 'cargo', 'fechaIngreso']);
    expect(resultado.puedeAplicar).toBe(false);
  });
});

describe('analizarTabla: personas nuevas', () => {
  it('crea una persona buscando area y cargo por nombre sin tildes ni mayusculas', () => {
    const resultado = analizarTabla(tabla([fila('0200000001', 'consulta  EXTERNA', 'medico')]), {}, contexto());
    expect(resultado.filas[0]).toMatchObject({ fila: 2, accion: 'CREAR', errores: [] });
    expect(resultado.plan.crear[0]).toMatchObject({ cedula: '0200000001', areaId: 2, cargoId: 1, rol: 'EMPLEADO' });
    expect(resultado.puedeAplicar).toBe(true);
  });

  it('un area o cargo desconocido es un error y se lista para corregirlo', () => {
    const resultado = analizarTabla(
      tabla([fila('0200000001', 'Quirofano', 'Medico'), fila('0200000002', 'Quirófano', 'Cirujano')]),
      {},
      contexto(),
    );
    expect(resultado.filas.map((f) => f.accion)).toEqual(['ERROR', 'ERROR']);
    expect(resultado.desconocidos.areas).toEqual([{ nombre: 'Quirofano', filas: 2 }]);
    expect(resultado.desconocidos.cargos).toEqual([{ nombre: 'Cirujano', filas: 1 }]);
    expect(resultado.puedeAplicar).toBe(false);
  });

  it('avisa cuando completa una cedula de 9 digitos', () => {
    const resultado = analizarTabla(tabla([fila(200000001)]), {}, contexto());
    expect(resultado.plan.crear[0]?.cedula).toBe('0200000001');
    expect(resultado.filas[0]?.advertencias[0]).toMatch(/cero inicial/);
  });

  it('rechaza cedulas y correos repetidos dentro del archivo', () => {
    const encabezados = [...ENCABEZADOS, 'Correo'];
    const resultado = analizarTabla(
      tabla(
        [
          [...fila('0200000001'), 'rosa@hospital.test'],
          [...fila('0200000001'), 'otra@hospital.test'],
          [...fila('0200000002'), 'ROSA@hospital.test'],
        ],
        encabezados,
      ),
      {},
      contexto(),
    );
    expect(resultado.filas[1]?.errores[0]).toMatch(/fila 2/);
    expect(resultado.filas[2]?.errores[0]).toMatch(/correo ya aparece en la fila 2/);
  });

  it('rechaza un correo que ya pertenece a otra persona del hospital', () => {
    const resultado = analizarTabla(
      tabla([[...fila('0200000001'), 'ana@hospital.test']], [...ENCABEZADOS, 'Correo']),
      {},
      contexto(),
    );
    expect(resultado.filas[0]?.errores[0]).toMatch(/pertenece a otra persona/);
  });

  it('una persona que no existe y ya viene con fecha de baja se omite', () => {
    const resultado = analizarTabla(
      tabla([[...fila('0200000001'), '2026-09-30']], [...ENCABEZADOS, 'Fecha de baja']),
      {},
      contexto(),
    );
    expect(resultado.filas[0]?.accion).toBe('OMITIR');
    expect(resultado.puedeAplicar).toBe(false);
  });
});

describe('analizarTabla: jefes', () => {
  const encabezados = [...ENCABEZADOS, 'Cédula del jefe'];

  it('acepta como jefe a alguien que se crea en el mismo archivo, aunque venga despues', () => {
    const resultado = analizarTabla(
      tabla([[...fila('0200000001'), '0200000002'], [...fila('0200000002'), null]], encabezados),
      {},
      contexto(),
    );
    expect(resultado.puedeAplicar).toBe(true);
    expect(resultado.plan.jefes).toEqual([{ cedula: '0200000001', cedulaJefe: '0200000002' }]);
  });

  it('acepta como jefe a alguien que ya esta en el hospital', () => {
    const resultado = analizarTabla(tabla([[...fila('0200000001'), '0102030405']], encabezados), {}, contexto());
    expect(resultado.plan.jefes).toHaveLength(1);
  });

  it('rechaza un jefe que no existe y una persona como su propio jefe', () => {
    const resultado = analizarTabla(
      tabla([[...fila('0200000001'), '0999999999'], [...fila('0200000002'), '0200000002']], encabezados),
      {},
      contexto(),
    );
    expect(resultado.filas[0]?.errores[0]).toMatch(/no existe en el hospital ni en el archivo/);
    expect(resultado.filas[1]?.errores[0]).toMatch(/propio jefe/);
  });
});

describe('analizarTabla: personas existentes', () => {
  it('actualiza solo lo que cambio y no borra datos opcionales vacios', () => {
    const resultado = analizarTabla(
      tabla(
        [['0102030405', 'Ana', 'Perez', 'Consulta Externa', 'Médico', '2020-03-01', null]],
        [...ENCABEZADOS, 'Correo'],
      ),
      {},
      contexto(),
    );
    expect(resultado.filas[0]?.accion).toBe('ACTUALIZAR');
    expect(resultado.plan.actualizar[0]).toMatchObject({ id: 10, cambios: { areaId: 2 }, cerrarSesion: false });
  });

  it('sin diferencias no hay cambios', () => {
    const resultado = analizarTabla(
      tabla([['0102030405', 'Ana', 'Perez', 'Emergencia', 'Médico', '2020-03-01']]),
      {},
      contexto(),
    );
    expect(resultado.filas[0]?.accion).toBe('SIN_CAMBIOS');
    expect(resultado.puedeAplicar).toBe(false);
  });

  it('cambiar el rol o el correo cierra la sesion de esa persona', () => {
    const resultado = analizarTabla(
      tabla(
        [['0102030405', 'Ana', 'Perez', 'Emergencia', 'Médico', '2020-03-01', 'Jefe de área']],
        [...ENCABEZADOS, 'Rol'],
      ),
      {},
      contexto(),
    );
    expect(resultado.plan.actualizar[0]).toMatchObject({ cambios: { rol: 'JEFE_AREA' }, cerrarSesion: true });
  });

  it('con fecha de baja da de baja a una persona activa', () => {
    const resultado = analizarTabla(
      tabla([[...fila('0102030405'), '2026-10-01']], [...ENCABEZADOS, 'Fecha de baja']),
      {},
      contexto(),
    );
    expect(resultado.filas[0]?.accion).toBe('BAJA');
    expect(resultado.plan.bajas).toEqual([{ id: 10, fechaBaja: '2026-10-01' }]);
  });

  it('a quien esta dado de baja en el sistema no lo reactiva: lo omite con una advertencia', () => {
    const resultado = analizarTabla(
      tabla([fila('0102030405')]),
      {},
      contexto({ usuarios: [usuarioExistente({ estado: 'INACTIVO', fechaBaja: '2026-01-01' })] }),
    );
    expect(resultado.filas[0]?.accion).toBe('OMITIR');
    expect(resultado.filas[0]?.advertencias[0]).toMatch(/dada de baja/);
  });
});

describe('analizarTabla: permisos', () => {
  it('Talento Humano no puede asignar ni modificar roles de administrador', () => {
    const encabezados = [...ENCABEZADOS, 'Rol'];
    const asignar = analizarTabla(tabla([[...fila('0200000001'), 'Administrador']], encabezados), {}, contexto());
    expect(asignar.filas[0]?.errores[0]).toMatch(/No puedes asignar el rol SUPERADMIN/);

    const modificar = analizarTabla(
      tabla([fila('0102030405')]),
      {},
      contexto({ usuarios: [usuarioExistente({ rol: 'SUPERADMIN' })] }),
    );
    expect(modificar.filas[0]?.errores[0]).toMatch(/No puedes gestionar/);
  });

  it('nadie puede modificarse a si mismo desde la importacion', () => {
    const resultado = analizarTabla(
      tabla([fila('0102030405')]),
      {},
      contexto({ actor: { id: 10, rol: 'TALENTO_HUMANO' } }),
    );
    expect(resultado.filas[0]?.errores[0]).toMatch(/ti mismo/);
  });
});

describe('analizarTabla: ausentes', () => {
  const equipo = [
    usuarioExistente({ id: 10, cedula: '0100000010' }),
    usuarioExistente({ id: 11, cedula: '0100000011', nombres: 'Luis', correo: null }),
    usuarioExistente({ id: 12, cedula: '0100000012', rol: 'SUPERADMIN', correo: null }),
    usuarioExistente({ id: 99, cedula: '0100000099', correo: null }),
  ];
  const filaDeAna = ['0100000010', 'Ana', 'Perez', 'Emergencia', 'Médico', '2020-03-01'];

  it('no se dan de baja a menos que se pida', () => {
    const resultado = analizarTabla(tabla([fila('0100000010', 'Emergencia', 'Médico')]), {}, contexto({ usuarios: equipo }));
    expect(resultado.ausentes).toEqual([]);
  });

  it('con la opcion, da de baja a quien falta, sin tocar al actor ni a quien no puede gestionar', () => {
    const resultado = analizarTabla(tabla([filaDeAna]), {}, contexto({ usuarios: equipo, bajaAusentes: true }));
    expect(resultado.ausentes.map((a) => a.cedula)).toEqual(['0100000011']);
    expect(resultado.plan.bajas).toEqual([{ id: 11, fechaBaja: '2026-10-13' }]);
    expect(resultado.resumen.ausentes).toBe(1);
    expect(resultado.puedeAplicar).toBe(true);
  });

  it('no avisa cuando se dan de baja menos de la mitad de las personas activas', () => {
    const resultado = analizarTabla(tabla([filaDeAna]), {}, contexto({ usuarios: equipo, bajaAusentes: true }));
    expect(resultado.avisos).toEqual([]);
  });

  it('avisa cuando se darian de baja mas de la mitad de las personas activas', () => {
    const grande = [10, 11, 12, 13].map((id) =>
      usuarioExistente({ id, cedula: `01000000${id}`, correo: null }),
    );
    const resultado = analizarTabla(tabla([filaDeAna]), {}, contexto({ usuarios: grande, bajaAusentes: true }));
    expect(resultado.ausentes).toHaveLength(3);
    expect(resultado.avisos[0]).toMatch(/Se darían de baja 3 de 4/);
  });
});