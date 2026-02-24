import cors from 'cors'

export function createCorsMiddleware() {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : []

  return cors({
    origin: process.env.NODE_ENV === 'production' && allowedOrigins.length > 0
      ? allowedOrigins
      : true,
    credentials: true,
  })
}
