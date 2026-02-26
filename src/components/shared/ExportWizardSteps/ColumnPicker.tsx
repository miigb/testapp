import type { ExportColumn } from '../../../lib/exportGenerators'

interface ColumnPickerProps {
  columns: ExportColumn[]
  selectedKeys: string[]
  onChange: (keys: string[]) => void
}

export function ColumnPicker({ columns, selectedKeys, onChange }: ColumnPickerProps) {
  const allSelected = selectedKeys.length === columns.length

  return (
    <div>
      <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => onChange(allSelected ? [] : columns.map((c) => c.key))}
        />
        <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>Selecionar todas</span>
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
        {columns.map((col) => (
          <label key={col.key} className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', padding: '4px 0' }}>
            <input
              type="checkbox"
              checked={selectedKeys.includes(col.key)}
              onChange={(e) => {
                if (e.target.checked) {
                  onChange([...selectedKeys, col.key])
                } else {
                  onChange(selectedKeys.filter((k) => k !== col.key))
                }
              }}
            />
            {col.header}
          </label>
        ))}
      </div>
    </div>
  )
}
