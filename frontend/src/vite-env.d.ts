// Tipos de Vite y de las variables de entorno del proyecto (import.meta.env)
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NOMBRE?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_CACHE_TIEMPO_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}