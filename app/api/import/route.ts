import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { Platform } from '@prisma/client'

// ─── Column layout (from direct file inspection) ──────────────────────────────
//
// SHOPEE — columns read: 1, 2, 10, 14, 40, 44  (all others skipped)
//   1  No. Pesanan          → orderNumber
//   2  Status Pesanan       → status
//  10  Waktu Pesanan Dibuat → orderDate    "2026-03-01 00:02"
//  14  Nama Produk          → productName
//  40  Total Pembayaran     → totalAmount  "176.200" (IDR, dot = thousand sep)
//  44  Username (Pembeli)   → phone + name (unmasked; col 46 phone is masked)
//
// TIKTOK — non-standard XML; each cell is its own <row r="N"> element
//   Row 1 = headers, Row 2 = descriptions, data starts row 3
//   Columns read: A, B, H, AC, AD, AR, AT  (all others filtered)
//   A   Order ID     → orderNumber
//   B   Order Status → status
//   H   Product Name → productName
//   AC  Order Amount → totalAmount  plain integer "164039"
//   AD  Created Time → orderDate    "28/02/2026 23:40:26"
//   AR  Buyer Username → customerName
//   AT  Phone #      → phone        "(+62)836******04"
// ─────────────────────────────────────────────────────────────────────────────

interface OrderRow {
  orderNumber: string
  customerName: string
  phone: string
  productName: string
  totalAmount: number
  orderDate: Date
  status: string
}

// IDR amounts use dots as thousand separators: "176.200" = 176_200
function parseAmount(val: unknown): number {
  const str = String(val ?? '').trim().replace(/[Rp\s]/g, '')
  if (!str) return 0
  if (str.includes(',')) {
    // comma = decimal separator ("1.234,56" → 1234.56)
    return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0
  }
  // dots = thousand separators only — strip them
  return parseFloat(str.replace(/\./g, '')) || 0
}

function parseDate(val: unknown): Date {
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val
  const str = String(val ?? '').trim()
  if (!str) return new Date()

  // TikTok: "28/02/2026 23:40:26"
  const ddmm = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/)
  if (ddmm) {
    const [, d, m, y, h, min, s] = ddmm
    const parsed = new Date(`${y}-${m}-${d}T${h}:${min}:${s}`)
    return isNaN(parsed.getTime()) ? new Date() : parsed
  }

  // Shopee: "2026-03-01 00:02"
  const parsed = new Date(str.replace(' ', 'T'))
  return isNaN(parsed.getTime()) ? new Date() : parsed
}

// ─── Shopee parser ────────────────────────────────────────────────────────────

async function parseShopee(buffer: ArrayBuffer): Promise<OrderRow[]> {
  const wb = new ExcelJS.Workbook()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(Buffer.from(buffer) as any)
  const ws = wb.worksheets[0]
  const rows: OrderRow[] = []

  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i)

    const orderNumber = String(row.getCell(1).value ?? '').trim()
    if (!orderNumber) continue

    const username = String(row.getCell(44).value ?? '').trim()
    if (!username) continue

    rows.push({
      orderNumber,
      customerName: username,
      phone:        username,
      status:       String(row.getCell(2).value ?? '').trim(),
      orderDate:    parseDate(row.getCell(10).value),
      productName:  String(row.getCell(14).value ?? '').trim(),
      totalAmount:  parseAmount(row.getCell(40).value),
    })
  }

  return rows
}

// ─── TikTok parser ────────────────────────────────────────────────────────────

const TIKTOK_COLS = new Set(['A', 'B', 'H', 'AC', 'AD', 'AR', 'AT'])

async function parseTikTok(buffer: ArrayBuffer): Promise<OrderRow[]> {
  const zip = await JSZip.loadAsync(Buffer.from(buffer))

  const sheetFile = zip.file('xl/worksheets/sheet2.xml')
  if (!sheetFile) throw new Error('sheet2.xml not found in TikTok xlsx')

  const xml = await sheetFile.async('string')

  // Each cell is its own <row r="N"> element (non-standard)
  const cellRe = /<row r="(\d+)"><c r="([A-Z]+)\d+"(?:\s+t="[^"]*")?><v>([^<]*)<\/v><\/c><\/row>/g
  const grid: Record<string, Record<string, string>> = {}

  let match: RegExpExecArray | null
  while ((match = cellRe.exec(xml)) !== null) {
    const [, rowNum, col, val] = match
    if (!TIKTOK_COLS.has(col)) continue   // skip irrelevant columns
    if (!grid[rowNum]) grid[rowNum] = {}
    grid[rowNum][col] = val
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'")
  }

  const rows: OrderRow[] = []
  const maxRow = Math.max(...Object.keys(grid).map(Number))

  // Row 1 = headers, Row 2 = column descriptions, data starts at row 3
  for (let i = 3; i <= maxRow; i++) {
    const row = grid[String(i)]
    if (!row) continue

    const orderNumber = (row['A'] ?? '').trim()
    const phone       = (row['AT'] ?? '').trim()
    if (!orderNumber || !phone) continue

    rows.push({
      orderNumber,
      customerName: (row['AR'] ?? '').trim(),
      phone,
      status:       (row['B'] ?? '').trim(),
      productName:  (row['H'] ?? '').trim(),
      totalAmount:  parseAmount(row['AC']),
      orderDate:    parseDate(row['AD']),
    })
  }

  return rows
}

