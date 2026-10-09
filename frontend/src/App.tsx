// Componente raiz: monta los proveedores globales y la pantalla inicial.
// En el Sprint 1 aqui se suman el proveedor de sesion, el de tema y las rutas.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Variables } from '@/config/Variables';

// Cliente unico de React Query: cache de consultas y estados de carga
const clienteConsultas = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Variables.cacheTiempoMs,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={clienteConsultas}>
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-2 p-8">
        <h1 className="text-3xl font-semibold">{Variables.nombreApp}</h1>
        <p className="text-texto-suave">Configuración base lista. La primera interfaz llega en el Sprint 1.</p>
      </main>
    </QueryClientProvider>
  );
}