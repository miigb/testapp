export const DEFAULT_STATUSES = [
  { key: 'status-prep', label: 'Em preparação', icon: 'hammer', color: '#00B0F0', active: true, order: 1 },
  { key: 'status-aguarda', label: 'A aguardar documentos', icon: 'clock3', color: '#FFFF00', active: true, order: 2 },
  { key: 'status-validacao', label: 'Em validação', icon: 'search-check', color: '#92D050', active: true, order: 3 },
  { key: 'status-emitido', label: 'Emitido', icon: 'receipt-text', color: '#4C78A8', active: true, order: 4 },
  { key: 'status-bloqueado', label: 'Bloqueado', icon: 'octagon-alert', color: '#FF0000', active: true, order: 5 },
  { key: 'status-concluido', label: 'Concluído', icon: 'check-circle2', color: '#0B8A5D', active: true, order: 6 },
  { key: 'status-sem', label: 'Sem estado', icon: 'circle', color: '#BFC4CC', active: true, order: 999 },
] as const

export const DEFAULT_TAX_RULES = [
  {
    code: 'IVA',
    label: 'IVA',
    rate: 0.23,
    enabled: true,
    targetField: 'iva',
    baseField: 'valorSemIva',
    order: 1,
  },
  {
    code: 'RETENCAO',
    label: 'Retenção',
    rate: 0.25,
    enabled: true,
    targetField: 'retencao',
    baseField: 'valorSemIva',
    order: 2,
  },
  {
    code: 'MEU5',
    label: 'Meu 5%',
    rate: 0.05,
    enabled: true,
    targetField: 'meu5',
    baseField: 'valorSemIva',
    order: 3,
  },
] as const

export const DEFAULT_DS_STATUSES = [
  {
    key: 'ds-pagas-banco-comissao-gestora',
    label: 'Pagas pelo banco/comissão paga gestora',
    icon: 'check-circle2',
    color: '#92D050',
    active: true,
    order: 1,
  },
  {
    key: 'ds-falta-recibo-gestora',
    label: 'Falta recibo gestora',
    icon: 'alert-triangle',
    color: '#FFFF00',
    active: true,
    order: 2,
  },
  {
    key: 'ds-aguarda-pagamento-banco',
    label: 'Aguarda pagamento banco',
    icon: 'clock3',
    color: '#00B0F0',
    active: true,
    order: 3,
  },
  {
    key: 'ds-sem-estado',
    label: 'Sem estado',
    icon: 'circle',
    color: '#BFC4CC',
    active: true,
    order: 999,
  },
] as const

export const DEFAULT_PENHORAS_STATUSES = [
  {
    key: 'penhoras-registados',
    label: 'REGISTADOS',
    icon: 'check-circle2',
    color: '#92D050',
    active: true,
    order: 1,
  },
  {
    key: 'penhoras-recusados-desistencia',
    label: 'RECUSADOS/DESISTENCIA',
    icon: 'ban',
    color: '#FF0000',
    active: true,
    order: 2,
  },
  {
    key: 'penhoras-atrasados-reforcos-10-dias',
    label: 'ATRASADOS - FEITOS REFORÇOS A CADA 10 DIAS',
    icon: 'alert-triangle',
    color: '#FFFF00',
    active: true,
    order: 3,
  },
  {
    key: 'penhoras-aguarda-registo',
    label: 'AGUARDA REGISTO',
    icon: 'clock3',
    color: '#F2F2F2',
    active: true,
    order: 4,
  },
] as const
