import { Link } from 'react-router-dom'

interface NavbarProps {
  logout: () => void
}

export default function Navbar({ logout }: NavbarProps) {
  return (
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-blue-400">
          🔍 Cloud Cost Detective
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-300 hover:text-white">Dashboard</Link>
          <Link to="/history" className="text-gray-300 hover:text-white">History</Link>
          <button onClick={logout} className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm">
            Logout
          </button>
        </div>
      </div>
    </nav>
  )
}
