import { useState, useEffect } from 'react'

interface ProgressTrackerProps {
  analysisId: string
  onComplete: () => void
}

export default function ProgressTracker({ analysisId, onComplete }: ProgressTrackerProps) {
  const [messages, setMessages] = useState<string[]>([])
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/ws/progress/${analysisId}`)

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'progress') {
        setProgress(data.percent || 0)
        setMessages(prev => [...prev, data.message])
      }
      if (data.type === 'complete') {
        setProgress(100)
        onComplete()
      }
    }

    ws.onerror = () => {
      setMessages(prev => [...prev, 'Connection error'])
    }

    return () => ws.close()
  }, [analysisId, onComplete])

  return (
    <div className="bg-gray-800 rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">Analyzing...</span>
        <span className="text-sm text-blue-400">{progress}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
        {messages.map((msg, i) => (
          <p key={i} className="text-xs text-gray-400">• {msg}</p>
        ))}
      </div>
    </div>
  )
}
