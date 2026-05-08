import { Platform } from '@prisma/client'

export default function PlatformBadge({ platform }: { platform: Platform }) {
  if (platform === 'shopee') {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-orange-500 text-white font-bold text-xs">
        S
      </span>
    )
  }
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-black text-white font-bold text-xs">
      T
    </span>
  )
}
