import { z } from 'zod'

export const penhorasRecordInputSchema = z.object({
  pe: z.string().trim().optional(),
  acto: z.string().trim().optional(),
  dataPedido: z.string().optional(),
  identificacao: z.string().trim().optional(),
  pedido: z.string().trim().optional(),
  gestor: z.string().trim().optional(),
  sourceFile: z.string().trim().optional(),
  sourceSheet: z.string().trim().optional(),
  sourceRowNumber: z.number().int().optional(),
  importBatchId: z.string().trim().optional(),
  rawPayload: z.record(z.string(), z.unknown()).optional(),
  statusId: z.string().optional(),
  estadoId: z.string().optional(),
})

export const penhorasRecordPatchSchema = penhorasRecordInputSchema.partial()

export const penhorasImportPreviewSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
})

export const penhorasImportCommitSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
  strategy: z.enum(['skip', 'update', 'duplicate']).default('skip'),
})
