import 'dotenv/config'

import express from 'express'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

import { createCorsMiddleware } from './middleware/cors'
import { createErrorHandler } from './middleware/errorHandler'
import { aiRouter } from './routes/ai'
import { createRecordsRouter } from './routes/records'
import { createDsRouter } from './routes/ds'
import { createPenhorasRouter } from './routes/penhoras'
import { createStatusesRouter } from './routes/statuses'
import { createSettingsRouter } from './routes/settings'
import { createDataRouter } from './routes/data'

import { databaseSetupHint } from './services/shared'

// Fail fast in production when required env vars are missing
if (process.env.NODE_ENV === 'production') {
  const required = ['DATABASE_URL']
  const missing = required.filter((key) => !process.env[key])
  if (missing.length > 0) {
    console.error(`[startup] Missing required environment variables: ${missing.join(', ')}`)
    process.exit(1)
  }
}

const PORT = Number(process.env.PORT ?? process.env.API_PORT ?? 4000)

const app = express()
const prisma = new PrismaClient()

app.use(createCorsMiddleware())
app.use(express.json({ limit: '30mb' }))

app.use('/api/ai', aiRouter)
app.use('/api', createRecordsRouter(prisma))
app.use('/api/ds', createDsRouter(prisma))
app.use('/api/penhoras', createPenhorasRouter(prisma))
app.use('/api', createStatusesRouter(prisma))
app.use('/api', createSettingsRouter(prisma))
app.use('/api', createDataRouter(prisma))

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ ok: true, db: 'up', now: new Date().toISOString() })
  } catch {
    res.status(503).json({ ok: false, db: 'down', now: new Date().toISOString() })
  }
})

// In production, serve the built frontend from dist/ under the same origin.
// This avoids CORS complexity and keeps deployment simple (single Railway service).
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../dist')
  app.use(express.static(distPath))
  // For client-side routing: any non-API GET falls through to index.html
  app.get(/^(?!\/api\/).*$/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.use(createErrorHandler(databaseSetupHint))

app.listen(PORT, () => {
  console.log(`[api] running on http://localhost:${PORT}`)
})

process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
