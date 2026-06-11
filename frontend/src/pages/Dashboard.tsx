import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

interface DashboardProps {
  token: string
}

interface ProgressMessage {
  text: string
  done: boolean
}

interface CostOverview {
  cost_data: {
    total_cost: number
    daily_average: number
    services: Record<string, number>
    error?: string
  }
  forecast: {
    forecast_total: number
  }
  budgets: Array<{
    name: string
    limit: number
    actual_spend: number
    utilization_percent: number
    overrun_risk: boolean
  }>
}

export default function Dashboard({ token }: DashboardProps) {
  const [regions, setRegions] = useState<string[]>([])
  const [selectedRegion, setSelectedRegion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [messages, setMessages] = useState<ProgressMessage[]>([])
  const [costOverview, setCostOverview] = useState<CostOverview | null>(null)
  const [viewMode, setViewMode] = useState<'technical' | 'business'>('business')
  const [latestScore, setLatestScore] = useState<number | null>(null)
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

    // Load cost overview
    fetch('/api/cost-overview', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setCostOverview(data) })
      .catch(() => {})

    // Load latest efficiency score from history
    fetch('/api/history', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.analyses?.length > 0) {
          fetch(`/api/history/${data.analyses[0].id}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
            .then(res => res.json())
            .then(detail => {
              if (detail.analysis_result?.efficiency_score) {
                setLatestScore(detail.analysis_result.efficiency_score)
              }
            })
        }
      })
      .catch(() => {})
  }, [token])

  const runAnalysis = async () => {
    setLoading(true)
    setError('')
    setMessages([])
    setProgress(0)

    const analysisId = crypto.randomUUID()
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
        setTimeout(() => {
          navigate(`/report/${data.db_id || data.analysis_id}`, { state: { report: data } })
        }, 800)
      } catch (err: any) {
        setError(err.message)
        setLoading(false)
      }
    }

    ws.onerror = () => {
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

  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  const scoreRingColor = (score: number) => {
    if (score >= 80) return '#4ade80'
    if (score >= 60) return '#facc15'
    return '#f87171'
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">CloudPulse Dashboard</h1>
          <p className="text-gray-400">AI-powered cloud optimization insights</p>
        </div>
        <div className="flex gap-2 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('business')}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${viewMode === 'business' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Business View
          </button>
          <button
            onClick={() => setViewMode('technical')}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${viewMode === 'technical' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Technical View
          </button>
        </div>
      </div>

      {error && <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-2 rounded mb-4">{error}</div>}

      {/* Efficiency Score Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-gray-800 rounded-lg p-6 flex flex-col items-center justify-center">
          <h3 className="text-sm text-gray-400 mb-3">Cloud Efficiency Score</h3>
          <div className="relative w-32 h-32">
            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" stroke="#374151" strokeWidth="10" fill="none" />
              <circle
                cx="60" cy="60" r="50"
                stroke={scoreRingColor(latestScore || 0)}
                strokeWidth="10"
                fill="none"
                strokeDasharray={`${((latestScore || 0) / 100) * 314} 314`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-3xl font-bold ${scoreColor(latestScore || 0)}`}>
                {latestScore !== null ? latestScore : '--'}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">out of 100</p>
        </div>

        {/* Cost Summary */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-sm text-gray-400 mb-3">
            {viewMode === 'business' ? 'Monthly Spend' : 'Resource Metrics'}
          </h3>
          {costOverview ? (
            costOverview.cost_data?.error ? (
              <div className="space-y-2">
                <div className="text-yellow-400 text-sm font-medium">Cost Explorer unavailable</div>
                <p className="text-xs text-gray-500">Your IAM policy may be missing <code className="text-gray-400">ce:GetCostAndUsage</code> permission, or Cost Explorer is not enabled in the AWS console.</p>
              </div>
            ) : viewMode === 'business' ? (
              <div className="space-y-3">
                <div>
                  <div className="text-2xl font-bold text-white">${costOverview.cost_data?.total_cost ?? '--'}</div>
                  <div className="text-xs text-gray-500">Last 30 days</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-blue-400">${costOverview.cost_data?.daily_average ?? '--'}/day</div>
                  <div className="text-xs text-gray-500">Daily average</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-yellow-400">${costOverview.forecast?.forecast_total ?? '--'}</div>
                  <div className="text-xs text-gray-500">Next month forecast</div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(costOverview.cost_data?.services || {}).slice(0, 5).map(([service, cost]) => (
                  <div key={service} className="flex justify-between text-sm">
                    <span className="text-gray-300 truncate mr-2">{service}</span>
                    <span className="text-white font-mono">${cost}</span>
                  </div>
                ))}
              </div>
            )
          ) : (
            <p className="text-gray-500 text-sm">Connect AWS to see cost data</p>
          )}
        </div>

        {/* Budget Status */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-sm text-gray-400 mb-3">
            {viewMode === 'business' ? 'Potential Savings' : 'Budget Status'}
          </h3>
          {costOverview?.budgets && costOverview.budgets.length > 0 ? (
            <div className="space-y-3">
              {costOverview.budgets.map((b, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">{b.name}</span>
                    <span className={b.overrun_risk ? 'text-red-400' : 'text-green-400'}>
                      {b.utilization_percent}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${b.overrun_risk ? 'bg-red-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(b.utilization_percent, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">--</div>
              <p className="text-xs text-gray-500 mt-1">Run a scan to see savings</p>
            </div>
          )}
        </div>
      </div>

      {/* Scan Controls */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Run Analysis</h2>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm text-gray-300 mb-2">AWS Region</label>
            <select
              value={selectedRegion}
              onChange={e => setSelectedRegion(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Regions</option>
              {regions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <button
            onClick={runAnalysis}
            disabled={loading || !selectedRegion}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-white px-8 py-2.5 rounded font-medium"
          >
            {loading ? 'Scanning...' : '⚡ Analyze'}
          </button>
        </div>

        {/* Live Progress */}
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

      {/* What CloudPulse analyzes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-3">Data Sources</h2>
          <div className="space-y-2 text-sm text-gray-400">
            <div className="flex items-center gap-2"><span className="text-blue-400">●</span> AWS CloudWatch (CPU, Memory, Network)</div>
            <div className="flex items-center gap-2"><span className="text-green-400">●</span> AWS Cost Explorer</div>
            <div className="flex items-center gap-2"><span className="text-yellow-400">●</span> AWS Compute Optimizer</div>
            <div className="flex items-center gap-2"><span className="text-purple-400">●</span> AWS Trusted Advisor</div>
            <div className="flex items-center gap-2"><span className="text-pink-400">●</span> AWS Budgets</div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-3">AI Analysis Includes</h2>
          <div className="space-y-2 text-sm text-gray-400">
            <div className="flex items-center gap-2"><span className="text-green-400">↓</span> Scale Down Opportunities</div>
            <div className="flex items-center gap-2"><span className="text-red-400">↑</span> Scale Up Recommendations</div>
            <div className="flex items-center gap-2"><span className="text-yellow-400">📊</span> Predictive Cost Forecasting</div>
            <div className="flex items-center gap-2"><span className="text-blue-400">🎯</span> Efficiency Score & Gamification</div>
            <div className="flex items-center gap-2"><span className="text-purple-400">⚡</span> One-Click Optimization Simulator</div>
          </div>
        </div>
      </div>
    </div>
  )
}
