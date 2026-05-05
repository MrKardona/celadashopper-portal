import type { NextConfig } from "next"

// Headers básicos de seguridad aplicados a todas las respuestas.
// CSP no se incluye aquí porque Next.js requiere unsafe-inline para
// hidratación; si quieres CSP estricta, configurarla en middleware con
// nonces por request (más invasivo).
const securityHeaders = [
  // Evita que el navegador adivine MIME types (mitiga XSS via archivos subidos)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Bloquea embedding del sitio en iframes (anti-clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Restringe a qué se envía el Referer al navegar a otros dominios
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // HSTS — fuerza HTTPS por 1 año
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  // Limita el uso de APIs sensibles del navegador (cámara, micrófono, geo)
  // Habilitamos cámara y micrófono para escáneres y subida de fotos.
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(self), geolocation=()',
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
