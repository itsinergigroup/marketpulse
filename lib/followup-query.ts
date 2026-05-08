import { ContactStatus, CustomerTag, Platform } from '@prisma/client'

export type Category =
  | 'semua'
  | 'baru_terkirim'
  | 'paket_diterima'
  | 'saatnya_beli'
  | 'rutin'
  | 'mulai_churn'
  | 'sudah_churn'
  | 'big_spender'

const days = (n: number) => new Date(Date.now() - n * 86_400_000)

export function buildCategoryWhere(category: Category, platform: Platform | null) {
  switch (category) {
    case 'baru_terkirim': {
      const statuses =
        platform === 'shopee' ? ['Sedang Dikirim'] :
        platform === 'tiktok' ? ['Pesanan Terkirim'] :
        ['Sedang Dikirim', 'Pesanan Terkirim']
      return { orders: { some: { status: { in: statuses }, orderDate: { gte: days(7) } } } }
    }
    case 'paket_diterima': {
      const statuses =
        platform === 'shopee' ? ['Selesai', 'Pesanan Selesai'] :
        platform === 'tiktok' ? ['Selesai', 'Completed'] :
        ['Selesai', 'Pesanan Selesai', 'Completed']
      return { orders: { some: { status: { in: statuses }, orderDate: { gte: days(14) } } } }
    }
    case 'saatnya_beli':
      return {
        lastOrderDate: { gte: days(35), lte: days(30) },
        tag: { in: ['repeat', 'vip'] as CustomerTag[] },
      }
    case 'rutin':
      return {
        totalOrders: { gte: 2 },
        lastOrderDate: { gte: days(30) },
        tag: { in: ['repeat', 'vip'] as CustomerTag[] },
      }
    case 'mulai_churn':
      return {
        lastOrderDate: { gte: days(90), lte: days(60) },
        tag: { in: ['repeat', 'vip'] as CustomerTag[] },
      }
    case 'sudah_churn':
      return {
        OR: [
          { lastOrderDate: { lt: days(90) } },
          { tag: { in: ['lost', 'at_risk'] as CustomerTag[] } },
        ],
      }
    case 'big_spender':
      return { totalSpend: { gte: 1_000_000 } }
    default:
      return {}
  }
}

export function buildOrderBy(category: Category) {
  if (category === 'big_spender') return [{ totalSpend: 'desc' as const }]
  return [{ lastOrderDate: 'desc' as const }]
}

export function buildWhere(opts: {
  platform: Platform | null
  search: string
  tag: CustomerTag | null
  contactStatus: ContactStatus | null
  category: Category
}) {
  const { platform, search, tag, contactStatus, category } = opts
  const parts: object[] = []

  if (platform)      parts.push({ platform })
  if (search)        parts.push({ OR: [
    { name:  { contains: search, mode: 'insensitive' as const } },
    { phone: { contains: search } },
  ]})
  if (tag)           parts.push({ tag })
  if (contactStatus) parts.push({ followUp: { contactStatus } })

  const catWhere = buildCategoryWhere(category, platform)
  if (Object.keys(catWhere).length > 0) parts.push(catWhere)

  if (parts.length === 0) return {}
  if (parts.length === 1) return parts[0]
  return { AND: parts }
}
