import { prisma } from '@/lib/prisma'
import { CustomerTag, Platform } from '@prisma/client'

export interface OrderRow {
  rowIndex?: number   // 1-based file row set by parsers; used in skip reports
  orderNumber: string
  customerName: string
  productName: string
  totalAmount: number
  orderDate: Date
  status: string
}

export interface SkippedRow {
  row?: number
  orderNumber: string
  reason: 'duplicate_order_number' | 'customer_not_found' | 'missing_field'
  detail?: string     // which field is missing, or DB error snippet
}

export interface ImportRunResult {
  imported: number
  skipped: number
  totalRows: number
  durationMs: number
  skippedRows: SkippedRow[]
  skippedByReason: {
    duplicateOrderNumber: number
    customerNotFound: number
  }
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

// IDR: dots are thousand separators ("176.200" = 176200)
export function parseAmount(val: unknown): number {
  const str = String(val ?? '').trim().replace(/[Rp\s]/g, '')
  if (!str) return 0
  if (str.includes(',')) return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0
  return parseFloat(str.replace(/\./g, '')) || 0
}

export function parseDateShopee(val: unknown): Date {
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val
  const str = String(val ?? '').trim()
  if (!str) return new Date()
  const parsed = new Date(str.replace(' ', 'T'))
  return isNaN(parsed.getTime()) ? new Date() : parsed
}

export function parseDateTikTok(val: unknown): Date {
  const str = String(val ?? '').trim()
  if (!str) return new Date()
  // "28/02/2026 23:40:26"
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})$/)
  if (m) {
    const parsed = new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}`)
    return isNaN(parsed.getTime()) ? new Date() : parsed
  }
  return new Date()
}

// ─── Tag logic ────────────────────────────────────────────────────────────────

function computeTag(totalOrders: number, lastOrderDate: Date): CustomerTag {
  const daysAgo = (Date.now() - lastOrderDate.getTime()) / 86_400_000
  if (daysAgo > 180)    return 'lost'
  if (daysAgo > 60)     return 'at_risk'
  if (totalOrders >= 5) return 'vip'
  if (totalOrders >= 2) return 'repeat'
  return 'new'
}

// ─── Recalculate customer stats from live order data ─────────────────────────

async function recalculateCustomers(customerIds: string[]): Promise<void> {
  if (customerIds.length === 0) return
  await Promise.all(
    customerIds.map(async (customerId) => {
      const agg = await prisma.order.aggregate({
        where:  { customerId },
        _count: { _all: true },
        _sum:   { totalAmount: true },
        _max:   { orderDate: true },
      })
      const totalOrders   = agg._count._all
      const totalSpend    = agg._sum.totalAmount ?? 0
      const lastOrderDate = agg._max.orderDate ?? new Date()
      const tag           = computeTag(totalOrders, lastOrderDate)
      await prisma.customer.update({
        where: { id: customerId },
        data:  { totalOrders, totalSpend, lastOrderDate, tag },
      })
    })
  )
}

// ─── Main import algorithm ───────────────────────────────────────────────────
//
// Algorithm (avoids race conditions on concurrent customer creation):
//
//  1. Collect all unique customerNames from parsed rows.
//  2. Bulk-fetch existing customers for this platform.
//  3. Create any missing customers SEQUENTIALLY (no concurrent create collisions).
//  4. For each row in parallel chunks of 100:
//       a. If orderNumber already in DB → skip ("duplicate_order_number")
//       b. Else → create Order linked to customerMap entry → imported
//  5. Recalculate stats for every customer that received at least one new order.
//
// The key fix: customer creation is sequential (step 3), so there is no
// INSERT race between concurrent workers.  Order creation is parallel (step 4)
// and is safe because orderNumber has a DB-level unique constraint — a
// duplicate just throws and is caught as "skipped".

export async function runImport(
  rows: OrderRow[],
  platform: Platform,
): Promise<ImportRunResult> {
  const startMs = Date.now()
  let imported  = 0
  let skipped   = 0
  const skippedRows: SkippedRow[] = []
  const skippedByReason = { duplicateOrderNumber: 0, customerNotFound: 0 }

  const addSkip = (s: SkippedRow) => {
    skipped++
    if (s.reason === 'duplicate_order_number') skippedByReason.duplicateOrderNumber++
    else if (s.reason === 'customer_not_found') skippedByReason.customerNotFound++
    skippedRows.push(s)
    console.log(
      `[import/${platform}] skip row=${s.row ?? '?'} orderNumber=${s.orderNumber} reason=${s.reason}${s.detail ? ` (${s.detail})` : ''}`,
    )
  }

  // ── Step 1: collect unique customer names ──────────────────────────────────
  const uniqueNames = Array.from(new Set(rows.map((r) => r.customerName).filter(Boolean)))

  // ── Step 2: bulk-fetch existing customers ──────────────────────────────────
  const existingCustomers = await prisma.customer.findMany({
    where:  { name: { in: uniqueNames }, platform },
    select: { id: true, name: true },
  })
  const customerMap = new Map<string, string>() // name → id
  for (const c of existingCustomers) customerMap.set(c.name, c.id)

  // ── Step 3: create missing customers SEQUENTIALLY ─────────────────────────
  for (const name of uniqueNames) {
    if (customerMap.has(name)) continue
    try {
      const c = await prisma.customer.create({
        data: { name, platform, totalOrders: 0, totalSpend: 0, tag: 'new' },
      })
      customerMap.set(name, c.id)
    } catch {
      // Lost a race against a concurrent import — fetch the winner's record
      const existing = await prisma.customer.findUnique({
        where:  { name_platform: { name, platform } },
        select: { id: true },
      })
      if (existing) customerMap.set(name, existing.id)
      // If still not found, rows for this customer will be skipped below
    }
  }

  // ── Step 4: create orders in parallel chunks ───────────────────────────────
  const importedCustomerIds = new Set<string>()

  for (let chunkStart = 0; chunkStart < rows.length; chunkStart += 100) {
    const chunk = rows.slice(chunkStart, chunkStart + 100)
    await Promise.all(
      chunk.map(async (row) => {
        const customerId = customerMap.get(row.customerName)
        if (!customerId) {
          addSkip({ row: row.rowIndex, orderNumber: row.orderNumber, reason: 'customer_not_found' })
          return
        }

        try {
          await prisma.order.create({
            data: {
              customerId,
              orderNumber: row.orderNumber,
              platform,
              totalAmount: row.totalAmount,
              orderDate:   row.orderDate,
              status:      row.status || 'Unknown',
              productName: row.productName || 'Unknown',
            },
          })
          imported++
          importedCustomerIds.add(customerId)
        } catch {
          // Unique constraint on orderNumber — already in DB or duplicate within file
          addSkip({ row: row.rowIndex, orderNumber: row.orderNumber, reason: 'duplicate_order_number' })
        }
      }),
    )
  }

  // ── Step 5: recalculate stats for customers that received new orders ────────
  await recalculateCustomers(Array.from(importedCustomerIds))

  const durationMs = Date.now() - startMs

  if (skippedRows.length > 0) {
    console.log(`[import/${platform}] skip summary — duplicateOrderNumber: ${skippedByReason.duplicateOrderNumber}, customerNotFound: ${skippedByReason.customerNotFound}`)
  }

  return { imported, skipped, totalRows: rows.length, durationMs, skippedRows, skippedByReason }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

export async function saveImportHistory(opts: {
  platform: Platform
  fileName: string
  totalRows: number
  imported: number
  skipped: number
  durationMs: number
  userId: string
}) {
  return prisma.importHistory
    .create({
      data: {
        platform:   opts.platform,
        fileName:   opts.fileName,
        totalRows:  opts.totalRows,
        imported:   opts.imported,
        skipped:    opts.skipped,
        durationMs: opts.durationMs,
        importedBy: opts.userId,
      },
    })
    .catch((err) => console.error('[import] history save error:', err))
}
