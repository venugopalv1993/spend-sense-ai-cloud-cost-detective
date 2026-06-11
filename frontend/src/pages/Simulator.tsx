import { useState, useEffect } from 'react'

interface SimulatorProps {
  token: string
}

interface SimulationResult {
  simulations: Array<{
    resource: string
    resource_id: string
    current_monthly_cost: string
    projected_monthly_cost: string
    monthly_savings: string
    action: string
  }>
  total_current_cost: string
  total_projected_cost: string
  total_monthly_savings: string
  total_annual_savings: string
  performance_impact: string
  risk_level: string
}

interface HistoryAnalysis {
  id: number
  region: string
  resources_scanned: number
  analysis_result?: {
    issues: Array<{
      resource_name: string
      resource_id: string
      resource_type: string
      issue: string
      estimated_savings: string
    }>
    scale_down: Array<{
      resource_name: string
      resource_id: string
      current_type: string
      recommended_type: string
      reason: string
      monthly_savings: string
    }>
  }
}

export default function Simulator({ token }: SimulatorProps) {
  const [analysis, setAnalysis] = useState<HistoryAnalysis | null>(null)
  const [selectedActions, setSelectedActions] = useState<string[]>([])
  const [simResult, setSimResult] = useState<SimulationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingAnalysis, setLoadingAnalysis] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // Load the latest analysis
    fetch('/api/history', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(async data => {
        if (data.analyses?.length > 0) {
          const res = await fetch(`/api/history/${data.analyses[0].id}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          const detail = await res.json()
          setAnalysis(detail)
        }
      })
      .catch(() => setError('Failed to load analysis data'))
      .finally(() => setLoadingAnalysis(false))
  }, [token])

  const allActions = [
    ...(analysis?.analysis_result?.scale_down || []).map(sd => ({
      id: sd.resource_id,
      label: `${sd.resource_name}: Scale ${sd.current_type} → ${sd.recommended_type}`,
      savings: sd.monthly_savings,
      type: 'scale_down',
    })),
  ]

  const toggleAction = (id: string) => {
    setSelectedActions(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    )
  }

  const selectAll = () => {
    setSelectedActions(allActions.map(a => a.id))
  }

  const runSimulation = async () => {
    if (selectedActions.length === 0) return
    setLoading(true)
    setError('')

    const resources = [...(analysis?.analysis_result?.scale_down || [])]
    const actions = allActions.filter(a => selectedActions.includes(a.id))

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ resources, actions }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Simulation failed')
      const sanitized = {
        ...data,
        simulations: (data.simulations || []).filter((sim: any) => {
          const action = String(sim?.action || '').toLowerCase()
          return !action.includes('stop') && !action.includes('terminate')
        })
      }
      setSimResult(sanitized)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loadingAnalysis) {
    return <div className="text-center py-12 text-gray-400">Loading optimization data...</div>
  }

  if (!analysis?.analysis_result) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Optimization Simulator</h1>
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400 mb-4">Run a cost analysis first to see optimization opportunities.</p>
          <a href="/" className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white inline-block">
            Go to Dashboard
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Optimization Simulator</h1>
        <p className="text-gray-400">Preview savings from downscale actions before making changes</p>
      </div>

      {error && <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-2 rounded mb-4">{error}</div>}

      {/* Action Selection */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Select Downscale Recommendations</h2>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Select All
            </button>
            <button
              onClick={() => setSelectedActions([])}
              className="text-sm text-gray-400 hover:text-gray-300"
            >
              Clear
            </button>
          </div>
        </div>

        {allActions.length === 0 ? (
          <p className="text-gray-500 text-sm">No downscale options available in the latest analysis.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {allActions.map((action) => (
              <label
                key={action.id}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedActions.includes(action.id)
                    ? 'bg-blue-900/30 border border-blue-500'
                    : 'bg-gray-700/50 border border-gray-600 hover:border-gray-500'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedActions.includes(action.id)}
                  onChange={() => toggleAction(action.id)}
                  className="w-4 h-4 rounded"
                />
                <div className="flex-1">
                  <span className="text-sm text-gray-200">{action.label}</span>
                </div>
                <span className="text-green-400 text-sm font-medium">{action.savings}</span>
              </label>
            ))}
          </div>
        )}

        <button
          onClick={runSimulation}
          disabled={loading || selectedActions.length === 0}
          className="mt-4 w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 text-white py-3 rounded-lg font-medium"
        >
          {loading ? 'Simulating...' : `⚡ Simulate ${selectedActions.length} Downscale Option${selectedActions.length !== 1 ? 's' : ''}`}
        </button>
      </div>

      {/* Simulation Results */}
      {simResult && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <div className="text-sm text-gray-400">Current Cost</div>
              <div className="text-xl font-bold text-white">{simResult.total_current_cost}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <div className="text-sm text-gray-400">Projected Cost</div>
              <div className="text-xl font-bold text-blue-400">{simResult.total_projected_cost}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <div className="text-sm text-gray-400">Monthly Savings</div>
              <div className="text-xl font-bold text-green-400">{simResult.total_monthly_savings}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <div className="text-sm text-gray-400">Annual Savings</div>
              <div className="text-xl font-bold text-emerald-400">{simResult.total_annual_savings}</div>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-300">Resource</th>
                  <th className="text-right px-4 py-3 text-gray-300">Current Cost</th>
                  <th className="text-right px-4 py-3 text-gray-300">New Cost</th>
                  <th className="text-right px-4 py-3 text-gray-300">Savings</th>
                  <th className="text-left px-4 py-3 text-gray-300">Action</th>
                </tr>
              </thead>
              <tbody>
                {simResult.simulations.map((sim, i) => (
                  <tr key={i} className="border-t border-gray-700">
                    <td className="px-4 py-3 text-white">{sim.resource}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{sim.current_monthly_cost}</td>
                    <td className="px-4 py-3 text-right text-blue-400">{sim.projected_monthly_cost}</td>
                    <td className="px-4 py-3 text-right text-green-400 font-medium">{sim.monthly_savings}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{sim.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Risk Assessment */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-4 mb-3">
              <h3 className="font-semibold">Risk Assessment</h3>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                simResult.risk_level === 'low' ? 'bg-green-900/50 text-green-400' :
                simResult.risk_level === 'medium' ? 'bg-yellow-900/50 text-yellow-400' :
                'bg-red-900/50 text-red-400'
              }`}>
                {simResult.risk_level?.toUpperCase()} RISK
              </span>
            </div>
            <p className="text-gray-400 text-sm">{simResult.performance_impact}</p>
          </div>
        </div>
      )}
    </div>
  )
}
