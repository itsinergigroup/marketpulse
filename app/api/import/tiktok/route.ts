import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import JSZip from 'jszip'
import {
  type OrderRow,
  type SkippedRow,
  parseAmount,
  parseDateTikTok,
  runImport,
  saveImportHistory,
} from '@/lib/import-shared'

// Column header text → OrderRow field
const TIKTOK_HEADERS: Record<string, keyof TikTokCols> = {
  'Order ID':       'orderNumber',
  'Buyer Username': 'customerName',
  'Order Amount':   'totalAmount',
  'Created Time':   'orderDate',
  'Product Name':   'productName',
  'Order Status':   'status',
}

interface TikTokCols {
  orderNumber: string
  customerName: string
  totalAmount: string
  orderDate: string
  productName: string
  status: string
}

async function parseTikTok(buffer: Buffer): Promise<{ rows: OrderRow[]; skippedRows: SkippedRow[] }> {
  const zip = await JSZip.loadAsync(buffer)

  // TikTok xlsx stores worksheet data in sheet2.xml (workbook sheetId=2)
  const sheetFile = zip.file('xl/worksheets/sheet2.xml')
  if (!sheetFile) throw new Error('sheet2.xml not found in TikTok xlsx')

  const xml = await sheetFile.async('string')

  // Non-standard structure: every cell is its own <row r="N"> element
  const cellRe = /<row r="(\d+)"><c r="([A-Z]+)\d+"(?:\s+t="[^"]*")?><v>([^<]*)<\/v><\/c><\/row>/g
  const grid: Record<string, Record<string, string>> = {}

  let m: RegExpExecArray | null
  while ((m = cellRe.exec(xml)) !== null) {
    const [, rowNum, col, val] = m
    if (!grid[rowNum]) grid[rowNum] = {}
    grid[rowNum][col] = val
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
  }

  // Row 1 = column headers → build letter → field mapping
  const hdrRow = grid['1'] ?? {}
  const colToField: Record<string, keyof TikTokCols> = {}
  for (const [letter, text] of Object.entries(hdrRow)) {
    const field = TIKTOK_HEADERS[text.trim()]
    if (field) colToField[letter] = field
  }

  console.log('[import/tiktok] colToField:', colToField)

  const rows: OrderRow[] = []
  const skippedRows: SkippedRow[] = []
  const maxRow = Math.max(0, ...Object.keys(grid).map(Number))

  // Row 2 = column descriptions, data starts at row 3
  for (let i = 3; i <= maxRow; i++) {
    const row = grid[String(i)]
    if (!row) continue

    const get = (field: keyof TikTokCols): string => {
      const letter = Object.keys(colToField).find((l) => colToField[l] === field)
      return letter ? (row[letter] ?? '').trim() : ''
    }

    const orderNumber  = get('orderNumber')
    const customerName = get('customerName')

    if (!orderNumber) {
      const skip: SkippedRow = { row: i, orderNumber: '(empty)', reason: 'missing_field', detail: 'orderNumber' }
      skippedRows.push(skip)
      console.log(`[import/tiktok] skip row=${i} reason=missing_field detail=orderNumber`)
      continue
    }
    if (!customerName) {
      const skip: SkippedRow = { row: i, orderNumber, reason: 'missing_field', detail: 'customerName' }
      skippedRows.push(skip)
      console.log(`[import/tiktok] skip row=${i} orderNumber=${orderNumber} reason=missing_field detail=customerName`)
      continue
    }

    rows.push({
      rowIndex:     i,
      orderNumber,
      customerName,
      totalAmount:  parseAmount(get('totalAmount')),
      orderDate:    parseDateTikTok(get('orderDate')),
      productName:  get('productName') || 'Unknown',
      status:       get('status') || 'Unknown',
    })
  }

  return { rows, skippedRows }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let formData: FormData
    try {
      formData = await req.formData()
    } catch (err) {
      return NextResponse.json({ error: 'Failed to parse form data', detail: String(err) }, { status: 400 })
    }

    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    console.log('[import/tiktok] file:', file.name, file.size)

    let buffer: Buffer
    try {
      buffer = Buffer.from(await file.arrayBuffer())
    } catch (err) {
      return NextResponse.json({ error: 'Failed to read file', detail: String(err) }, { status: 400 })
    }

    let rows: OrderRow[]
    let parseSkippedRows: SkippedRow[]
    try {
      const parsed     = await parseTikTok(buffer)
      rows             = parsed.rows
      parseSkippedRows = parsed.skippedRows
      console.log(
        `[import/tiktok] parsed rows: ${rows.length} | skipped (missing fields): ${parseSkippedRows.length}`,
      )
    } catch (err) {
      console.error('[import/tiktok] parse error:', err)
      return NextResponse.json({ error: 'Gagal membaca file Excel', detail: String(err) }, { status: 422 })
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data valid di file' }, { status: 422 })
    }

    const result = await runImport(rows, 'tiktok')

    const allSkippedRows = [...parseSkippedRows, ...result.skippedRows]
    const skippedByReason = {
      missingField:         parseSkippedRows.length,
      duplicateOrderNumber: result.skippedByReason.duplicateOrderNumber,
      customerNotFound:     result.skippedByReason.customerNotFound,
    }

    console.log(
      `[import/tiktok] done — imported: ${result.imported}, skipped: ${allSkippedRows.length}, ${result.durationMs}ms`,
    )
    console.log('[import/tiktok] skippedByReason:', skippedByReason)

    const userId = (session.user as { id?: string }).id
    if (userId) {
      saveImportHistory({
        platform:   'tiktok',
        fileName:   file.name,
        totalRows:  rows.length + parseSkippedRows.length,
        imported:   result.imported,
        skipped:    allSkippedRows.length,
        durationMs: result.durationMs,
        userId,
      })
    }

    return NextResponse.json({
      success:      true,
      imported:     result.imported,
      skipped:      allSkippedRows.length,
      total:        rows.length + parseSkippedRows.length,
      durationMs:   result.durationMs,
      skippedByReason,
      skippedRows:  allSkippedRows,
    })
  } catch (err) {
    console.error('[import/tiktok] unhandled error:', err)
    return NextResponse.json({ error: 'Import failed. Check server logs.' }, { status: 500 })
  }
}
