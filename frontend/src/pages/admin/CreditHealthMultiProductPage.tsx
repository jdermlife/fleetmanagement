import { useEffect, useState } from 'react'
import { fetchCurrentUser, getErrorMessage } from '../../api'
import { fetchLoanApplications, type LoanApplicationRecord } from '../../api/loan'
import { toFilscore, getFilscoreBand } from '../scoring/filscoreScale'

interface CreditScore {
  score: number | null
  label: string
  grade?: string
}

interface ProductCredit {
  productType: string
  applicationNo: string
  borrowerName: string
  rawProductType: string
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
  mainProduct: ProductCredit
  products: ProductCredit[]
}

const SUPPLEMENTAL_PRODUCT_TYPES = ['Personal Loan', 'Credit Card', 'Home Loan'] as const

const normalizeProductType = (value?: string): string =>
  (value || '').trim().toLowerCase().replace(/[-_]/g, ' ')

const formatProductType = (value?: string): string => {
  const normalized = normalizeProductType(value)
  if (normalized === 'personal loan') return 'Personal Loan'
  if (normalized === 'credit card') return 'Credit Card'
  if (normalized === 'home loan') return 'Home Loan'
  return value?.trim() || 'Unknown Product'
}

const getIssuedTimestamp = (product: ProductCredit): number => {
  if (!product.issuedAt) return 0
  const parsed = Date.parse(product.issuedAt)
  return Number.isNaN(parsed) ? 0 : parsed
}

export default function CreditHealthMultiProductPage() {
  const [selectedApplicant, setSelectedApplicant] = useState<ApplicantRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const loadApplicantRecords = async () => {
      setLoading(true)
      setMessage('')
      try {
        // Get current user
        await fetchCurrentUser()

        const latestApplications = await fetchLoanApplications({
          limit: 1,
          offset: 0,
          summary: false,
        })

        const latestApplication = latestApplications[0]
        if (!latestApplication) {
          setSelectedApplicant(null)
          setMessage('No loan applications found.')
          return
        }

        const applicantRecord = toApplicantRecord(latestApplication, [latestApplication])
        setSelectedApplicant(applicantRecord)
      } catch (error) {
        setMessage(getErrorMessage(error, 'Failed to load applicant records.'))
      } finally {
        setLoading(false)
      }
    }

    void loadApplicantRecords()
  }, [])

  const toApplicantRecord = (
    latestApplication: LoanApplicationRecord,
    borrowerApplications: LoanApplicationRecord[],
  ): ApplicantRecord => {
    const borrowerName = latestApplication.borrower_name || 'Unknown Applicant'

    const toProductCredit = (app: LoanApplicationRecord): ProductCredit => {
      const borrowerNameForProduct = app.borrower_name || 'Unknown Applicant'
      const normalizedProductType = formatProductType(app.product_type)

      // Convert raw scores to FILSCORE for the certificate panel.
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

      return {
        productType: normalizedProductType,
        rawProductType: app.product_type || '',
        applicationNo: app.application_no,
        borrowerName: borrowerNameForProduct,
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
    }

    const allBorrowerProducts = borrowerApplications.map(toProductCredit)
    const latestByProductType = new Map<string, ProductCredit>()
    allBorrowerProducts.forEach((product) => {
      const key = normalizeProductType(product.productType)
      const existing = latestByProductType.get(key)
      if (!existing || getIssuedTimestamp(product) >= getIssuedTimestamp(existing)) {
        latestByProductType.set(key, product)
      }
    })

    const mainProduct = toProductCredit(latestApplication)
    latestByProductType.set(normalizeProductType(mainProduct.productType), mainProduct)

    const products = Array.from(latestByProductType.values())
      .sort((a, b) => getIssuedTimestamp(b) - getIssuedTimestamp(a))

    return {
      id: latestApplication.application_no,
      name: borrowerName,
      mainProduct,
      products,
    }
  }

  const renderFilscoreCertificate = (product: ProductCredit, allProducts: ProductCredit[]) => {
    const mainProductType = normalizeProductType(product.productType)
    const supplementalProducts = SUPPLEMENTAL_PRODUCT_TYPES
      .map((productType) => {
        const match = allProducts.find(
          (p) => normalizeProductType(p.productType) === normalizeProductType(productType),
        )
        return {
          productType,
          score: match?.compositeScore ?? match?.creditScore.score ?? null,
        }
      })
      .filter((item) => normalizeProductType(item.productType) !== mainProductType)

    return (
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

        <div
          style={{
            backgroundColor: '#dbeafe',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: '11px', color: '#0c4a6e', fontWeight: '600', marginBottom: 8 }}>
            AML CLASSIFICATION SCORE
          </div>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#0f766e' }}>
            DB Not Available
          </div>
        </div>
      </div>

      {/* Other Product Scores */}
      {supplementalProducts.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: '11px', color: '#92400e', fontWeight: '700', marginBottom: 10, letterSpacing: '0.06em' }}>
            OTHER PRODUCT SCORES
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
            {supplementalProducts.map((item) => (
              <div
                key={item.productType}
                style={{
                  backgroundColor: '#fef3c7',
                  borderRadius: '8px',
                  padding: '14px 10px',
                  textAlign: 'center',
                  border: '1px solid #fde68a',
                }}
              >
                <div style={{ fontSize: '11px', color: '#92400e', fontWeight: '700', marginBottom: 6 }}>
                  {item.productType.toUpperCase()}
                </div>
                <div style={{ fontSize: '30px', color: '#0f766e', fontWeight: 'bold', lineHeight: 1 }}>
                  {item.score ?? 'N/A'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
  }

  return (
    <div className="standalone-card">
      <h1>Credit Health Multi Product</h1>
      <p className="intro">
        View FILSCORE Certification and Credit Scores for the latest applicant record.
      </p>

      {message ? <p className="status-message">{message}</p> : null}

      {loading ? (
        <div className="card">
          <p>Loading latest applicant record...</p>
        </div>
      ) : (
        <>
          {selectedApplicant && (
            <div>
              <h2 style={{ marginBottom: 8 }}>{selectedApplicant.name}</h2>
              <p className="intro" style={{ marginBottom: 24 }}>
                FILSCORE Certification and Credit Scores for the latest record
              </p>

              {renderFilscoreCertificate(selectedApplicant.mainProduct, selectedApplicant.products)}
            </div>
          )}

          {!selectedApplicant && (
            <div className="card">
              <p style={{ textAlign: 'center', color: '#666' }}>
                No applicant records available.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
