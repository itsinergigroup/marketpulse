import { CustomerTag } from '@prisma/client'

const tagConfig: Record<CustomerTag, { label: string; className: string }> = {
  new:     { label: 'Baru',    className: 'bg-secondary-container text-on-secondary-container' },
  repeat:  { label: 'Repeat',  className: 'bg-tertiary-fixed text-on-tertiary-fixed' },
  vip:     { label: 'VIP',     className: 'bg-primary-fixed text-on-primary-fixed' },
  at_risk: { label: 'At Risk', className: 'bg-error-container text-on-error-container' },
  lost:    { label: 'Lost',    className: 'bg-surface-container-highest text-on-surface-variant' },
}

export default function StageBadge({ tag }: { tag: CustomerTag }) {
  const config = tagConfig[tag]
  return (
    <span className={`inline-flex items-center px-sm py-xs rounded-full text-label-sm font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}
