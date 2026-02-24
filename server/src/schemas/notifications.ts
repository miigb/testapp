import { z } from 'zod'

export const notificationPreferenceSchema = z.object({
  taskAssigned: z.boolean().optional(),
  taskCompleted: z.boolean().optional(),
  taskCommented: z.boolean().optional(),
  taskDueSoon: z.boolean().optional(),
  recordStatusChange: z.boolean().optional(),
  mention: z.boolean().optional(),
})
