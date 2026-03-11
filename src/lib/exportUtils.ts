import * as XLSX from 'xlsx'

/**
 * Export tabular data to an Excel file and trigger download.
 */
export function exportToExcel(
  rows: Record<string, string | number>[],
  headers: { key: string; label: string }[],
  fileName: string
) {
  const data = rows.map((row) => {
    const obj: Record<string, string | number> = {}
    for (const h of headers) {
      obj[h.label] = row[h.key] ?? ''
    }
    return obj
  })

  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Export')
  XLSX.writeFile(wb, `${fileName}.xlsx`)
}

/**
 * Export tabular data to CSV and trigger download.
 */
export function exportToCSV(
  rows: Record<string, string | number>[],
  headers: { key: string; label: string }[],
  fileName: string
) {
  const headerLine = headers.map((h) => `"${h.label}"`).join(',')
  const dataLines = rows.map((row) =>
    headers
      .map((h) => {
        const val = row[h.key] ?? ''
        return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
      })
      .join(',')
  )
  const csv = [headerLine, ...dataLines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileName}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
