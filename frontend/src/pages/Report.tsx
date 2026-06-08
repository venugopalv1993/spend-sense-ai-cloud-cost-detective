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

interface AnalysisResult {
  analysis_id: string
  db_id?: number
  region: string
  resources_scanned: number
  resources: any[]
  analysis: {
    summary: string
    issues: Issue[]
    total_estimated_savings: string
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
          // Reshape DB response to match analysis response format
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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Analysis Report</h1>
        <Link to="/" className="text-blue-400 hover:underline">← Back to Dashboard</Link>
      </div>

      {/* Summary card */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="grid grid-cols-3 gap-4 mb-4">
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
        </div>
        <p className="text-gray-300">{report.analysis.summary}</p>
      </div>

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
