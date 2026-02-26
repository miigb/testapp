import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
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
    companyName?: string
    footerText?: string
    moduleLogoSrc?: string
    orientation?: 'portrait' | 'landscape'
    maxRows?: number | 'all'
    selectedColumns?: string[]  // if provided, filter columns to these keys
}

function getEffectiveColumns(data: ExportData): ExportColumn[] {
    if (!data.selectedColumns || data.selectedColumns.length === 0) return data.columns
    return data.columns.filter((c) => data.selectedColumns!.includes(c.key))
}

function getEffectiveRows(data: ExportData): Record<string, unknown>[] {
    if (data.maxRows === undefined || data.maxRows === 'all') return data.rows
    return data.rows.slice(0, data.maxRows)
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
    const effectiveCols = getEffectiveColumns(data)
    const effectiveRows = getEffectiveRows(data)

    const headers = effectiveCols.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(',')
    const rows = effectiveRows.map((row) =>
        effectiveCols
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
    const effectiveCols = getEffectiveColumns(data)
    const effectiveRows = getEffectiveRows(data)

    // Company name header
    if (data.companyName) {
        const companyRow = sheet.addRow([data.companyName])
        companyRow.font = { bold: true, size: 16 }
    }

    // Report title header
    if (data.title) {
        const titleRow = sheet.addRow([data.title])
        titleRow.font = { bold: true, size: 12 }
    }

    if (data.companyName || data.title) {
        sheet.addRow([]) // empty spacer row
    }

    if (data.summaryText) {
        sheet.addRow(['Resumo Executivo (IA)'])
        sheet.lastRow!.font = { bold: true, size: 14 }
        sheet.addRow([data.summaryText])
        sheet.lastRow!.height = 100
        sheet.lastRow!.alignment = { wrapText: true, vertical: 'top' }
        const summaryRowNum = sheet.lastRow!.number
        const endCol = Math.max(effectiveCols.length, 8)
        sheet.mergeCells(summaryRowNum, 1, summaryRowNum, endCol)
        sheet.addRow([]) // empty row
    }

    const headerRow = sheet.addRow(effectiveCols.map((c) => c.header))
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFBE185D' }, // primary brand color
    }

    effectiveCols.forEach((col, index) => {
        sheet.getColumn(index + 1).width = col.width || 20
    })

    effectiveRows.forEach((row) => {
        const rowValues = effectiveCols.map((c) => row[c.key])
        sheet.addRow(rowValues)
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    triggerDownload(blob, `${filename}.xlsx`)
}

export async function exportToPdf(data: ExportData, filename: string, dashboardElementId?: string) {
    const effectiveCols = getEffectiveColumns(data)
    const effectiveRows = getEffectiveRows(data)

    // Using orientation from data, or fall back to landscape if dashboard, else portrait
    const orientation = data.orientation || (dashboardElementId ? 'landscape' : 'portrait')
    const pdf = new jsPDF(orientation, 'pt', 'a4')

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    let currentY = 40

    // Draw branded header: theme color strip at top of page
    if (data.themeColor) {
        pdf.setFillColor(data.themeColor)
        pdf.rect(0, 0, pageWidth, 12, 'F')
        currentY = 50
    }

    // Company name right-aligned
    if (data.companyName) {
        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor('#6b7280')
        pdf.text(data.companyName, pageWidth - 40, currentY, { align: 'right' })
    }

    // Title
    if (data.title) {
        if (data.themeColor) {
            pdf.setTextColor(data.themeColor)
        }
        pdf.setFontSize(22)
        pdf.setFont('helvetica', 'bold')
        pdf.text(data.title, 40, currentY)
        pdf.setTextColor('#000000') // reset
        currentY += 25

        // Date subtitle
        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor('#9ca3af')
        pdf.text(new Date().toLocaleDateString('pt-PT'), 40, currentY)
        pdf.setTextColor('#000000')
        currentY += 20
    }

    // AI Summary
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

    // Dashboard screenshot capture via html-to-image
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

    // Render proper data table using autoTable when there are rows and no dashboard
    if (effectiveRows.length > 0 && !dashboardElementId) {
        if (currentY > pageHeight - 100) {
            pdf.addPage()
            currentY = 40
        }

        autoTable(pdf, {
            startY: currentY,
            head: [effectiveCols.map((c) => c.header)],
            body: effectiveRows.map((row) =>
                effectiveCols.map((c) => {
                    const val = row[c.key]
                    return val === null || val === undefined ? '' : String(val)
                })
            ),
            headStyles: {
                fillColor: data.themeColor || '#be185d',
                textColor: '#ffffff',
                fontStyle: 'bold',
                fontSize: 9,
            },
            alternateRowStyles: {
                fillColor: '#f9fafb',
            },
            styles: {
                fontSize: 8,
                cellPadding: 4,
            },
            margin: { left: 40, right: 40 },
        })
    }

    // Render footer on every page
    const totalPages = pdf.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i)
        pdf.setFontSize(8)
        pdf.setTextColor('#9ca3af')
        if (data.footerText) {
            pdf.text(data.footerText, 40, pageHeight - 20)
        }
        pdf.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 20, { align: 'center' })
        pdf.text(new Date().toLocaleDateString('pt-PT'), pageWidth - 40, pageHeight - 20, { align: 'right' })
    }

    pdf.save(`${filename}.pdf`)
}
