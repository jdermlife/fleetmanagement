import React from 'react'
import ReactDOM from 'react-dom/client'

import './index.css'
import CreditScoring from './pages/scoring/CreditScoring'
import FinancialHealthSummaryPage from './pages/scoring/FinancialHealthSummaryPage'

const page = new URLSearchParams(window.location.search).get('page')
const nativePreview = new URLSearchParams(window.location.search).get('native') === '1'

document.documentElement.classList.toggle('native-mobile-app', nativePreview)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <main className="content">
      {page === 'psychometric' ? <CreditScoring /> : <FinancialHealthSummaryPage />}
    </main>
  </React.StrictMode>,
)
