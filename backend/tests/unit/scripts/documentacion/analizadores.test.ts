// Pruebas de los analizadores de la documentacion automatica: puro texto de entrada y datos de salida.
import { describe, expect, it } from 'vitest';
import {
  analizarCommits,
  analizarMigracion,
  analizarMontajes,
  analizarRutas,
  comentarioEncabezado,
  humanizar,
  resumirLcov,
} from '../../../../src/scripts/documentacion/analizadores';

describe('comentarioEncabezado', () => {
  it('une las lineas de comentario iniciales en una frase', () => {
    const codigo = '// Reglas de negocio de usuarios.\n// Los permisos se validan aqui.\n\nimport x from "y";';
    expect(comentarioEncabezado(codigo)).toBe('Reglas de negocio de usuarios. Los permisos se validan aqui.');
  });

  it('ignora las lineas de referencia triple barra', () => {
    expect(comentarioEncabezado('/// <reference types="vite/client" />\n// Tipos de Vite\nconst a = 1;')).toBe(
      'Tipos de Vite',
    );
  });

  it('en SQL ignora la linea decorativa y la que nombra al archivo', () => {
    const sql = '-- ==========\n-- 001_esquema.sql (v2)\n-- Esquema base del sistema.\n-- ==========\nSET NAMES utf8mb4;';
    expect(comentarioEncabezado(sql, '--')).toBe('Esquema base del sistema.');
  });

  it('devuelve vacio si el archivo no empieza con comentario', () => {
    expect(comentarioEncabezado('const a = 1;')).toBe('');
  });
});

describe('humanizar', () => {
  it('separa camelCase y guiones', () => {
    expect(humanizar('listarAreas')).toBe('listar areas');
    expect(humanizar('permisos-hora')).toBe('permisos hora');
  });
});

describe('analizarRutas', () => {
  it('toma los roles de una variable y la sesion de todo el router', () => {
    const codigo = `
      router.use(deps.autenticar, multitenant);
      const administraAreas = authorizeRole('SUPERADMIN');
      router.get('/areas', c.listarAreas);
      router.post('/areas', administraAreas, validate({ body: esquemaCrearArea }), c.crearArea);
      router.patch(
        '/areas/:id',
        administraAreas,
        validate({ params: esquemaId }),
        c.actualizarArea,
      );
    `;
    expect(analizarRutas(codigo)).toEqual([
      { metodo: 'GET', ruta: '/areas', accion: 'listar areas', acceso: 'Cualquier persona con sesión iniciada' },
      { metodo: 'POST', ruta: '/areas', accion: 'crear area', acceso: 'Roles: SUPERADMIN' },
      { metodo: 'PATCH', ruta: '/areas/:id', accion: 'actualizar area', acceso: 'Roles: SUPERADMIN' },
    ]);
  });

  it('usa los roles de todo el router cuando la ruta no define otros', () => {
    const codigo = `
      router.use(deps.autenticar, multitenant, authorizeRole('SUPERADMIN', 'TALENTO_HUMANO'));
      router.get('/', validate({ query: esquema }), c.listar);
    `;
    expect(analizarRutas(codigo)[0]?.acceso).toBe('Roles: SUPERADMIN, TALENTO_HUMANO');
  });

  it('distingue rutas publicas y rutas con sesion', () => {
    const codigo = `
      router.get('/csrf', deps.controller.obtenerCsrf);
      router.post('/login', deps.limitador, validate({ body: esquemaLogin }), deps.controller.login);
      router.post('/logout', deps.autenticar, deps.controller.logout);
    `;
    expect(analizarRutas(codigo).map((r) => [r.ruta, r.acceso])).toEqual([
      ['/csrf', 'Público'],
      ['/login', 'Público'],
      ['/logout', 'Cualquier persona con sesión iniciada'],
    ]);
  });

  it('lee los roles escritos directamente en la ruta', () => {
    const codigo = "router.delete('/:id', authorizeRole('SUPERADMIN'), c.eliminar);";
    expect(analizarRutas(codigo)[0]?.acceso).toBe('Roles: SUPERADMIN');
  });
});

