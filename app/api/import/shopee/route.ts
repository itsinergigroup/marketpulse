import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import ExcelJS from 'exceljs'
import {
  type OrderRow,
  type SkippedRow,
  parseAmount,
  parseDateShopee,
  runImport,
  saveImportHistory,
} from '@/lib/import-shared'

// Column names as they appear in Shopee export header row
const COL = {
  orderNumber:  'No. Pesanan',
  customerName: 'Username (Pembeli)',
  totalAmount:  'Total Pembayaran',
  orderDate:    'Waktu Pesanan Dibuat',
  productName:  'Nama Produk',
  status:       'Status Pesanan',
} as const

async function parseShopee(buffer: Buffer): Promise<{ rows: OrderRow[]; skippedRows: SkippedRow[] }> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as unknown as ArrayBuffer)
  const ws = wb.worksheets[0]

  // Build header → column-index map (position-independent)
  const colMap: Record<string, number> = {}
  ws.getRow(1).eachCell((cell, colNumber) => {
    const header = String(cell.value ?? '').trim()
    if (header) colMap[header] = colNumber
  })

  const ci = {
    orderNumber:  colMap[COL.orderNumber],
    customerName: colMap[COL.customerName],
    totalAmount:  colMap[COL.totalAmount],
    orderDate:    colMap[COL.orderDate],
    productName:  colMap[COL.productName],
    status:       colMap[COL.status],
  }

  console.log('[import/shopee] column indices:', ci)

  const rows: OrderRow[] = []
  const skippedRows: SkippedRow[] = []

  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i)
    const orderNumber  = String(row.getCell(ci.orderNumber  ?? 0).value ?? '').trim()
    const customerName = String(row.getCell(ci.customerName ?? 0).value ?? '').trim()

    if (!orderNumber) {
      const skip: SkippedRow = { row: i, orderNumber: '(empty)', reason: 'missing_field', detail: 'orderNumber' }
      skippedRows.push(skip)
      console.log(`[import/shopee] skip row=${i} reason=missing_field detail=orderNumber`)
      continue
    }
    if (!customerName) {
      const skip: SkippedRow = { row: i, orderNumber, reason: 'missing_field', detail: 'customerName' }
      skippedRows.push(skip)
      console.log(`[import/shopee] skip row=${i} orderNumber=${orderNumber} reason=missing_field detail=customerName`)
      continue
    }

    rows.push({
      rowIndex:     i,
      orderNumber,
      customerName,
      totalAmount:  parseAmount(row.getCell(ci.totalAmount ?? 0).value),
      orderDate:    parseDateShopee(row.getCell(ci.orderDate ?? 0).value),
      productName:  String(row.getCell(ci.productName ?? 0).value ?? '').trim() || 'Unknown',
      status:       String(row.getCell(ci.status ?? 0).value ?? '').trim() || 'Unknown',
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

    console.log('[import/shopee] file:', file.name, file.size)

    let buffer: Buffer
    try {
      buffer = Buffer.from(await file.arrayBuffer())
    } catch (err) {
      return NextResponse.json({ error: 'Failed to read file', detail: String(err) }, { status: 400 })
    }

    let rows: OrderRow[]
    let parseSkippedRows: SkippedRow[]
    try {
      const parsed    = await parseShopee(buffer)
      rows            = parsed.rows
      parseSkippedRows = parsed.skippedRows
      console.log(
        `[import/shopee] parsed rows: ${rows.length} | skipped (missing fields): ${parseSkippedRows.length}`,
      )
    } catch (err) {
      console.error('[import/shopee] parse error:', err)
      return NextResponse.json({ error: 'Gagal membaca file Excel', detail: String(err) }, { status: 422 })
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data valid di file' }, { status: 422 })
    }

    const result = await runImport(rows, 'shopee')

    const allSkippedRows = [...parseSkippedRows, ...result.skippedRows]
    const skippedByReason = {
      missingField:          parseSkippedRows.length,
      duplicateOrderNumber:  result.skippedByReason.duplicateOrderNumber,
      customerNotFound:      result.skippedByReason.customerNotFound,
    }

    console.log(
      `[import/shopee] done — imported: ${result.imported}, skipped: ${allSkippedRows.length}, ${result.durationMs}ms`,
    )
    console.log('[import/shopee] skippedByReason:', skippedByReason)

    const userId = (session.user as { id?: string }).id
    if (userId) {
      saveImportHistory({
        platform:   'shopee',
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
    const message = err instanceof Error ? err.message : String(err)
    console.error('[import/shopee] unhandled error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
