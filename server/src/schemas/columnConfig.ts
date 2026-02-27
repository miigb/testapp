import { z } from 'zod'

const moduleEnum = z.enum(['recibos', 'ds', 'penhoras'])
const viewEnum = z.enum(['table', 'detail'])
const columnTypeEnum = z.enum(['string', 'number', 'date', 'currency', 'select'])

export const columnConfigParams = z.object({
  module: moduleEnum,
  view: viewEnum,
})

export const updateColumnBody = z.object({
  label: z.string().min(1).max(100).optional(),
  visible: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
})

export const reorderColumnsBody = z.object({
  columns: z.array(z.object({
    id: z.string(),
    position: z.number().int().min(0),
  })).min(1),
})

export const createCustomColumnBody = z.object({
  key: z.string().min(1).max(50).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
  label: z.string().min(1).max(100),
  type: columnTypeEnum,
  isReference: z.boolean().optional().default(false),
  referenceConfig: z.object({
    matchField: z.string(),
  }).optional(),
})

export const discoverColumnsBody = z.object({
  module: moduleEnum,
  headers: z.array(z.string().max(200)).min(1).max(500),
})
