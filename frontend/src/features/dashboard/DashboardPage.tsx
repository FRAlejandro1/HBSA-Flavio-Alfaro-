import { useEffect, useRef, useState } from 'react';
import { cerrarSesion } from '@/features/auth/auth.api';
import { InicioEmpleado } from '@/features/dashboard/components/inicio/InicioEmpleado';
import { AccessibilityTools } from '@/features/dashboard/components/layout/AccessibilityTools';
import { DashboardHeader } from '@/features/dashboard/components/layout/DashboardHeader';
import { DashboardSidebar } from '@/features/dashboard/components/layout/DashboardSidebar';
import { useSolicitudesPropias } from '@/features/dashboard/hooks/useSolicitudesPropias';
import type { DashboardProps } from '@/features/dashboard/model/dashboard.types';
import { SolicitudVacacionesForm } from '@/features/solicitud-vacaciones/SolicitudVacacionesForm';

export function DashboardPage({
  usuario,
  onLogout,
  tema,
  cambiarTema,
  anunciar,
}: DashboardProps) {
  const propias = useSolicitudesPropias(anunciar);
  const [cerrando, setCerrando] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  // Al abrir o cerrar el formulario el contenido cambia: el foco pasa al título de la vista
  const formularioAnterior = useRef(mostrarFormulario);
  useEffect(() => {
    if (formularioAnterior.current === mostrarFormulario) {
      return;
    }

    formularioAnterior.current = mostrarFormulario;
    window.scrollTo({ top: 0 });
    document.getElementById('titulo-pagina')?.focus();
  }, [mostrarFormulario]);

  async function salir() {
    setCerrando(true);

    try {
      await cerrarSesion();
    } catch {
      anunciar(
        'No se pudo confirmar el cierre de sesión con el servidor.',
      );
    } finally {
      onLogout();
      setCerrando(false);
    }
  }

  function cerrarFormulario() {
    setMostrarFormulario(false);
  }

  // Desde el formulario, Inicio vuelve al dashboard; en el dashboard sube al comienzo
  function irAInicio() {
    if (mostrarFormulario) {
      cerrarFormulario();
      return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="app-layout">
      <DashboardSidebar
        cerrarSesion={() => void salir()}
        cerrando={cerrando}
        anunciar={anunciar}
        alIrAInicio={irAInicio}
      />

      <main className="dashboard-main">
        <DashboardHeader
          usuario={usuario}
          tema={tema}
          cambiarTema={cambiarTema}
          anunciar={anunciar}
          titulo={mostrarFormulario ? 'Solicitar vacaciones' : undefined}
          migas={
            mostrarFormulario
              ? [{ texto: 'Inicio', alSeleccionar: cerrarFormulario }]
              : undefined
          }
        />

        {mostrarFormulario ? (
          <SolicitudVacacionesForm
            usuario={usuario}
            onCancel={cerrarFormulario}
            onCreated={async () => {
              setMostrarFormulario(false);
              anunciar(
                'La solicitud de vacaciones se registró correctamente.',
              );
              await propias.cargarSolicitudes(true);
            }}
          />
        ) : (
          <InicioEmpleado
            datos={propias}
            onSolicitarVacaciones={() => setMostrarFormulario(true)}
            anunciar={anunciar}
          />
        )}

        <footer className="dashboard-footer">
          <span>Hospital Básico San Andrés · Flavio Alfaro</span>
          <span>{usuario.area.detalle || 'Área no especificada'}</span>
        </footer>
      </main>

      <AccessibilityTools anunciar={anunciar} />
    </div>
  );
}