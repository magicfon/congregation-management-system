import Sidebar from './Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-mc-bg flex">
      <Sidebar />
      <main className="flex-1 ml-60 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  )
}
