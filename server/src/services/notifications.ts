import type { PrismaClient, NotificationType } from '@prisma/client'
import { pushToUser } from './sse'

interface CreateNotificationInput {
  userId: number
  type: NotificationType
  title: string
  message: string
  linkedModule?: string
  linkedRecordId?: string
  linkedTodoId?: number
}

const prefMap: Record<string, string> = {
  TASK_ASSIGNED: 'taskAssigned',
  TASK_COMPLETED: 'taskCompleted',
  TASK_COMMENTED: 'taskCommented',
  TASK_DUE_SOON: 'taskDueSoon',
  RECORD_STATUS_CHANGE: 'recordStatusChange',
  MENTION: 'mention',
}

export async function createNotification(
  prisma: PrismaClient,
  input: CreateNotificationInput,
) {
  // Check user's NotificationPreference for this type
  const prefField = prefMap[input.type]
  if (prefField) {
    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId: input.userId },
    })
    if (prefs && prefs[prefField as keyof typeof prefs] === false) {
      return null // user has opted out
    }
  }

  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      linkedModule: input.linkedModule,
      linkedRecordId: input.linkedRecordId,
      linkedTodoId: input.linkedTodoId,
    },
  })

  pushToUser(input.userId, 'notification', notification)
  return notification
}

/**
 * Parse @mentions from text and return unique usernames.
 */
export function parseMentions(text: string): string[] {
  const matches = text.match(/@(\w+)/g)
  if (!matches) return []
  return [...new Set(matches.map((m) => m.slice(1)))]
}
