'use client'
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html><body>
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Ada yang salah!</h2>
        <button onClick={() => reset()}>Coba lagi</button>
      </div>
    </body></html>
  )
}
