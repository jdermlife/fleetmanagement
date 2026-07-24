import { useEffect, useState } from 'react'
import { fetchCurrentUser, getErrorMessage } from '../../api'
import { fetchLoanApplications, type LoanApplicationRecord } from '../../api/loan'
import { toFilscore, getFilscoreBand } from './filscoreScale'

interface CreditScore {
  score: number | null
  label: string
  grade?: string
}

interface ProductCredit {
  productType: string
  applicationNo: string
  borrowerName: string
  creditScore: CreditScore
  psychometricScore: CreditScore
  socialScore: CreditScore
  fraudScore: CreditScore
  finalGrade?: string
  finalRating?: string
  compositeScore?: number
  issuedAt?: string
}

interface ApplicantRecord {
  id: string
  name: string
  products: ProductCredit[]
}

export default function CreditHealthMultiProductPage() {
  const [records, setRecords] = useState<ApplicantRecord[]>([])
  const [selectedApplicant, setSelectedApplicant] = useState<ApplicantRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const loadApplicantRecords = async () => {
      setLoading(true)
      setMessage('')
      try {
        // Get current user to check if admin
        const currentUser = await fetchCurrentUser()
        const isAdmin = currentUser?.role?.toLowerCase() === 'admin'

        // Fetch loan applications
        let allApplications: LoanApplicationRecord[] = []
        try {
          const response = await fetch('/api/loan-applications?limit=1000&offset=0&summary=false')
          if (response.ok) {
            const data = await response.json()
            allApplications = data.records || []
          }
        } catch (error) {
          // Fallback if API call fails
          allApplications = await fetchLoanApplications()
        }

        // Group applications by borrower name and convert to applicant records
        const applicantMap = new Map<string, ProductCredit[]>()

        allApplications.forEach((app: LoanApplicationRecord) => {
          const borrowerName = app.borrower_name || 'Unknown Applicant'
          
          // Convert scores to FILSCORE scale
          const creditFilscore = app.overall_scores?.credit_score
            ? toFilscore(app.overall_scores.credit_score)
            : null
          const creditBand = creditFilscore ? getFilscoreBand(creditFilscore) : null
          
          const fraudFilscore = app.overall_scores?.fraud_score
            ? toFilscore(app.overall_scores.fraud_score)
            : null
          const fraudBand = fraudFilscore ? getFilscoreBand(fraudFilscore) : null
          
          const socialFilscore = app.overall_scores?.social_score
            ? toFilscore(app.overall_scores.social_score)
            : null
          const socialBand = socialFilscore ? getFilscoreBand(socialFilscore) : null
          
          const psychoFilscore = app.overall_scores?.psychometric_score
            ? toFilscore(app.overall_scores.psychometric_score)
            : null
          const psychoBand = psychoFilscore ? getFilscoreBand(psychoFilscore) : null

          const product: ProductCredit = {
            productType: app.product_type || 'Unknown Product',
            applicationNo: app.application_no,
            borrowerName,
            creditScore: {
              score: creditFilscore,
              label: 'Credit Score',
              grade: creditBand?.grade,
            },
            psychometricScore: {
              score: psychoFilscore,
              label: 'Credit Values Score',
              grade: psychoBand?.grade,
            },
            socialScore: {
              score: socialFilscore,
              label: 'Social Score',
              grade: socialBand?.grade,
            },
            fraudScore: {
              score: fraudFilscore,
              label: 'Non-Starter Score',
              grade: fraudBand?.grade,
            },
            finalGrade: app.overall_scores?.final_grade,
            finalRating: app.overall_scores?.final_rating,
            compositeScore: app.overall_scores?.composite_score,
            issuedAt: app.overall_scores?.created_at || app.created_at,
          }

          if (!applicantMap.has(borrowerName)) {
            applicantMap.set(borrowerName, [])
          }
          applicantMap.get(borrowerName)?.push(product)
        })

        // Convert map to applicant records
        const applicantRecords: ApplicantRecord[] = Array.from(applicantMap.entries()).map(
          ([name, products], index) => ({
            id: `app-${index}`,
            name,
            products,
          }),
        )

        // Auto-select first applicant if available
        if (applicantRecords.length > 0) {
          setSelectedApplicant(applicantRecords[0])
        }

        setRecords(applicantRecords)

        if (applicantRecords.length === 0) {
          setMessage('No loan applications found.')
        }
      } catch (error) {
        setMessage(getErrorMessage(error, 'Failed to load applicant records.'))
      } finally {
        setLoading(false)
      }
    }

    void loadApplicantRecords()
  }, [])

  const filteredRecords = records.filter((record) =>
    record.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const renderScoreCard = (score: CreditScore, icon: string) => (
    <div
      style={{
        padding: '12px',
        borderRadius: '8px',
        backgroundColor: '#f8f9fa',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '14px', color: '#666', marginBottom: '6px' }}>{score.label}</div>
      <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
        {score.score !== null ? score.score : 'N/A'}
      </div>
      {score.grade && <div style={{ fontSize: '12px', color: '#0f766e', fontWeight: '600' }}>{score.grade}</div>}
      <div style={{ fontSize: '24px', marginTop: '8px' }}>{icon}</div>
    </div>
  )

  return (
    <div className="standalone-card">
      <h1>Credit Health Multi Product</h1>
      <p className="intro">
        View FILSCORE Certification and all Credit Scores across all products for applicants and records.
      </p>

      {message ? <p className="status-message">{message}</p> : null}

      {loading ? (
        <div className="card">
          <p>Loading applicant records...</p>
        </div>
      ) : (
        <>
          {/* Search Section */}
          <div className="card" style={{ marginBottom: 16 }}>
            <label>
              Search Applicant
              <input
                type="text"
                placeholder="Enter applicant name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%' }}
              />
            </label>
          </div>

          {/* Applicant List */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px', marginBottom: 24 }}>
            {filteredRecords.map((record) => (
              <div
                key={record.id}
                onClick={() => setSelectedApplicant(record)}
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  border: `2px solid ${selectedApplicant?.id === record.id ? '#0f766e' : '#e2e8f0'}`,
                  backgroundColor: selectedApplicant?.id === record.id ? '#f0fdf4' : '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>{record.name}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {record.products.length} product{record.products.length !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
          </div>

          {/* Selected Applicant Details */}
          {selectedApplicant && (
            <div className="card">
              <h2>{selectedApplicant.name}</h2>
              <p className="intro">Credit Health Across {selectedApplicant.products.length} Product(s)</p>

              {selectedApplicant.products.map((product, index) => (
                <div key={index} style={{ marginBottom: 32, borderBottom: '1px solid #e2e8f0', paddingBottom: 24 }}>
                  {/* Product Header */}
                  <div style={{ marginBottom: 16 }}>
                    <h3 style={{ marginTop: 0 }}>{product.productType}</h3>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      <div>Application No: {product.applicationNo}</div>
                      {product.issuedAt && (
                        <div>Issued: {new Date(product.issuedAt).toLocaleDateString()}</div>
                      )}
                    </div>
                  </div>

                  {/* FILSCORE Certification Summary */}
                  {product.finalGrade && (
                    <div
                      style={{
                        padding: '16px',
                        borderRadius: '8px',
                        backgroundColor: '#0f766e',
                        color: 'white',
                        marginBottom: 16,
                      }}
                    >
                      <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '8px' }}>
                        FILSCORE CERTIFICATION
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <div style={{ fontSize: '12px', opacity: 0.8 }}>Grade</div>
                          <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                            {product.finalGrade}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', opacity: 0.8 }}>Rating</div>
                          <div style={{ fontSize: '16px' }}>{product.finalRating}</div>
                          {product.compositeScore && (
                            <div style={{ fontSize: '12px', marginTop: '4px' }}>
                              Composite: {product.compositeScore}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Credit Score Cards Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '12px',
                    }}
                  >
                    {renderScoreCard(product.creditScore, '💳')}
                    {renderScoreCard(product.psychometricScore, '🧠')}
                    {renderScoreCard(product.socialScore, '👥')}
                    {renderScoreCard(product.fraudScore, '🛡️')}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!selectedApplicant && filteredRecords.length === 0 && (
            <div className="card">
              <p style={{ textAlign: 'center', color: '#666' }}>
                {searchTerm ? 'No applicants found matching your search.' : 'No applicant records available.'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
