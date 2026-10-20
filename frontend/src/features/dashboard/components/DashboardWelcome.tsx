import type { UsuarioAutenticado } from '@/features/auth/auth.types';

interface Props {
  usuario: UsuarioAutenticado;
}

export function DashboardWelcome({ usuario }: Props) {
  return (
    <section className="welcome-row">
      <div>
        <h2>Hola, {usuario.nombres}</h2>
        <p>Consulte sus solicitudes y gestione sus vacaciones desde aquí.</p>
      </div>
      <span className="role-chip">{usuario.rol.replaceAll('_', ' ')}</span>
    </section>
  );
}
