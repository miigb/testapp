import { z } from 'zod'

export const recordInputSchema = z.object({
  tipo: z.enum(['exequente', 'executado']),
  mes: z.number().int().min(1).max(12),
  ano: z.number().int().min(2000).max(2100),
  processo: z.string().trim().optional(),
  pe: z.string().trim().optional(),
  reciboNumero: z.string().trim().optional(),
  dataLevantamento: z.string().optional(),
  dataRecibo: z.string().optional(),
  valorIndicado: z.number().optional(),
  valorSemIva: z.number().optional(),
  iva: z.number().optional(),
  retencao: z.number().optional(),
  valorEmissao: z.number().optional(),
  meu5: z.number().optional(),
  outrasTaxas: z.number().optional(),
  gestor: z.string().trim().optional(),
  exequente: z.string().trim().optional(),
  descricaoValor: z.string().trim().optional(),
  indicacoes: z.string().trim().optional(),
  sourceColor: z.string().optional(),
  sourceSheet: z.string().optional(),
  statusId: z.string().optional(),
  estadoId: z.string().optional(),
})

export const recordPatchSchema = recordInputSchema.partial()

export const importCommitSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
  colorMapping: z.record(z.string(), z.string()).optional(),
  strategy: z.enum(['skip', 'update', 'duplicate']).default('skip'),
  forceRecalculate: z.boolean().optional(),
})

export const importPreviewSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
  colorMapping: z.record(z.string(), z.string()).optional(),
})

export const saveViewSchema = z.object({
  name: z.string().min(1),
  scope: z.string().min(1),
  filters: z.record(z.string(), z.unknown()),
})

export const taxRuleSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1),
  label: z.string().min(1),
  rate: z.number().min(0),
  enabled: z.boolean(),
  targetField: z.enum(['iva', 'retencao', 'meu5', 'outrasTaxas']),
  baseField: z.enum(['valorIndicado', 'valorSemIva', 'valorEmissao']),
  order: z.number().int(),
})

export const calculationSettingsSchema = z.object({
  autoApplyRules: z.boolean().optional(),
  autoComputeValorSemIva: z.boolean().optional(),
  autoComputeValorEmissao: z.boolean().optional(),
  roundTo: z.number().int().min(0).max(6).optional(),
  taxRules: z.array(taxRuleSchema).optional(),
})

export const statusSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  icon: z.string().min(1),
  color: z.string().min(1),
  active: z.boolean(),
  order: z.number().int(),
})

export const bulkUpdateSchema = z.object({
  recordIds: z.array(z.string().min(1)).min(1),
  patch: recordPatchSchema,
  forceRecalculate: z.boolean().optional(),
})
