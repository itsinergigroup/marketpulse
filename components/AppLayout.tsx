import Sidebar from './Sidebar'
import Header from './Header'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <Header />
      <main className="ml-64 pt-16 min-h-screen">
        <div className="p-container-margin">
          {children}
        </div>
      </main>
    </div>
  )
}
