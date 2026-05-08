import { CustomerTag } from '@prisma/client'

const tagConfig: Record<CustomerTag, { label: string; className: string }> = {
  new: { label: 'Baru', className: 'bg-blue-100 text-blue-800' },
  repeat: { label: 'Repeat', className: 'bg-orange-100 text-orange-800' },
  vip: { label: 'VIP', className: 'bg-purple-100 text-purple-800' },
  at_risk: { label: 'At Risk', className: 'bg-red-100 text-red-800' },
  lost: { label: 'Lost', className: 'bg-gray-200 text-gray-800' },
}

export default function StageBadge({ tag }: { tag: CustomerTag }) {
  const config = tagConfig[tag]
  return (
    <span className={`inline-flex items-center px-sm py-xs rounded-full text-label-sm font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}
