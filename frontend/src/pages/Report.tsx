import { useLocation, useParams, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'

interface ReportProps {
  token: string
}

interface Issue {
  resource_name: string
  resource_id: string
  resource_type: string
  issue: string
  severity: string
  estimated_savings: string
  fix_command: string
}

interface ScaleDown {
  resource_name: string
  resource_id: string
  current_type: string
  recommended_type: string
  reason: string
  monthly_savings: string
}

interface ScaleUp {
  resource_name: string
  resource_id: string
  current_type: string
  recommended_type: string
  reason: string
  performance_impact: string
}

interface Predictions {
  next_month_estimate?: string
  budget_risk?: string
  growth_trend?: string
  capacity_warning?: string
}

interface AnalysisResult {
  analysis_id: string
  db_id?: number
  region: string
  resources_scanned: number
  resources: any[]
  analysis: {
    summary: string
    issues: Issue[]
    scale_down: ScaleDown[]
    scale_up: ScaleUp[]
    predictions: Predictions
    top_actions: string[]
    total_estimated_savings: string
    efficiency_score: number
  }
}

function CopyableCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative bg-gray-900 rounded px-3 py-2 font-mono text-xs text-gray-400 overflow-x-auto group">
      <code>$ {command}</code>
      <button
        onClick={copy}
        className="absolute top-1 right-1 bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  )
}

