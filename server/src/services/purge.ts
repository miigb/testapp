import type { PrismaClient } from '@prisma/client'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export function startPurgeScheduler(prisma: PrismaClient) {
  const purge = async () => {
    const cutoff = new Date(Date.now() - THIRTY_DAYS_MS)
    try {
      const [records, ds, penhoras, todos] = await Promise.all([
        prisma.record.deleteMany({ where: { deletedAt: { lt: cutoff } } }),
        prisma.dsRecord.deleteMany({ where: { deletedAt: { lt: cutoff } } }),
        prisma.penhorasRecord.deleteMany({ where: { deletedAt: { lt: cutoff } } }),
        prisma.todo.deleteMany({ where: { deletedAt: { lt: cutoff } } }),
      ])
      const total = records.count + ds.count + penhoras.count + todos.count
      if (total > 0) {
        console.log(`[purge] Removed ${total} records older than 30 days from trash`)
      }
    } catch (err) {
      console.error('[purge] Error during auto-purge:', err)
    }
  }

  // Run daily at 3am
  const scheduleNext = () => {
    const now = new Date()
    const next = new Date(now)
    next.setHours(3, 0, 0, 0)
    if (next <= now) next.setDate(next.getDate() + 1)
    const delay = next.getTime() - now.getTime()
    setTimeout(() => {
      purge().then(scheduleNext).catch(scheduleNext)
    }, delay)
  }
  scheduleNext()

  // Also run once on startup (non-blocking)
  purge().catch(() => { /* startup purge failed, will retry on schedule */ })
}
