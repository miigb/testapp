import type { Response } from 'express'

const clients = new Map<number, Set<Response>>()

export function addSseClient(userId: number, res: Response) {
  if (!clients.has(userId)) clients.set(userId, new Set())
  clients.get(userId)!.add(res)
  res.on('close', () => {
    clients.get(userId)?.delete(res)
    if (clients.get(userId)?.size === 0) clients.delete(userId)
  })
}

export function pushToUser(userId: number, event: string, data: unknown) {
  const userClients = clients.get(userId)
  if (!userClients) return
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of userClients) {
    res.write(payload)
  }
}
