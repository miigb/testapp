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
