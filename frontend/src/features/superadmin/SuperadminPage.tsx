import { useEffect, useRef, useState } from 'react';
import { cerrarSesion } from '@/features/auth/auth.api';
import { SuperadminInicio } from '@/features/superadmin/components/SuperadminInicio';
import { DashboardHeader } from '@/features/dashboard/components/layout/DashboardHeader';
import type { MigaDePan } from '@/features/dashboard/components/layout/DashboardHeader';
import { DashboardSidebar } from '@/features/dashboard/components/layout/DashboardSidebar';
import { useSolicitudesPropias } from '@/features/dashboard/hooks/useSolicitudesPropias';
import type { DashboardProps } from '@/features/dashboard/model/dashboard.types';
import { SolicitudVacacionesForm } from '@/features/solicitud-vacaciones/SolicitudVacacionesForm';
import { AdminInicio } from '@/features/superadmin/components/AdminInicio';
import { AdminSeccionPendiente } from '@/features/superadmin/components/AdminSeccionPendiente';
import { DiasVacaciones } from '@/features/superadmin/components/DiasVacaciones';
import { buscarSeccion } from '@/features/superadmin/model/superadmin.secciones';
import type { IdSeccionAdmin } from '@/features/superadmin/model/superadmin.types';
import '@/features/superadmin/superadmin.css';

type Vista = 'inicio' | 'solicitar' | 'administracion' | IdSeccionAdmin;

function esSeccionAdmin(vista: Vista): vista is IdSeccionAdmin {
  return (
    vista !== 'inicio' && vista !== 'solicitar' && vista !== 'administracion'
  );
}

export function SuperadminPage({
  usuario,
  onLogout,
  tema,
  cambiarTema,
  anunciar,
}: DashboardProps) {
  const propias = useSolicitudesPropias(anunciar);
  const [vista, setVista] = useState<Vista>('inicio');
  const [cerrando, setCerrando] = useState(false);

  // Al cambiar de pantalla el contenido cambia: el foco pasa al título de la vista
  const vistaAnterior = useRef<Vista>(vista);
  useEffect(() => {
    if (vistaAnterior.current === vista) {
      return;
    }

    vistaAnterior.current = vista;
    window.scrollTo({ top: 0 });
    document.getElementById('titulo-pagina')?.focus();
  }, [vista]);

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

  function irAInicio() {
    if (vista === 'inicio') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setVista('inicio');
  }

  function irAAdministracion() {
    setVista('administracion');
  }

  const seccion = esSeccionAdmin(vista) ? buscarSeccion(vista) : undefined;
  const enAdministracion = vista === 'administracion' || esSeccionAdmin(vista);

  let titulo: string | undefined;
  let migas: MigaDePan[] | undefined;

  if (vista === 'solicitar') {
    titulo = 'Solicitar vacaciones';
    migas = [{ texto: 'Inicio', alSeleccionar: irAInicio }];
  } else if (vista === 'administracion') {
    titulo = 'Administración';
    migas = [{ texto: 'Inicio', alSeleccionar: irAInicio }];
  } else if (seccion) {
    titulo = seccion.titulo;
    migas = [
      { texto: 'Inicio', alSeleccionar: irAInicio },
      { texto: 'Administración', alSeleccionar: irAAdministracion },
    ];
  }

  return (
    <div className="app-layout">
      <DashboardSidebar
        cerrarSesion={() => void salir()}
        cerrando={cerrando}
        anunciar={anunciar}
        alIrAInicio={irAInicio}
        mostrarAdministracion
        alIrAAdministracion={irAAdministracion}
        seccionActiva={enAdministracion ? 'administracion' : 'inicio'}
      />

      <main className="dashboard-main">
        <DashboardHeader
          usuario={usuario}
          tema={tema}
          cambiarTema={cambiarTema}
          anunciar={anunciar}
          titulo={titulo}
          migas={migas}
        />

        {vista === 'inicio' && (
          <SuperadminInicio
            datos={propias}
            onSolicitarVacaciones={() => setVista('solicitar')}
            anunciar={anunciar}
          />
        )}

        {vista === 'solicitar' && (
          <SolicitudVacacionesForm
            usuario={usuario}
            onCancel={() => setVista('inicio')}
            onCreated={async () => {
              setVista('inicio');
              anunciar(
                'La solicitud de vacaciones se registró correctamente.',
              );
              await propias.cargarSolicitudes(true);
            }}
          />
        )}

        {vista === 'administracion' && <AdminInicio alAbrir={setVista} />}

        {vista === 'dias' && (
          <DiasVacaciones usuario={usuario} anunciar={anunciar} />
        )}

        {seccion?.detalle && (
          <AdminSeccionPendiente seccion={seccion} anunciar={anunciar} />
        )}

        <footer className="dashboard-footer">
          <span>Hospital Básico San Andrés · Flavio Alfaro</span>
          <span>{usuario.area.detalle || 'Área no especificada'}</span>
        </footer>
      </main>
    </div>
  );
}
