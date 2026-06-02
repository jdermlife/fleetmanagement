import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import axios from 'axios'



export default function AIDashboard() {
const [stats, setStats] = useState({
  total_meetings: 0,
  minutes_generated: 0,
  emails_sent: 0,
  pdf_exports: 0,
})

useEffect(() => {
  loadStats()
}, [])

const loadStats = async () => {
  try {
    const response = await axios.get(
      `${import.meta.env.VITE_API_URL}/ai/dashboard/stats`
    )

    setStats(response.data)
  } catch (error) {
    console.error(error)
  }
}



return (
<div style={{ padding: '24px' }}> <h1>🤖 AI Operations Center</h1>


  <p>
    Fleet Management AI Assistant Dashboard
  </p>

  {/* STATISTICS */}
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: '16px',
      marginTop: '20px',
    }}
  >
    <div className="stat-card">
      <h3>🎤 Meetings</h3>
      <h1>{stats.total_meetings}</h1>
    </div>

    <div className="stat-card">
      <h3>📋 Action Items</h3>
      <h1>{stats.minutes_generated}</h1>
    </div>

    <div className="stat-card">
      <h3>⚠ Risk Alerts</h3>
      <h1>{stats.pdf_exports}</h1>
    </div>

    <div className="stat-card">
      <h3>🛡 Compliance</h3>
      <h1>100%</h1>
    </div>
  </div>

  {/* AI CARDS */}
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))',
      gap: '20px',
      marginTop: '24px',
    }}
  >
    <Link to="/meeting-history" className="ai-card">
      📋 Meeting History
    </Link>

    <Link to="/attend-meeting" className="ai-card">
      🎤 Attend Meeting
    </Link>

    <Link to="/chat-assistant" className="ai-card">
      💬 Chat Assistant
    </Link>

    <Link to="/voice-reports" className="ai-card">
      🎙 Voice Reports
    </Link>

    <Link to="/ocr-scanner" className="ai-card">
      📄 OCR Scanner
    </Link>

    <Link to="/pdf-summarizer" className="ai-card">
      📚 PDF Summarizer
    </Link>

    <Link to="/risk-analysis" className="ai-card">
      ⚠ Risk Analysis
    </Link>

    <Link to="/compliance-ai" className="ai-card">
      🛡 Compliance AI
    </Link>
  </div>
</div>


)
}
