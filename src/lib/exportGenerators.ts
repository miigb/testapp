import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

export type ExportColumn = {
    header: string
    key: string
    width?: number
}

export type ExportData = {
    columns: ExportColumn[]
    rows: Record<string, any>[]
    summaryText?: string
    title?: string
}

function triggerDownload(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
}

export async function exportToCsv(data: ExportData, filename: string) {
    const headers = data.columns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(',')
    const rows = data.rows.map((row) =>
        data.columns
            .map((c) => {
                const val = row[c.key]
                if (val === null || val === undefined) return '""'
                return `"${String(val).replace(/"/g, '""')}"`
            })
            .join(',')
    )

    let content = headers + '\n' + rows.join('\n')

    // Prepend summary if it exists
    if (data.summaryText) {
        content = `"Resumo de IA"\n"${data.summaryText.replace(/"/g, '""')}"\n\n` + content
    }

    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
    triggerDownload(blob, `${filename}.csv`)
}

export async function exportToExcel(data: ExportData, filename: string) {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet(data.title || 'Dados')

    if (data.summaryText) {
        sheet.addRow(['Resumo Executivo (IA)'])
        sheet.getRow(1).font = { bold: true, size: 14 }
        sheet.addRow([data.summaryText])
        sheet.getRow(2).height = 100
        sheet.getRow(2).alignment = { wrapText: true, vertical: 'top' }
        sheet.mergeCells('A2:H2')
        sheet.addRow([]) // empty row
    }

    const headerRowPos = data.summaryText ? 4 : 1

    const headerRow = sheet.addRow(data.columns.map((c) => c.header))
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFBE185D' }, // primary brand color
    }

    data.columns.forEach((col, index) => {
        sheet.getColumn(index + 1).width = col.width || 20
    })

    data.rows.forEach((row) => {
        const rowValues = data.columns.map((c) => row[c.key])
        sheet.addRow(rowValues)
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    triggerDownload(blob, `${filename}.xlsx`)
}

export async function exportToPdf(data: ExportData, filename: string, dashboardElementId?: string) {
    // Using A4 portrait by default, or landscape if there's a dashboard
    const orientation = dashboardElementId ? 'landscape' : 'portrait'
    const pdf = new jsPDF(orientation, 'pt', 'a4')

    const pageWidth = pdf.internal.pageSize.getWidth()
    let currentY = 40

    if (data.title) {
        pdf.setFontSize(18)
        pdf.text(data.title, 40, currentY)
        currentY += 30
    }

    if (data.summaryText) {
        pdf.setFontSize(12)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Resumo Executivo (IA):', 40, currentY)
        currentY += 20

        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(10)

        const lines = pdf.splitTextToSize(data.summaryText, pageWidth - 80)
        pdf.text(lines, 40, currentY)
        currentY += (lines.length * 14) + 20
    }

    if (dashboardElementId) {
        const el = document.getElementById(dashboardElementId)
        if (el) {
            try {
                const canvas = await html2canvas(el, { scale: 2, useCORS: true })
                const imgData = canvas.toDataURL('image/png')

                // Calculate image dimensions to fit within PDF page width
                const imgWidth = pageWidth - 80
                const ratio = canvas.height / canvas.width
                const imgHeight = imgWidth * ratio

                // Check if image fits on current page, if not, add new page
                if (currentY + imgHeight > pdf.internal.pageSize.getHeight() - 40) {
                    pdf.addPage()
                    currentY = 40
                }

                pdf.addImage(imgData, 'PNG', 40, currentY, imgWidth, imgHeight)
                currentY += imgHeight + 30
            } catch (err) {
                console.error('Failed to capture dashboard snapshot', err)
            }
        }
    }

    // Draw simple table if rows exist
    if (data.rows.length > 0) {
        if (currentY > pdf.internal.pageSize.getHeight() - 100) {
            pdf.addPage()
            currentY = 40
        }

        // Auto Table would normally be used here (jspdf-autotable), but we can do a very simple 1-line fallback or just stick to exporting dashboard/summary for PDFs
        pdf.setFontSize(12)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Tabela de Dados Anexa', 40, currentY)
        currentY += 20
        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'normal')
        pdf.text(`Nota: Foram selecionados ${data.rows.length} registos. Utilize a exportação CSV/Excel para análise detalhada em grelha.`, 40, currentY)
    }

    pdf.save(`${filename}.pdf`)
}
