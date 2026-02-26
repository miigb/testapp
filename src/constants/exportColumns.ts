import type { ExportColumn } from '../lib/exportGenerators'

export const RECIBOS_TABLE_COLUMNS: ExportColumn[] = [
  { header: 'Tipo', key: 'tipo', width: 15 },
  { header: 'Nº Recibo', key: 'reciboNumero', width: 15 },
  { header: 'Processo', key: 'processo', width: 20 },
  { header: 'PE', key: 'pe', width: 15 },
  { header: 'Mês', key: 'mes', width: 12 },
  { header: 'Ano', key: 'ano', width: 12 },
  { header: 'Honorários', key: 'honorarios', width: 15 },
  { header: 'Custas', key: 'custas', width: 15 },
  { header: 'Iva', key: 'iva', width: 12 },
  { header: 'Exequente', key: 'exequente', width: 25 },
  { header: 'Executado', key: 'executado', width: 25 },
  { header: 'Gestor(a)', key: 'gestor', width: 20 },
  { header: 'Estado', key: 'estadoId', width: 20 },
]

export const RECIBOS_DASHBOARD_COLUMNS: ExportColumn[] = [
  { header: 'Registos Totais', key: 'registos', width: 15 },
  { header: 'Valor Emissão', key: 'valorEmissao', width: 20 },
  { header: 'Levantado c/ IVA', key: 'levantado', width: 20 },
]

export const DS_TABLE_COLUMNS: ExportColumn[] = [
  { header: 'Proponentes', key: 'proponentes', width: 30 },
  { header: 'Ref.', key: 'referencia', width: 15 },
  { header: 'Gestor(a)', key: 'gestora', width: 25 },
  { header: 'Produto', key: 'produto', width: 20 },
  { header: 'Entidade Bancária', key: 'entidadeBancaria', width: 20 },
  { header: 'Data Escritura', key: 'dataEscritura', width: 15 },
  { header: 'Valor', key: 'valor', width: 15 },
  { header: 'Comissão Loja', key: 'comissaoLoja', width: 15 },
  { header: 'Comissão Gestor', key: 'comissaoGestor', width: 15 },
  { header: 'Falta Recibo', key: 'faltaReciboGestora', width: 25 },
  { header: 'Estado', key: 'estadoId', width: 25 },
]

export const DS_DASHBOARD_COLUMNS: ExportColumn[] = [
  { header: 'Registos', key: 'registos', width: 15 },
  { header: 'Passaporte', key: 'passaporte', width: 20 },
  { header: 'Total C/Iva', key: 'totalComIva', width: 20 },
]

export const PENHORAS_TABLE_COLUMNS: ExportColumn[] = [
  { header: 'PE', key: 'pe', width: 15 },
  { header: 'Identificação', key: 'identificacao', width: 30 },
  { header: 'Pedido', key: 'pedido', width: 30 },
  { header: 'Gestor(a)', key: 'gestor', width: 20 },
  { header: 'Acto', key: 'acto', width: 20 },
  { header: 'Data do Pedido', key: 'dataPedido', width: 15 },
  { header: 'Estado', key: 'estadoId', width: 25 },
]

export const PENHORAS_DASHBOARD_COLUMNS: ExportColumn[] = [
  { header: 'Registos', key: 'registos', width: 15 },
  { header: 'Com Data Pedido', key: 'comDataPedido', width: 20 },
  { header: 'Recusados', key: 'recusados', width: 15 },
  { header: 'Pendentes', key: 'pendentes', width: 15 },
]