describe('analizarMontajes', () => {
  it('relaciona cada modulo con su prefijo', () => {
    const app = "app.use('/api/auth', crearRouterAuth());\napp.use('/api/permisos-hora', crearRouterPermisosHora());";
    const montajes = analizarMontajes(app);
    expect(montajes.get('auth')).toBe('/api/auth');
    expect(montajes.get('permisoshora')).toBe('/api/permisos-hora');
  });
});

describe('analizarMigracion', () => {
  const sql = `
-- Zonas: nivel mas alto
CREATE TABLE zonas (
  id INT, -- clave
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- Areas del hospital
CREATE TABLE areas (
  id INT,
  zona_id INT,
  CONSTRAINT fk_zona FOREIGN KEY (zona_id) REFERENCES zonas (id)
) ENGINE=InnoDB;

-- Cierra la dependencia
ALTER TABLE zonas
  ADD CONSTRAINT fk_a FOREIGN KEY (id) REFERENCES areas (id);

DELIMITER $$

-- Bloquea cambios
CREATE TRIGGER trg_x BEFORE UPDATE ON zonas
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000';
END$$
DELIMITER ;
`;

  it('encuentra las tablas con la descripcion que las precede', () => {
    expect(analizarMigracion(sql).tablas).toEqual([
      { nombre: 'zonas', descripcion: 'Zonas: nivel mas alto' },
      { nombre: 'areas', descripcion: 'Areas del hospital' },
    ]);
  });

  it('encuentra las relaciones, incluidas las de un ALTER TABLE', () => {
    expect(analizarMigracion(sql).relaciones).toEqual([
      { desde: 'areas', hacia: 'zonas' },
      { desde: 'zonas', hacia: 'areas' },
    ]);
  });

  it('encuentra los triggers', () => {
    expect(analizarMigracion(sql).triggers).toEqual([
      { nombre: 'trg_x', descripcion: 'Bloquea cambios' },
    ]);
  });
});

describe('analizarCommits', () => {
  it('separa tipo, alcance y descripcion', () => {
    const commits = analizarCommits([
      'a1b2c3d|2026-10-09|feat(usuarios): crud y busqueda',
      'e4f5a6b|2026-10-08|fix: corrige un error',
      'deadbee|2026-10-07|Mensaje libre',
    ]);
    expect(commits).toEqual([
      { hash: 'a1b2c3d', fecha: '2026-10-09', tipo: 'feat', alcance: 'usuarios', descripcion: 'crud y busqueda' },
      { hash: 'e4f5a6b', fecha: '2026-10-08', tipo: 'fix', alcance: null, descripcion: 'corrige un error' },
      { hash: 'deadbee', fecha: '2026-10-07', tipo: 'otros', alcance: null, descripcion: 'Mensaje libre' },
    ]);
  });

  it('manda a "otros" un tipo que no existe y conserva los dos puntos del texto', () => {
    const [commit] = analizarCommits(['abc1234|2026-10-01|wip: algo | con barra']);
    expect(commit).toMatchObject({ tipo: 'otros', descripcion: 'wip: algo | con barra' });
  });
});

describe('resumirLcov', () => {
  it('suma las lineas y calcula el porcentaje', () => {
    const lcov = 'SF:a.ts\nLF:10\nLH:5\nend_of_record\nSF:b.ts\nLF:10\nLH:10\nend_of_record\n';
    expect(resumirLcov(lcov)).toEqual({ lineas: 20, cubiertas: 15, porcentaje: 75 });
  });

  it('devuelve cero si no hay lineas', () => {
    expect(resumirLcov('')).toEqual({ lineas: 0, cubiertas: 0, porcentaje: 0 });
  });
});