// ─── Per-row DB work ──────────────────────────────────────────────────────────

async function processRow(row: OrderRow, platform: Platform): Promise<'imported' | 'skipped'> {
  let customer
  try {
    customer = await prisma.customer.upsert({
      where: { name_platform: { name: row.customerName, platform } },
      create: {
        name:          row.customerName,
        platform,
        totalOrders:   1,
        totalSpend:    row.totalAmount,
        lastOrderDate: row.orderDate,
      },
      update: {
        totalOrders:   { increment: 1 },
        totalSpend:    { increment: row.totalAmount },
        lastOrderDate: row.orderDate,
      },
    })
  } catch (err) {
    console.error('[import] customer upsert error:', row.orderNumber, String(err))
    return 'skipped'
  }

  try {
    await prisma.order.create({
      data: {
        customerId:  customer.id,
        orderNumber: row.orderNumber,
        platform,
        totalAmount: row.totalAmount,
        orderDate:   row.orderDate,
        status:      row.status,
        productName: row.productName,
      },
    })
    return 'imported'
  } catch {
    // unique constraint on orderNumber — duplicate
    return 'skipped'
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let formData: FormData
    try {
      formData = await req.formData()
    } catch (err) {
      console.error('[import] formData error:', err)
      return NextResponse.json({ error: 'Failed to parse form data', detail: String(err) }, { status: 400 })
    }

    const file     = formData.get('file') as File | null
    const platform = formData.get('platform') as Platform | null

    console.log('[import] file:', file?.name, file?.size, 'platform:', platform)

    if (!file || !platform) {
      return NextResponse.json({ error: 'file and platform required' }, { status: 400 })
    }
    if (!['shopee', 'tiktok'].includes(platform)) {
      return NextResponse.json({ error: `Invalid platform: ${platform}` }, { status: 400 })
    }

    let buffer: ArrayBuffer
    try {
      buffer = await file.arrayBuffer()
    } catch (err) {
      console.error('[import] arrayBuffer error:', err)
      return NextResponse.json({ error: 'Failed to read file buffer', detail: String(err) }, { status: 400 })
    }

    let rows: OrderRow[]
    try {
      rows = platform === 'shopee' ? await parseShopee(buffer) : await parseTikTok(buffer)
      console.log('[import] parsed rows:', rows.length)
    } catch (err) {
      console.error('[import] parse error:', err)
      return NextResponse.json({ error: 'Gagal membaca file Excel', detail: String(err) }, { status: 422 })
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data valid di file' }, { status: 422 })
    }

    const startMs = Date.now()
    let imported = 0
    let skipped  = 0

    // Process 100 rows concurrently per chunk, chunks run sequentially
    for (const chunk of chunkArray(rows, 100)) {
      const results = await Promise.all(chunk.map(row => processRow(row, platform)))
      for (const r of results) {
        if (r === 'imported') imported++
        else skipped++
      }
    }

    const durationMs = Date.now() - startMs
    console.log(`[import] done — imported: ${imported}, skipped: ${skipped}, ${durationMs}ms`)

    // Save import history (non-blocking — don't fail the request if this errors)
    const userId = (session.user as { id?: string }).id
    if (userId) {
      prisma.importHistory.create({
        data: {
          platform,
          fileName:  file.name,
          totalRows: rows.length,
          imported,
          skipped,
          durationMs,
          importedBy: userId,
        },
      }).catch((err) => console.error('[import] history save error:', err))
    }

    return NextResponse.json({ success: true, imported, skipped, total: rows.length, durationMs })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack   = err instanceof Error ? err.stack   : undefined
    console.error('[import] unhandled error:', stack ?? err)
    void stack
    return NextResponse.json({ error: 'Import failed. Check server logs.' }, { status: 500 })
  }
}
