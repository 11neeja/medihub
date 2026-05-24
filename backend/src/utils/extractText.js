import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

/**
 * Extract text from various document types locally (no AI API needed).
 * Supports: PDF, DOCX, PPTX, CSV, XLSX, Images (OCR), plain text.
 */
export async function extractTextFromFile(filePath, mimeType) {
  const ext = path.extname(filePath).toLowerCase()

  // ── PDF ──
  if (ext === '.pdf' || mimeType === 'application/pdf') {
    const { PDFParse } = require('pdf-parse')
    const buffer = fs.readFileSync(filePath)
    const uint8 = new Uint8Array(buffer)
    const parser = new PDFParse(uint8)
    const result = await parser.getText()
    const text = result.pages.map(pg => pg.text).join('\n')
    return text || ''
  }

  // ── DOCX ──
  if (ext === '.docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = await import('mammoth')
    const fn = mammoth.extractRawText || mammoth.default?.extractRawText
    const result = await fn({ path: filePath })
    return result.value || ''
  }

  // ── PPTX / PPT / DOC (Office formats via officeparser) ──
  if (['.ppt', '.pptx', '.doc'].includes(ext) ||
      mimeType === 'application/vnd.ms-powerpoint' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      mimeType === 'application/msword') {
    const officeparser = await import('officeparser')
    const parseOffice = officeparser.parseOffice || officeparser.default?.parseOffice
    const result = await parseOffice(filePath)

    // officeparser v6 returns a structured object with a .toText() method
    if (result && typeof result === 'object' && typeof result.toText === 'function') {
      return result.toText() || ''
    }
    // Fallback: if it's already a string (older versions)
    if (typeof result === 'string') {
      return result
    }
    return ''
  }

  // ── CSV ──
  if (ext === '.csv' || mimeType === 'text/csv') {
    const content = fs.readFileSync(filePath, 'utf-8')
    return content
  }

  // ── XLSX / XLS ──
  if (['.xlsx', '.xls'].includes(ext) ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel') {
    const XLSX = await import('xlsx')
    const readFile = XLSX.readFile || XLSX.default?.readFile
    const utils = XLSX.utils || XLSX.default?.utils
    const workbook = readFile(filePath)
    let text = ''
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      text += `\n--- Sheet: ${sheetName} ---\n`
      text += utils.sheet_to_csv(sheet)
    }
    return text.trim()
  }

  // ── Images (OCR with Tesseract.js) ──
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'].includes(ext) ||
      (mimeType && mimeType.startsWith('image/'))) {
    const Tesseract = await import('tesseract.js')
    const recognize = Tesseract.recognize || Tesseract.default?.recognize
    const { data } = await recognize(filePath, 'eng')
    return data.text || ''
  }

  // ── Plain text / fallback ──
  if (['.txt', '.md', '.json', '.xml', '.html', '.htm'].includes(ext) ||
      (mimeType && mimeType.startsWith('text/'))) {
    return fs.readFileSync(filePath, 'utf-8')
  }

  throw new Error(`Unsupported file type: ${ext} (${mimeType})`)
}
