const escapeXml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

export function exportExcel(filename, sheetName, headers, rows, metadata = {}) {
  const detailRows = [
    metadata.title && ['Report', metadata.title],
    metadata.period && ['Reporting period', metadata.period],
    metadata.scope && ['Scope', metadata.scope],
    ['Generated at', new Date().toLocaleString('en-PH')],
    ['Records', rows.length],
    []
  ].filter(Boolean)
  const worksheetRows = [...detailRows, headers, ...rows]
    .map((row) => `<Row>${row.map((cell) => `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`).join('')}</Row>`)
    .join('')
  const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="${escapeXml(sheetName)}"><Table>${worksheetRows}</Table></Worksheet></Workbook>`
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
