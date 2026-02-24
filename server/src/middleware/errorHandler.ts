import { Prisma } from '@prisma/client'
import type { Request, Response, NextFunction } from 'express'

export function createErrorHandler(databaseSetupHint: () => string) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express requires 4 params for error middleware
  return (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err)
    if (err instanceof Prisma.PrismaClientInitializationError || err instanceof Prisma.PrismaClientKnownRequestError) {
      return res.status(503).json({ error: databaseSetupHint() })
    }
    return res.status(500).json({ error: 'Erro interno do servidor.' })
  }
}
