import { Link, useLocation } from 'react-router-dom'

interface NavbarProps {
  logout: () => void
}

export default function Navbar({ logout }: NavbarProps) {
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path
    ? 'text-white bg-gray-700 px-3 py-1 rounded'
    : 'text-gray-300 hover:text-white px-3 py-1'

  return (
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          ⚡ CloudPulse AI
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/" className={isActive('/')}>Dashboard</Link>
          <Link to="/chat" className={isActive('/chat')}>AI Chat</Link>
          <Link to="/simulator" className={isActive('/simulator')}>Simulator</Link>
          <Link to="/history" className={isActive('/history')}>History</Link>
          <button onClick={logout} className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm ml-2">
            Logout
          </button>
        </div>
      </div>
    </nav>
  )
}
