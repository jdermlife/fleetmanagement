import { useState } from 'react'
import type { FormEvent } from 'react'

import { api } from '../api'


function CreditScoring() {
  const [income, setIncome] = useState('')
  const [debt, setDebt] = useState('')
  const [score, setScore] = useState<number | null>(null)
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    try {
      const response = await api.post<{ score: number }>('/credit-score', {
        income: Number(income),
        debt: Number(debt),
      })
      setScore(response.data.score)
    } catch {
      setError('Credit score could not be calculated. Check the backend and input values.')
    }
  }

  return (
    <div>
      <h2>Credit Scoring Application</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Annual Income
            <input
              type="number"
              value={income}
              onChange={(event) => setIncome(event.target.value)}
              required
            />
          </label>
        </div>
        <div>
          <label>
            Total Debt
            <input
              type="number"
              value={debt}
              onChange={(event) => setDebt(event.target.value)}
              required
            />
          </label>
        </div>
        <button type="submit">Calculate Credit Score</button>
      </form>
      {error ? <p className="status-message status-error">{error}</p> : null}
      {score !== null ? <p className="status-message status-success">Your Credit Score: {score}</p> : null}
    </div>
  )
}

export default CreditScoring
