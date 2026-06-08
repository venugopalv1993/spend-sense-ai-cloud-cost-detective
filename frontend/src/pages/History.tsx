import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

interface HistoryProps {
  token: string
}

interface HistoryItem {
  id: number
  region: string
  resources_scanned: number
  issues_found: number
  estimated_savings: string
  status: string
  created_at: string
  analysis_id?: string
}

export default function History({ token }: HistoryProps) {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/history', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setHistory(data.analyses || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Loading history...</div>
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Analysis History</h1>

      {history.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400 mb-4">No analyses yet. Run your first scan!</p>
          <Link to="/" className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white">
            Go to Dashboard
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map(item => (
            <Link
              key={item.id}
              to={`/report/${item.id}`}
              className="block bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors border border-gray-700 hover:border-gray-600"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-white">{item.region}</span>
                  <span className="text-gray-400 text-sm ml-3">
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-400">{item.resources_scanned} resources</span>
                  <span className="text-yellow-400">{item.issues_found} issues</span>
                  <span className="text-green-400 font-medium">{item.estimated_savings}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
