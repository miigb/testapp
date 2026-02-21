import type { StatusDefinition } from '../types'

export function getStatus(statuses: StatusDefinition[], statusId?: string): StatusDefinition | undefined {
    if (!statusId) return undefined
    return statuses.find((status) => status.id === statusId)
}
