import { Link } from 'react-router-dom'

export default function AIDashboard() {
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
      <h1>1</h1>
    </div>

    <div className="stat-card">
      <h3>📋 Action Items</h3>
      <h1>1</h1>
    </div>

    <div className="stat-card">
      <h3>⚠ Risk Alerts</h3>
      <h1>0</h1>
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
