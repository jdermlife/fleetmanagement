import React from 'react'
import ReactDOM from 'react-dom/client'

import './index.css'
import CreditScoring from './pages/scoring/CreditScoring'
import FinancialHealthSummaryPage from './pages/scoring/FinancialHealthSummaryPage'

const page = new URLSearchParams(window.location.search).get('page')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <main className="content">
      {page === 'psychometric' ? <CreditScoring /> : <FinancialHealthSummaryPage />}
    </main>
  </React.StrictMode>,
)
