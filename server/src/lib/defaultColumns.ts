import type { PrismaClient } from '@prisma/client'

interface DefaultColumnDef {
  key: string
  label: string
  type: string
  position: number
}

const RECIBOS_TABLE: DefaultColumnDef[] = [
  { key: 'tipo', label: 'Tipo', type: 'string', position: 0 },
  { key: 'ano_mes', label: 'Ano/Mês', type: 'date', position: 1 },
  { key: 'pe', label: 'PE', type: 'string', position: 2 },
  { key: 'processo', label: 'Processo', type: 'string', position: 3 },
  { key: 'reciboNumero', label: 'Recibo', type: 'string', position: 4 },
  { key: 'gestor_exequente', label: 'Gestor/Exequente', type: 'string', position: 5 },
  { key: 'valorSemIva', label: 'Sem IVA', type: 'currency', position: 6 },
  { key: 'iva', label: 'IVA', type: 'currency', position: 7 },
  { key: 'retencao', label: 'Retenção', type: 'currency', position: 8 },
  { key: 'meu5', label: 'Meu 5%', type: 'currency', position: 9 },
  { key: 'estadoId', label: 'Estado', type: 'select', position: 10 },
]

const RECIBOS_DETAIL: DefaultColumnDef[] = [
  { key: 'tipo', label: 'Tipo', type: 'string', position: 0 },
  { key: 'pe', label: 'PE', type: 'string', position: 1 },
  { key: 'processo', label: 'Processo', type: 'string', position: 2 },
  { key: 'reciboNumero', label: 'Recibo', type: 'string', position: 3 },
  { key: 'gestor', label: 'Gestor', type: 'string', position: 4 },
  { key: 'exequente', label: 'Exequente', type: 'string', position: 5 },
  { key: 'valorSemIva', label: 'Valor sem IVA', type: 'currency', position: 6 },
  { key: 'iva', label: 'IVA', type: 'currency', position: 7 },
  { key: 'retencao', label: 'Retenção', type: 'currency', position: 8 },
  { key: 'meu5', label: 'Meu 5%', type: 'currency', position: 9 },
  { key: 'gpeSe', label: 'GPESE', type: 'string', position: 10 },
  { key: 'indicacoes', label: 'Indicações', type: 'string', position: 11 },
  { key: 'estadoId', label: 'Estado', type: 'select', position: 12 },
]

const DS_TABLE: DefaultColumnDef[] = [
  { key: 'gestora', label: 'Gestor/a', type: 'string', position: 0 },
  { key: 'proponentes', label: 'Proponentes', type: 'string', position: 1 },
  { key: 'valor', label: 'Valor', type: 'currency', position: 2 },
  { key: 'dataEscritura', label: 'Data Escritura', type: 'date', position: 3 },
  { key: 'comissaoLoja', label: 'Comissão Loja', type: 'currency', position: 4 },
  { key: 'estadoId', label: 'Estado', type: 'select', position: 5 },
]

const DS_DETAIL: DefaultColumnDef[] = [
  { key: 'gestora', label: 'Gestora', type: 'string', position: 0 },
  { key: 'proponentes', label: 'Proponentes', type: 'string', position: 1 },
  { key: 'referencia', label: 'Referência', type: 'string', position: 2 },
  { key: 'produto', label: 'Produto', type: 'string', position: 3 },
  { key: 'entidadeBancaria', label: 'Entidade Bancária', type: 'string', position: 4 },
  { key: 'liderCalculo', label: 'Líder Cálculo', type: 'string', position: 5 },
  { key: 'recibo', label: 'Recibo', type: 'string', position: 6 },
  { key: 'faltaReciboGestora', label: 'Falta Recibo Gestora', type: 'string', position: 7 },
  { key: 'valor', label: 'Valor', type: 'currency', position: 8 },
  { key: 'comissaoLoja', label: 'Comissão Loja', type: 'currency', position: 9 },
  { key: 'totalComissaoLojaCmIva', label: 'Total Comissão c/ IVA', type: 'currency', position: 10 },
  { key: 'ivaCgdRaw', label: 'IVA CGD', type: 'string', position: 11 },
  { key: 'comissaoGestor', label: 'Comissão Gestor', type: 'currency', position: 12 },
  { key: 'percentagem', label: 'Percentagem', type: 'number', position: 13 },
  { key: 'dataEscritura', label: 'Data Escritura', type: 'date', position: 14 },
  { key: 'dataFechoCrm', label: 'Data Fecho CRM', type: 'date', position: 15 },
  { key: 'pagComissaoGestor', label: 'Pag. Comissão Gestor', type: 'string', position: 16 },
  { key: 'estadoId', label: 'Estado', type: 'select', position: 17 },
]

const PENHORAS_TABLE: DefaultColumnDef[] = [
  { key: 'pe', label: 'PE', type: 'string', position: 0 },
  { key: 'acto', label: 'Acto', type: 'string', position: 1 },
  { key: 'dataPedido', label: 'Data Pedido', type: 'date', position: 2 },
  { key: 'identificacao', label: 'Identificação', type: 'string', position: 3 },
  { key: 'pedido', label: 'Pedido', type: 'string', position: 4 },
  { key: 'gestor', label: 'Gestor', type: 'string', position: 5 },
  { key: 'estadoId', label: 'Estado', type: 'select', position: 6 },
]

const PENHORAS_DETAIL: DefaultColumnDef[] = [
  { key: 'pe', label: 'PE', type: 'string', position: 0 },
  { key: 'acto', label: 'Acto', type: 'string', position: 1 },
  { key: 'dataPedido', label: 'Data Pedido', type: 'date', position: 2 },
  { key: 'identificacao', label: 'Identificação', type: 'string', position: 3 },
  { key: 'pedido', label: 'Pedido', type: 'string', position: 4 },
  { key: 'gestor', label: 'Gestor', type: 'string', position: 5 },
  { key: 'estadoId', label: 'Estado', type: 'select', position: 6 },
]

const ALL_DEFAULTS: Record<string, Record<string, DefaultColumnDef[]>> = {
  recibos: { table: RECIBOS_TABLE, detail: RECIBOS_DETAIL },
  ds: { table: DS_TABLE, detail: DS_DETAIL },
  penhoras: { table: PENHORAS_TABLE, detail: PENHORAS_DETAIL },
}

/**
 * Ensures default column configs exist for a module/view.
 * If no rows exist in the DB, inserts the hardcoded defaults.
 * Non-fatal: silently catches errors (e.g. missing migration) so
 * the columns endpoint still works with client-side fallback.
 */
export async function ensureDefaultColumns(
  prisma: PrismaClient,
  module: string,
  view: string,
  createdById: number,
): Promise<void> {
  try {
    const count = await prisma.columnConfig.count({
      where: { module, view },
    })

    if (count > 0) return

    const defaults = ALL_DEFAULTS[module]?.[view]
    if (!defaults) return

    await prisma.columnConfig.createMany({
      data: defaults.map((col) => ({
        module,
        view,
        key: col.key,
        label: col.label,
        type: col.type,
        visible: true,
        position: col.position,
        isCustom: false,
        isReference: false,
        createdById,
      })),
      skipDuplicates: true,
    })
  } catch {
    // Non-fatal — if the table doesn't exist yet or any other DB error,
    // the endpoint will return [] and the client falls back to defaults.
  }
}
