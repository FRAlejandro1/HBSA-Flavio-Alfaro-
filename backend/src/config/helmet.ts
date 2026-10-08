// Cabeceras de seguridad con Helmet: CSP, HSTS y Trusted Types.
// La API solo devuelve JSON, asi que la CSP es cerrada por completo;
// la CSP de la SPA se define en el servidor que sirve el frontend.
import helmet from 'helmet';

export const middlewareHelmet = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      'default-src': ["'none'"],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'none'"],
      'form-action': ["'none'"],
      // Trusted Types: el navegador exige tipos de confianza para sinks de scripts
      'require-trusted-types-for': ["'script'"],
    },
  },
  // HSTS con preload: un ano, incluyendo subdominios
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  // No se filtra la URL de origen a otros sitios
  referrerPolicy: { policy: 'no-referrer' },
});