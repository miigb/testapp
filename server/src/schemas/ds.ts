import { z } from 'zod'

export const dsRecordInputSchema = z.object({
  gestora: z.string().trim().optional(),
  proponentes: z.string().trim().optional(),
  referencia: z.string().trim().optional(),
  produto: z.string().trim().optional(),
  entidadeBancaria: z.string().trim().optional(),
  liderCalculo: z.string().trim().optional(),
  recibo: z.string().trim().optional(),
  faltaReciboGestora: z.string().trim().optional(),
  valorRaw: z.string().trim().optional(),
  valor: z.number().optional(),
  dataEscritura: z.string().optional(),
  dataFechoCrm: z.string().optional(),
  comissaoLojaRaw: z.string().trim().optional(),
  comissaoLoja: z.number().optional(),
  ivaCgdRaw: z.string().trim().optional(),
  ivaCgdValor: z.number().optional(),
  ivaCgdKind: z.enum(['sem_iva', 'total_levantado', 'valor', 'outro']).optional(),
  totalComissaoLojaCmIvaRaw: z.string().trim().optional(),
  totalComissaoLojaCmIva: z.number().optional(),
  comissaoGestorRaw: z.string().trim().optional(),
  comissaoGestor: z.number().optional(),
  percentagemRaw: z.string().trim().optional(),
  percentagem: z.number().optional(),
  pagComissaoGestor: z.string().optional(),
  sourceFile: z.string().trim().optional(),
  sourceSheet: z.string().trim().optional(),
  sourceRowNumber: z.number().int().optional(),
  importBatchId: z.string().trim().optional(),
  rawPayload: z.record(z.string(), z.unknown()).optional(),
  statusId: z.string().optional(),
  estadoId: z.string().optional(),
})

export const dsRecordPatchSchema = dsRecordInputSchema.partial()

export const dsImportPreviewSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
})

export const dsImportCommitSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
  strategy: z.enum(['skip', 'update', 'duplicate']).default('skip'),
})
