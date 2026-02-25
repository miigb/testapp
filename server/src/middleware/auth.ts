import type { Request, Response, NextFunction } from 'express'
import { verifyToken, type JwtPayload } from '../services/auth'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- standard Express augmentation pattern
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token
  if (!token) {
    return res.status(401).json({ error: 'Autenticacao necessaria.' })
  }
  try {
    req.user = verifyToken(token)
    next()
  } catch {
    return res.status(401).json({ error: 'Token invalido ou expirado.' })
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Autenticacao necessaria.' })
  }
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Apenas administradores.' })
  }
  next()
}

export type ModuleId = 'recibos' | 'ds' | 'penhoras'

export function requireModuleAccess(moduleId: ModuleId) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Autenticacao necessaria.' })
    }
    // ADMIN always has access to all modules
    if (req.user.role === 'ADMIN') {
      return next()
    }
    // USER and CONSULTANT must have the module in their allowedModules
    if (!req.user.allowedModules || !req.user.allowedModules.includes(moduleId)) {
      return res.status(403).json({ error: 'Sem acesso a este modulo.' })
    }
    next()
  }
}

export function requireWriteAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Autenticacao necessaria.' })
  }
  if (req.user.role === 'CONSULTANT') {
    return res.status(403).json({ error: 'Acesso apenas de leitura.' })
  }
  next()
}
