import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

interface DashboardProps {
  token: string
}

interface ProgressMessage {
  text: string
  done: boolean
}

export default function Dashboard({ token }: DashboardProps) {
  const [regions, setRegions] = useState<string[]>([])
  const [selectedRegion, setSelectedRegion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [messages, setMessages] = useState<ProgressMessage[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/regions', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setRegions(data.regions || [])
        setSelectedRegion(data.regions?.[0] || '')
      })
      .catch(() => setError('Failed to load regions'))
  }, [token])

  const runAnalysis = async () => {
    setLoading(true)
    setError('')
    setMessages([])
    setProgress(0)

    // Generate analysis_id client-side and connect WebSocket first
    const analysisId = crypto.randomUUID()

    // Connect WebSocket before triggering analysis
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/progress/${analysisId}`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'progress') {
        setProgress(data.percent || 0)
        setMessages(prev => {
          const updated = prev.map(m => ({ ...m, done: true }))
          return [...updated, { text: data.message, done: false }]
        })
      }
      if (data.type === 'complete') {
        setProgress(100)
        setMessages(prev => prev.map(m => ({ ...m, done: true })))
      }
    }

    // Wait for WS to open, then trigger analysis
    ws.onopen = async () => {
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ region: selectedRegion, analysis_id: analysisId })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Analysis failed')
        // Small delay so user can see the complete state
        setTimeout(() => {
          navigate(`/report/${data.db_id || data.analysis_id}`, { state: { report: data } })
        }, 800)
      } catch (err: any) {
        setError(err.message)
        setLoading(false)
      }
    }

    ws.onerror = () => {
      // If WS fails, still run analysis without progress
      runAnalysisDirect()
    }
  }

  const runAnalysisDirect = async () => {
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ region: selectedRegion })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Analysis failed')
      navigate(`/report/${data.db_id || data.analysis_id}`, { state: { report: data } })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
      <p className="text-gray-400 mb-8">Scan your AWS resources for cost optimization opportunities</p>

      {error && <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-2 rounded mb-4">{error}</div>}

      <div className="bg-gray-800 rounded-lg p-6">
        <label className="block text-sm text-gray-300 mb-2">Select AWS Region</label>
        <select
          value={selectedRegion}
          onChange={e => setSelectedRegion(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 mb-4"
        >
          {regions.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <button
          onClick={runAnalysis}
          disabled={loading || !selectedRegion}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-3 rounded font-medium text-lg"
        >
          {loading ? '🔍 Scanning resources...' : '🚀 Run Cost Analysis'}
        </button>

        {/* Live Progress Tracker */}
        {loading && (
          <div className="mt-4 bg-gray-900 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Analyzing...</span>
              <span className="text-sm text-blue-400 font-mono">{progress}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {messages.map((msg, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {msg.done ? (
                    <span className="text-green-400">✓</span>
                  ) : (
                    <span className="text-blue-400 animate-pulse">●</span>
                  )}
                  <span className={msg.done ? 'text-gray-500' : 'text-gray-300'}>{msg.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-3">What gets scanned?</h2>
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-400">
          <div>• EC2 Instances</div>
          <div>• EBS Volumes</div>
          <div>• Elastic IPs</div>
          <div>• RDS Instances</div>
          <div>• S3 Buckets</div>
          <div>• Lambda Functions</div>
          <div>• Load Balancers</div>
        </div>
      </div>
    </div>
  )
}
