import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import { toPng } from 'html-to-image'

export type ExportColumn = {
    header: string
    key: string
    width?: number
}

export type ExportData = {
    columns: ExportColumn[]
    rows: Record<string, unknown>[]
    summaryText?: string
    title?: string
    themeColor?: string
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
    const pageHeight = pdf.internal.pageSize.getHeight()
    let currentY = 40

    // Draw header thick line
    if (data.themeColor) {
        pdf.setFillColor(data.themeColor)
        pdf.rect(0, 0, pageWidth, 12, 'F')
        currentY = 50
    }

    if (data.title) {
        if (data.themeColor) {
            pdf.setTextColor(data.themeColor)
        }
        pdf.setFontSize(22)
        pdf.setFont('helvetica', 'bold')
        pdf.text(data.title, 40, currentY)
        pdf.setTextColor('#000000') // reset
        currentY += 35
    }

    if (data.summaryText) {
        pdf.setFontSize(12)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Resumo Executivo (IA):', 40, currentY)
        currentY += 20

        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(10)

        const lines = pdf.splitTextToSize(data.summaryText, pageWidth - 80)
        pdf.setTextColor('#4b5563')
        pdf.text(lines, 40, currentY)
        pdf.setTextColor('#000000')
        currentY += (lines.length * 14) + 20
    }

    // Render dashboard summary cards
    if (dashboardElementId && data.rows && data.rows.length === 1 && data.columns && data.columns.length > 0) {
        const row = data.rows[0];
        const cardWidth = 160;
        const cardHeight = 50;
        const spacing = 16;
        let cx = 40;

        data.columns.forEach((col) => {
            const val = row[col.key];

            // Draw box
            pdf.setDrawColor('#e5e7eb') // border
            pdf.setFillColor('#f9fafb') // bg
            pdf.roundedRect(cx, currentY, cardWidth, cardHeight, 4, 4, 'FD')

            // Draw label
            pdf.setFont('helvetica', 'normal')
            pdf.setTextColor('#6b7280')
            pdf.setFontSize(8)
            pdf.text(col.header.toUpperCase(), cx + 10, currentY + 20)

            // Draw value
            pdf.setFont('helvetica', 'bold')
            pdf.setTextColor('#111827')
            pdf.setFontSize(16)
            pdf.text(String(val), cx + 10, currentY + 40)

            cx += cardWidth + spacing
        });

        currentY += cardHeight + 20;
    }


    if (dashboardElementId) {
        const el = document.getElementById(dashboardElementId)
        if (el) {
            try {
                // We use html-to-image instead of html2canvas because it supports modern CSS like color-mix natively.
                // We also filter out the modal overlay so it doesn't cover the dashboard in the screenshot.
                const imgData = await toPng(el, {
                    pixelRatio: 2,
                    skipFonts: true, // Prevents hanging on font load errors if any
                    filter: (node) => {
                        if (node instanceof HTMLElement) {
                            if (node.classList?.contains('record-modal-overlay') || node.classList?.contains('no-export')) {
                                return false
                            }
                        }
                        return true
                    }
                })

                // Calculate image dimensions to fit within PDF page width
                let imgWidth = pageWidth - 80
                const ratio = el.offsetHeight / el.offsetWidth
                let imgHeight = imgWidth * ratio

                // Force to fit on the same page
                const availableHeight = pageHeight - currentY - 40
                if (imgHeight > availableHeight) {
                    imgHeight = availableHeight
                    imgWidth = imgHeight / ratio
                }

                // Center if scaled down by height
                const xOffset = 40 + (pageWidth - 80 - imgWidth) / 2

                pdf.addImage(imgData, 'PNG', xOffset, currentY, imgWidth, imgHeight)
                currentY += imgHeight + 30
            } catch (err) {
                console.error('Failed to capture dashboard snapshot', err)
            }
        }
    }

    // Draw simple table if rows exist and no dashboard was specified to take up the page
    if (data.rows.length > 0 && !dashboardElementId) {
        if (currentY > pageHeight - 100) {
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
