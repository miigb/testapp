export interface ColumnConfig {
  id: string
  module: string
  view: string
  key: string
  label: string
  type: 'string' | 'number' | 'date' | 'currency' | 'select'
  visible: boolean
  position: number
  isCustom: boolean
  isReference: boolean
  referenceConfig?: { matchField: string } | null
}
