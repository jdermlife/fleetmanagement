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

  const renderFilscoreCertificate = (product: ProductCredit) => (
    <div
      style={{
        backgroundColor: '#fffaf0',
        border: '6px solid #1e3a8a',
        borderRadius: '12px',
        padding: '40px',
        marginBottom: 24,
        textAlign: 'center',
        pageBreakInside: 'avoid',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: '12px', letterSpacing: '2px', color: '#d97706', fontWeight: '600' }}>
          CERTIFICATION OF CREDIT READINESS ASSESSMENT
        </div>
        <div style={{ fontSize: '36px', fontWeight: '900', color: '#1e3a8a', margin: '12px 0' }}>
          FILSCORE
        </div>
      </div>

      {/* Reference and Product */}
      <div style={{ fontSize: '12px', color: '#666', marginBottom: 20, borderBottom: '1px solid #e5e7eb', paddingBottom: 16 }}>
        <div>REFERENCE NO. {product.applicationNo}</div>
        <div style={{ marginTop: 4 }}>PRODUCT BEING APPLIED FOR: {product.productType.toUpperCase()}</div>
      </div>

      {/* Applicant Name */}
      <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e3a8a', margin: '24px 0' }}>
        {product.borrowerName}
      </div>

      {/* Certification Statement */}
      <div style={{ fontSize: '12px', color: '#666', marginBottom: 24, fontStyle: 'italic' }}>
        This certifies that the above application completed the FILSCORE assessment workflow and the summarized results below were generated for credit evaluation and certification use.
      </div>

      {/* Main Score Boxes - 3 column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: 24 }}>
        {/* Composite Score */}
        <div
          style={{
            backgroundColor: '#fef3c7',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '11px', color: '#92400e', fontWeight: '600', marginBottom: 8 }}>COMPOSITE SCORE</div>
          <div style={{ fontSize: '42px', fontWeight: 'bold', color: '#0f766e' }}>
            {product.compositeScore || 'N/A'}
          </div>
        </div>

        {/* Label (Grade) */}
        <div
          style={{
            backgroundColor: '#fef3c7',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '11px', color: '#92400e', fontWeight: '600', marginBottom: 8 }}>LABEL</div>
          <div style={{ fontSize: '42px', fontWeight: 'bold', color: '#0f766e' }}>
            {product.finalGrade || 'N/A'}
          </div>
        </div>

        {/* Decision/Rating */}
        <div
          style={{
            backgroundColor: '#fef3c7',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '11px', color: '#92400e', fontWeight: '600', marginBottom: 8 }}>DECISION</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f766e' }}>
            {product.finalRating ? product.finalRating.toUpperCase() : 'N/A'}
          </div>
        </div>
      </div>

      {/* Individual Scores - 2x2 grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: 24 }}>
        {/* Credit Score */}
        <div
          style={{
            backgroundColor: '#dbeafe',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: '11px', color: '#0c4a6e', fontWeight: '600', marginBottom: 8 }}>
            CREDIT SCORE - {product.productType.toUpperCase()}
          </div>
          {product.creditScore.grade && (
            <div style={{ fontSize: '13px', color: '#0c4a6e', fontWeight: '600', marginBottom: 4 }}>
              {product.creditScore.grade}
            </div>
          )}
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0f766e' }}>
            {product.creditScore.score || 'N/A'}
          </div>
        </div>

        {/* Non-Starter Score (Fraud) */}
        <div
          style={{
            backgroundColor: '#dbeafe',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: '11px', color: '#0c4a6e', fontWeight: '600', marginBottom: 8 }}>
            NON-STARTER SCORE
          </div>
          {product.fraudScore.grade && (
            <div style={{ fontSize: '13px', color: '#0c4a6e', fontWeight: '600', marginBottom: 4 }}>
              {product.fraudScore.grade}
            </div>
          )}
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0f766e' }}>
            {product.fraudScore.score || 'N/A'}
          </div>
        </div>

        {/* Social Score */}
        <div
          style={{
            backgroundColor: '#dbeafe',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: '11px', color: '#0c4a6e', fontWeight: '600', marginBottom: 8 }}>SOCIAL SCORE</div>
          {product.socialScore.grade && (
            <div style={{ fontSize: '13px', color: '#0c4a6e', fontWeight: '600', marginBottom: 4 }}>
              {product.socialScore.grade}
            </div>
          )}
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0f766e' }}>
            {product.socialScore.score || 'N/A'}
          </div>
        </div>

        {/* Credit Values Score */}
        <div
          style={{
            backgroundColor: '#dbeafe',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: '11px', color: '#0c4a6e', fontWeight: '600', marginBottom: 8 }}>CREDIT VALUES SCORE</div>
          {product.psychometricScore.grade && (
            <div style={{ fontSize: '13px', color: '#0c4a6e', fontWeight: '600', marginBottom: 4 }}>
              {product.psychometricScore.grade}
            </div>
          )}
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0f766e' }}>
            {product.psychometricScore.score || 'N/A'}
          </div>
        </div>
      </div>

      {/* Certificate Details Footer */}
      <div style={{ fontSize: '11px', color: '#666', textAlign: 'left', borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
        <div>Certificate ID: {product.applicationNo}</div>
        <div>Issued: {product.issuedAt ? new Date(product.issuedAt).toLocaleString() : 'N/A'}</div>
        <div>Valid Until: {product.issuedAt ? new Date(new Date(product.issuedAt).getTime() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString() : 'N/A'}</div>
        <div style={{ marginTop: 8 }}>
          <strong>Information Provided: 95%</strong>
        </div>
        <div style={{ fontSize: '10px', marginTop: 4, fontStyle: 'italic', color: '#999' }}>
          AI-assisted recommendations may contain mistakes.
        </div>
      </div>
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
            <div>
              <h2 style={{ marginBottom: 8 }}>{selectedApplicant.name}</h2>
              <p className="intro" style={{ marginBottom: 24 }}>
                FILSCORE Certification and Credit Scores for {selectedApplicant.products.length} Product(s)
              </p>

              {selectedApplicant.products.map((product, index) => (
                <div key={index}>
                  {renderFilscoreCertificate(product)}
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
