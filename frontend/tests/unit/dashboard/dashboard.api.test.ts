import { describe, expect, it, vi, beforeEach } from 'vitest';
import { peticionApi } from '@/api/http';
import { listarSolicitudes } from '@/features/dashboard/dashboard.api';
import type { RespuestaSolicitudes } from '@/features/dashboard/dashboard.types';

vi.mock('@/api/http', () => ({
  peticionApi: vi.fn(),
}));

const peticionApiMock = vi.mocked(peticionApi);

describe('listarSolicitudes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('consulta la primera página de solicitudes con autenticación', async () => {
    const respuesta: RespuestaSolicitudes = {
      solicitudes: [],
      total: 0,
      pagina: 1,
      porPagina: 20,
    };
    peticionApiMock.mockResolvedValue(respuesta);

    await expect(listarSolicitudes()).resolves.toEqual(respuesta);

    expect(peticionApiMock).toHaveBeenCalledWith(
      '/api/vacaciones/solicitudes?pagina=1&porPagina=20',
      { autenticada: true },
    );
  });

  it('propaga los errores de la API', async () => {
    peticionApiMock.mockRejectedValueOnce(new Error('No autorizado'));

    await expect(listarSolicitudes()).rejects.toThrow('No autorizado');
  });
});
