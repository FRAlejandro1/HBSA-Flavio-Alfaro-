import { useCallback, useEffect, useState } from 'react';
import {
  listarSolicitudes,
  obtenerSolicitud,
} from '@/features/dashboard/api/dashboard.api';
import type {
  Solicitud,
  SolicitudDetalle,
} from '@/features/dashboard/model/dashboard.types';

// Obtiene la solicitud más reciente según su fecha de envío.
function obtenerUltimaSolicitud(solicitudes: Solicitud[]): Solicitud | null {
  let ultima: Solicitud | null = null;

  for (const solicitud of solicitudes) {
    if (
      ultima === null ||
      new Date(solicitud.solicitadoAt).getTime() >
        new Date(ultima.solicitadoAt).getTime()
    ) {
      ultima = solicitud;
    }
  }

  return ultima;
}

// Gestiona las solicitudes propias, sus filtros y el seguimiento seleccionado.
export function useSolicitudesPropias(anunciar: (mensaje: string) => void) {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('TODAS');

  const [solicitudSeleccionadaId, setSolicitudSeleccionadaId] = useState<
    number | null
  >(null);
  const [detalleSolicitud, setDetalleSolicitud] =
    useState<SolicitudDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState('');
  const [intentoDetalle, setIntentoDetalle] = useState(0);

  const ultimaSolicitud = obtenerUltimaSolicitud(solicitudes);

  // Carga las solicitudes y permite seleccionar la más reciente al actualizar.
  const cargarSolicitudes = useCallback(async (seleccionarUltima = false) => {
    setCargando(true);
    setError('');

    try {
      const respuesta = await listarSolicitudes();
      setSolicitudes(respuesta.solicitudes);
      setTotal(respuesta.total);

      const ultima = obtenerUltimaSolicitud(respuesta.solicitudes);
      if (ultima) {
        setSolicitudSeleccionadaId((actual) =>
          seleccionarUltima || actual === null ? ultima.id : actual,
        );
      }
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : 'No se pudieron cargar las solicitudes.',
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarSolicitudes();
  }, [cargarSolicitudes]);

  useEffect(() => {
    if (solicitudSeleccionadaId === null) {
      setDetalleSolicitud(null);
      setCargandoDetalle(false);
      setErrorDetalle('');
      return;
    }

    const solicitudId = solicitudSeleccionadaId;
    let cancelado = false;

    async function cargarDetalle() {
      setCargandoDetalle(true);
      setErrorDetalle('');
      setDetalleSolicitud(null);

      try {
        const respuesta = await obtenerSolicitud(solicitudId);
        if (!cancelado) {
          setDetalleSolicitud(respuesta.solicitud);
        }
      } catch (errorDesconocido) {
        if (!cancelado) {
          setErrorDetalle(
            errorDesconocido instanceof Error
              ? errorDesconocido.message
              : 'No se pudo cargar el detalle de la solicitud.',
          );
        }
      } finally {
        if (!cancelado) {
          setCargandoDetalle(false);
        }
      }
    }

    void cargarDetalle();

    return () => {
      cancelado = true;
    };
  }, [solicitudSeleccionadaId, intentoDetalle]);

  const solicitudesFiltradas =
    filtro === 'TODAS' || filtro === 'VACACIONES' ? solicitudes : [];

  function seleccionarSolicitud(solicitud: Solicitud) {
    setSolicitudSeleccionadaId(solicitud.id);
    anunciar(
      `Consultando el seguimiento de la solicitud ${solicitud.ordenTramite}.`,
    );
  }

  function verDetalleAviso(solicitudId: number) {
    setSolicitudSeleccionadaId(solicitudId);
    anunciar('Consultando el seguimiento de la solicitud del aviso.');
  }

  function reintentarDetalle() {
    setIntentoDetalle((actual) => actual + 1);
  }

  return {
    solicitudesFiltradas,
    ultimaSolicitud,
    total,
    cargando,
    error,
    filtro,
    setFiltro,
    solicitudSeleccionadaId,
    detalleSolicitud,
    cargandoDetalle,
    errorDetalle,
    cargarSolicitudes,
    seleccionarSolicitud,
    verDetalleAviso,
    reintentarDetalle,
  };
}

export type SolicitudesPropias = ReturnType<typeof useSolicitudesPropias>;
