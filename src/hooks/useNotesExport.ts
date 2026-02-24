import type { Dispatch, SetStateAction } from 'react'

import { jsPDF } from 'jspdf'

import { api } from '../api'
import { formatSmartNotesValue } from '../lib/smartNotes'
import type { SavedSmartNotesEntry, SmartNotesErrorRow, SmartNotesResultRow } from '../lib/smartNotes'

interface UseNotesExportParams {
  quickNotes: string
  smartNotesText: string
  setSmartNotesText: Dispatch<SetStateAction<string>>
  smartNotesResults: SmartNotesResultRow[]
  smartNotesErrors: SmartNotesErrorRow[]
  setSmartNotesPinnedSignatures: Dispatch<SetStateAction<string[]>>
  setSmartNotesSavedEntries: Dispatch<SetStateAction<SavedSmartNotesEntry[]>>
  setFeedback: (message: string) => void
}

export function useNotesExport({
  quickNotes,
  smartNotesText,
  setSmartNotesText,
  smartNotesResults,
  smartNotesErrors,
  setSmartNotesPinnedSignatures,
  setSmartNotesSavedEntries,
  setFeedback,
}: UseNotesExportParams) {
  async function exportCurrentSnapshot() {
    try {
      const snapshot = await api.exportRecordsSnapshot()
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json;charset=utf-8' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `mesa-recibos-snapshot-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
      link.click()
      URL.revokeObjectURL(link.href)
      setFeedback('Snapshot atual exportado com sucesso.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao exportar snapshot.')
    }
  }

  function buildQuickNotesFileName(extension: 'txt' | 'pdf'): string {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    return `mesa-recibos-notas-${stamp}.${extension}`
  }

  function buildSmartNotesFileName(extension: 'txt' | 'pdf'): string {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    return `mesa-recibos-notas-calculo-${stamp}.${extension}`
  }

  function buildSmartNotesExportText(): string {
    const content = smartNotesText.trim()
    if (!content) return ''

    const sections = [
      'Notas com cálculo',
      `Exportado: ${new Date().toLocaleString('pt-PT')}`,
      '',
      content,
    ]

    if (smartNotesResults.length > 0) {
      sections.push('', 'Resultados', ...smartNotesResults.map((row) => `L${row.lineNumber}: ${row.expression} = ${formatSmartNotesValue(row.result)}`))
    }

    if (smartNotesErrors.length > 0) {
      sections.push('', 'Linhas com erro', ...smartNotesErrors.map((row) => `L${row.lineNumber}: ${row.error}`))
    }

    return sections.join('\n')
  }

  function removeSmartNotesLine(lineNumber: number) {
    setSmartNotesText((current) => {
      const lines = current.split('\n')
      if (lineNumber < 1 || lineNumber > lines.length) return current
      lines.splice(lineNumber - 1, 1)
      return lines.join('\n')
    })
  }

  function toggleSmartNotesPinned(signature: string) {
    setSmartNotesPinnedSignatures((current) => {
      if (current.includes(signature)) {
        return current.filter((value) => value !== signature)
      }
      return [signature, ...current].slice(0, 200)
    })
  }

  function toggleSmartNotesSaved(row: SmartNotesResultRow) {
    setSmartNotesSavedEntries((current) => {
      const alreadySaved = current.some((entry) => entry.signature === row.signature)
      if (alreadySaved) {
        return current.filter((entry) => entry.signature !== row.signature)
      }
      return [
        {
          signature: row.signature,
          expression: row.expression,
          result: row.result,
          source: row.source,
          savedAt: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 200)
    })
  }

  function exportQuickNotesTxt() {
    const content = quickNotes.trim()
    if (!content) {
      setFeedback('Sem notas para exportar.')
      return
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = buildQuickNotesFileName('txt')
    link.click()
    URL.revokeObjectURL(link.href)
    setFeedback('Notas exportadas em TXT.')
  }

  function exportQuickNotesPdf() {
    const content = quickNotes.trim()
    if (!content) {
      setFeedback('Sem notas para exportar.')
      return
    }

    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const margin = 44
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text('Notas rápidas', margin, 42)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(new Date().toLocaleString('pt-PT'), margin, 58)

      doc.setFontSize(12)
      const lines = doc.splitTextToSize(content, pageWidth - margin * 2)
      let y = 86

      for (const line of lines) {
        if (y > pageHeight - margin) {
          doc.addPage()
          y = margin
        }
        doc.text(line, margin, y)
        y += 16
      }

      doc.save(buildQuickNotesFileName('pdf'))
      setFeedback('Notas exportadas em PDF.')
    } catch {
      setFeedback('Falha ao exportar notas em PDF.')
    }
  }

  function exportSmartNotesTxt() {
    const content = buildSmartNotesExportText()
    if (!content) {
      setFeedback('Sem notas com cálculo para exportar.')
      return
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = buildSmartNotesFileName('txt')
    link.click()
    URL.revokeObjectURL(link.href)
    setFeedback('Notas com cálculo exportadas em TXT.')
  }

  function exportSmartNotesPdf() {
    const content = buildSmartNotesExportText()
    if (!content) {
      setFeedback('Sem notas com cálculo para exportar.')
      return
    }

    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const margin = 44
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text('Notas com cálculo', margin, 42)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(new Date().toLocaleString('pt-PT'), margin, 58)

      doc.setFontSize(12)
      const lines = doc.splitTextToSize(content, pageWidth - margin * 2)
      let y = 86

      for (const line of lines) {
        if (y > pageHeight - margin) {
          doc.addPage()
          y = margin
        }
        doc.text(line, margin, y)
        y += 16
      }

      doc.save(buildSmartNotesFileName('pdf'))
      setFeedback('Notas com cálculo exportadas em PDF.')
    } catch {
      setFeedback('Falha ao exportar notas com cálculo em PDF.')
    }
  }

  return {
    exportCurrentSnapshot,
    removeSmartNotesLine,
    toggleSmartNotesPinned,
    toggleSmartNotesSaved,
    exportQuickNotesTxt,
    exportQuickNotesPdf,
    exportSmartNotesTxt,
    exportSmartNotesPdf,
  }
}
