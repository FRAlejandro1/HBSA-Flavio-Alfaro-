// Pruebas de los generadores sobre el repositorio real: comprueban que la documentacion refleja el codigo actual.
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  generarApi,
  generarArquitectura,
  generarBaseDeDatos,
  generarCambios,
  generarDecisiones,
  generarIndice,
} from '../../../../src/scripts/documentacion/generadores';

// tests/unit/scripts/documentacion -> raiz del repositorio
const raiz = path.resolve(__dirname, '../../../../..');

describe('generadores sobre el repositorio', () => {
  it('la API lista el login publico y las rutas de usuarios con sus roles', async () => {
    const documento = await generarApi(raiz);
    expect(documento.contenido).toContain('/api/auth/login');
    expect(documento.contenido).toContain('Roles: SUPERADMIN, TALENTO_HUMANO');
    expect(documento.contenido).toContain('| Código | Estado HTTP |');
  });

  it('la base de datos lista tablas, relaciones y el trigger de la bitacora', async () => {
    const documento = await generarBaseDeDatos(raiz);
    expect(documento.contenido).toContain('| usuarios |');
    expect(documento.contenido).toContain('| zonas |');
    expect(documento.contenido).toContain('trg_audit_no_update');
    expect(documento.contenido).toContain('**usuarios** depende de');
  });

  it('la arquitectura describe middlewares y modulos', async () => {
    const documento = await generarArquitectura(raiz);
    expect(documento.contenido).toContain('authenticate.ts');
    expect(documento.contenido).toContain('### Usuarios');
    expect(documento.contenido).toContain('**Servicio** (usuarios.service.ts)');
  });

  it('las decisiones reunen los archivos de docs/decisiones', async () => {
    const documento = await generarDecisiones(raiz);
    expect(documento.contenido).toContain('TypeScript estricto en todo el proyecto');
    expect(documento.contenido).toContain('| Decisión | Fecha | Estado |');
  });

  it('los cambios y el indice se generan', async () => {
    expect((await generarCambios(raiz)).contenido).toContain('# Cambios recientes');
    const indice = await generarIndice(raiz, [await generarApi(raiz)]);
    expect(indice.contenido).toContain('# Documentación del sistema');
    expect(indice.contenido).toContain('[API](api.md)');
  });

  it('el indice resume la cobertura cuando recibe una carpeta sin reportes', async () => {
    const indice = await generarIndice(raiz, [], path.join(raiz, 'carpeta-que-no-existe'));
    expect(indice.contenido).toContain('No se encontraron reportes de cobertura.');
  });
});