export default function Report({ token }: ReportProps) {
  const { id } = useParams()
  const location = useLocation()
  const [report, setReport] = useState<AnalysisResult | null>(location.state?.report || null)
  const [loading, setLoading] = useState(!report)

  useEffect(() => {
    if (!report && id) {
      fetch(`/api/history/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.analysis_result) {
            setReport({
              analysis_id: String(data.id),
              region: data.region,
              resources_scanned: data.resources_scanned,
              resources: [],
              analysis: data.analysis_result
            })
          } else {
            setReport(data)
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [id, report, token])

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Loading report...</div>
  }

  if (!report) {
    return <div className="text-center py-12 text-red-400">Report not found</div>
  }

  const severityColor = (s: string) => {
    switch (s) {
      case 'high': return 'text-red-400 bg-red-900/30 border-red-500'
      case 'medium': return 'text-yellow-400 bg-yellow-900/30 border-yellow-500'
      case 'low': return 'text-green-400 bg-green-900/30 border-green-500'
      default: return 'text-gray-400 bg-gray-900/30 border-gray-500'
    }
  }

  const severityBorder = (s: string) => {
    switch (s) {
      case 'high': return 'border-l-red-500'
      case 'medium': return 'border-l-yellow-500'
      case 'low': return 'border-l-green-500'
      default: return 'border-l-gray-500'
    }
  }

  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Analysis Report</h1>
        <div className="flex gap-3">
          <Link to="/simulator" className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white text-sm">
            ⚡ Simulate Savings
          </Link>
          <Link to="/" className="text-blue-400 hover:underline py-2">← Dashboard</Link>
        </div>
      </div>

      {/* Summary card with efficiency score */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{report.region}</div>
            <div className="text-sm text-gray-400">Region</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{report.resources_scanned}</div>
            <div className="text-sm text-gray-400">Resources Scanned</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">{report.analysis.total_estimated_savings}</div>
            <div className="text-sm text-gray-400">Potential Savings</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${scoreColor(report.analysis.efficiency_score || 0)}`}>
              {report.analysis.efficiency_score || '--'}/100
            </div>
            <div className="text-sm text-gray-400">Efficiency Score</div>
          </div>
        </div>
        <p className="text-gray-300">{report.analysis.summary}</p>
      </div>

      {/* Top Actions */}
      {report.analysis.top_actions && report.analysis.top_actions.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">Top Actions</h2>
          <div className="space-y-2">
            {report.analysis.top_actions.map((action, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-green-400">✓</span>
                <span className="text-gray-300">{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Predictive Analysis */}
      {report.analysis.predictions && Object.keys(report.analysis.predictions).length > 0 && (
        <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">📊 Predictive Analysis</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {report.analysis.predictions.next_month_estimate && (
              <div>
                <div className="text-sm text-gray-400">Next Month Estimate</div>
                <div className="text-lg font-bold text-white">{report.analysis.predictions.next_month_estimate}</div>
              </div>
            )}
            {report.analysis.predictions.budget_risk && (
              <div>
                <div className="text-sm text-gray-400">Budget Risk</div>
                <div className={`text-lg font-bold ${
                  report.analysis.predictions.budget_risk === 'high' ? 'text-red-400' :
                  report.analysis.predictions.budget_risk === 'medium' ? 'text-yellow-400' : 'text-green-400'
                }`}>{report.analysis.predictions.budget_risk.toUpperCase()}</div>
              </div>
            )}
            {report.analysis.predictions.growth_trend && (
              <div>
                <div className="text-sm text-gray-400">Growth Trend</div>
                <div className="text-lg font-bold text-yellow-400">{report.analysis.predictions.growth_trend}</div>
              </div>
            )}
            {report.analysis.predictions.capacity_warning && (
              <div className="col-span-2 md:col-span-4">
                <div className="text-sm text-gray-400">Capacity Warning</div>
                <div className="text-sm text-orange-400 mt-1">{report.analysis.predictions.capacity_warning}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scale Down Opportunities */}
      {report.analysis.scale_down && report.analysis.scale_down.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="text-green-400">↓</span> Scale Down Opportunities ({report.analysis.scale_down.length})
          </h2>
          <div className="space-y-3">
            {report.analysis.scale_down.map((sd, i) => (
              <div key={i} className="bg-gray-800 rounded-lg p-4 border-l-4 border-l-green-500">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-white">{sd.resource_name}</h3>
                  <span className="text-green-400 font-medium">{sd.monthly_savings}/mo</span>
                </div>
                <p className="text-gray-500 text-xs font-mono mb-1">{sd.resource_id}</p>
                <div className="flex items-center gap-2 text-sm mb-1">
                  <span className="text-red-400 line-through">{sd.current_type}</span>
                  <span className="text-gray-500">→</span>
                  <span className="text-green-400 font-medium">{sd.recommended_type}</span>
                </div>
                <p className="text-gray-400 text-sm">{sd.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scale Up Recommendations */}
      {report.analysis.scale_up && report.analysis.scale_up.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="text-red-400">↑</span> Scale Up Recommendations ({report.analysis.scale_up.length})
          </h2>
          <div className="space-y-3">
            {report.analysis.scale_up.map((su, i) => (
              <div key={i} className="bg-gray-800 rounded-lg p-4 border-l-4 border-l-orange-500">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-white">{su.resource_name}</h3>
                  <span className="text-orange-400 text-sm">Performance Risk</span>
                </div>
                <p className="text-gray-500 text-xs font-mono mb-1">{su.resource_id}</p>
                <div className="flex items-center gap-2 text-sm mb-1">
                  <span className="text-yellow-400">{su.current_type}</span>
                  <span className="text-gray-500">→</span>
                  <span className="text-blue-400 font-medium">{su.recommended_type}</span>
                </div>
                <p className="text-gray-400 text-sm">{su.reason}</p>
                <p className="text-blue-400 text-sm mt-1">Impact: {su.performance_impact}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Issues */}
      <h2 className="text-xl font-semibold mb-4">
        Issues Found ({report.analysis.issues.length})
      </h2>
      {report.analysis.issues.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-6 text-center text-gray-400">
          🎉 No cost issues found! Your resources look optimized.
        </div>
      ) : (
        <div className="space-y-4">
          {report.analysis.issues.map((issue, i) => (
            <div key={i} className={`bg-gray-800 rounded-lg p-4 border-l-4 ${severityBorder(issue.severity)}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${severityColor(issue.severity)}`}>
                    {issue.severity.toUpperCase()}
                  </span>
                  <span className="text-sm text-gray-400">{issue.resource_type}</span>
                </div>
                <span className="text-green-400 font-medium">{issue.estimated_savings}</span>
              </div>
              <h3 className="font-medium text-white">{issue.resource_name}</h3>
              <p className="text-gray-500 text-xs font-mono mb-1">{issue.resource_id}</p>
              <p className="text-gray-300 text-sm mb-3">{issue.issue}</p>
              {issue.fix_command && (
                <CopyableCommand command={issue.fix_command} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
