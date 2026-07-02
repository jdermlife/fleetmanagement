import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { fetchLoanApplication, type LoanApplicationRecord } from '../../api/loan'
import { getErrorMessage } from '../../api'
import { APP_NAME, brandLogoDataUri } from '../../brand'
import { calculateCompositeInternalScore, getFilscoreBand, toFilscore } from './filscoreScale'

type CertificationSnapshot = {
  applicationNo: string
  borrowerName: string
  productType: string
  issuedAt: string
  overallScore: number | null
  label: string
  decision: string
  creditScore: number | null
  fraudScore: number | null
  socialScore: number | null
  creditValueScore: number | null
  qrValue: string
}

type LocationState = {
  certificationData?: CertificationSnapshot
}

const normalizeProductType = (value?: string | null) => {
  if (typeof value !== 'string') {
    return ''
  }

  const trimmedValue = value.trim()
  return trimmedValue && trimmedValue.toLowerCase() !== 'undefined' ? trimmedValue : ''
}

const getCreditScoreLabel = (productType?: string | null) => {
  const normalizedProductType = normalizeProductType(productType)
  return normalizedProductType ? `Credit Score - ${normalizedProductType}` : 'Credit Score'
}

const buildVerificationUrl = (applicationNo: string) => {
  if (typeof window === 'undefined') {
    return applicationNo
  }

  return `${window.location.origin}/loan-certification?applicationNo=${encodeURIComponent(applicationNo)}`
}

const buildQrImageUrl = (value: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(value)}`

const buildCertificationSnapshot = (
  record: LoanApplicationRecord,
): CertificationSnapshot => {
  const finalGrade = record.overall_scores?.final_grade?.trim() || 'Pending'
  const finalDecision = record.overall_scores?.final_decision?.trim() || record.status || 'Pending'
  const applicationNo = record.application_no

  return {
    applicationNo,
    borrowerName: record.borrower_name?.trim() || 'Unnamed Borrower',
    productType: normalizeProductType(record.product_type),
    issuedAt: new Date().toISOString(),
    overallScore: calculateCompositeInternalScore({
      creditScore: record.overall_scores?.credit_score ?? null,
      creditValueScore: record.overall_scores?.psychometric_score ?? null,
      socialScore: record.overall_scores?.social_score ?? null,
      nonStarterScore: record.overall_scores?.fraud_score ?? null,
    }),
    label: finalGrade,
    decision: finalDecision,
    creditScore: record.overall_scores?.credit_score ?? null,
    fraudScore: record.overall_scores?.fraud_score ?? null,
    socialScore: record.overall_scores?.social_score ?? null,
    creditValueScore: record.overall_scores?.psychometric_score ?? null,
    qrValue: buildVerificationUrl(applicationNo),
  }
}

const formatScore = (value: number | null) => {
  const scaledScore = toFilscore(value)
  return typeof scaledScore === 'number' ? scaledScore.toFixed(0) : 'Pending'
}

const formatBand = (value: number | null) => {
  const scaledScore = toFilscore(value)
  const band = getFilscoreBand(scaledScore)
  return band ? `${band.grade} : ${band.internalGrade}` : 'FILSCORE : Grade : Internal Grade'
}

export default function LoanCertificationPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [certification, setCertification] = useState<CertificationSnapshot | null>(
    (location.state as LocationState | null)?.certificationData ?? null,
  )
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const applicationNo = searchParams.get('applicationNo')

  useEffect(() => {
    if (certification || !applicationNo) {
      return
    }

    const loadCertification = async () => {
      setIsLoading(true)
      setLoadError('')

      try {
        const record = await fetchLoanApplication(applicationNo)
        setCertification(buildCertificationSnapshot(record))
      } catch (error) {
        setLoadError(
          getErrorMessage(error, 'Unable to load certification details for this application.'),
        )
      } finally {
        setIsLoading(false)
      }
    }

    void loadCertification()
  }, [applicationNo, certification])

  const qrImageUrl = useMemo(
    () => (certification ? buildQrImageUrl(certification.qrValue) : ''),
    [certification],
  )

  const handleDownload = () => {
    if (!certification) {
      return
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Certification ${certification.applicationNo}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    body {
      margin: 0;
      padding: 18px;
      background: #f3f7ff;
      color: #0f2547;
      font-family: Arial, sans-serif;
    }
    .sheet {
      max-width: 860px;
      margin: 0 auto;
      background: #ffffff;
      border: 14px solid #0038a8;
      box-shadow: 0 18px 40px rgba(15, 37, 71, 0.15);
      position: relative;
      overflow: hidden;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sheet::before {
      content: "";
      position: absolute;
      inset: 14px;
      border: 3px solid #fcd116;
      pointer-events: none;
    }
    .sheet::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 16px;
      background: #0f766e;
    }
    .content {
      padding: 34px 36px 40px;
      position: relative;
      z-index: 1;
    }
    .brand-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    .brand-mark {
      width: 96px;
      height: 96px;
      object-fit: contain;
    }
    .kicker {
      text-align: center;
      color: #0f766e;
      font-weight: 700;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      font-size: 12px;
    }
    h1 {
      margin: 6px 0 4px;
      text-align: center;
      color: #0038a8;
      font-size: 28px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    h2 {
      margin: 0;
      text-align: center;
      color: #7a5a00;
      font-size: 18px;
      font-weight: 700;
    }
    .name {
      margin-top: 24px;
      text-align: center;
      font-size: 28px;
      font-weight: 700;
      color: #0f2547;
    }
    .subcopy {
      margin: 10px auto 0;
      max-width: 620px;
      text-align: center;
      line-height: 1.55;
      font-size: 14px;
      color: #4c5f78;
    }
    .summary {
      margin-top: 22px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }
    .summary-card {
      min-height: 102px;
      border: 1px solid rgba(163, 184, 200, 0.52);
      border-radius: 18px;
      padding: 18px 18px 16px;
      background:
        radial-gradient(circle at bottom right, rgba(15, 118, 110, 0.1), transparent 34%),
        radial-gradient(circle at top right, rgba(250, 204, 21, 0.2), transparent 40%),
        linear-gradient(135deg, #fffdf3 0%, #fff7d3 48%, #eef8f7 100%);
      text-align: left;
      display: grid;
      align-content: space-between;
    }
    .summary-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: #0f766e;
      font-weight: 700;
    }
    .summary-value {
      margin-top: 18px;
      font-size: 38px;
      font-weight: 700;
      line-height: 1;
      color: #0d3ea3;
      overflow-wrap: anywhere;
    }
    .metrics {
      margin-top: 16px;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
    .metric {
      min-height: 116px;
      border-radius: 18px;
      border: 1px solid rgba(163, 184, 200, 0.52);
      background:
        radial-gradient(circle at bottom right, rgba(15, 118, 110, 0.1), transparent 34%),
        radial-gradient(circle at top right, rgba(250, 204, 21, 0.2), transparent 40%),
        linear-gradient(135deg, #fffdf3 0%, #fff7d3 48%, #eef8f7 100%);
      padding: 18px;
      display: grid;
      align-content: space-between;
    }
    .metric-label {
      font-size: 12px;
      color: #0f766e;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-weight: 700;
    }
    .metric-band {
      margin-top: 8px;
      color: #0d3ea3;
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      font-weight: 700;
    }
    .metric-value {
      margin-top: 18px;
      color: #0f2547;
      font-size: 30px;
      line-height: 1;
      font-weight: 700;
    }
    .footer {
      margin-top: 18px;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
    }
    .meta {
      display: grid;
      gap: 8px;
    }
    .meta-line {
      font-size: 12px;
      color: #4c5f78;
    }
    .meta-line strong {
      color: #0f2547;
    }
    .qr {
      text-align: center;
    }
    .qr img {
      width: 118px;
      height: 118px;
      border-radius: 12px;
      border: 5px solid #ffffff;
      box-shadow: 0 10px 24px rgba(15, 37, 71, 0.12);
      background: #ffffff;
    }
    .qr p {
      margin: 8px 0 0;
      color: #546275;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-weight: 700;
    }
    @media print {
      body {
        padding: 0;
        background: #ffffff;
      }
      .sheet {
        max-width: none;
        box-shadow: none;
      }
      .brand-mark {
        width: 82px;
        height: 82px;
      }
    }
  </style>
</head>
<body>
  <section class="sheet">
    <div class="content">
      <div class="brand-header">
        <img class="brand-mark" src="${brandLogoDataUri}" alt="${APP_NAME} logo" />
        <div class="kicker">Certification of Lending Assessment</div>
        <h1>${APP_NAME} Certification</h1>
      </div>
      <h2>Reference ${certification.applicationNo}</h2>
      <div class="name">${certification.borrowerName}</div>
      <div class="subcopy">
        This certifies that the referenced application has completed the ${APP_NAME} assessment workflow
        and the following summarized score results were recorded for credit evaluation.
      </div>
      <div class="summary">
        <div class="summary-card">
          <div class="summary-label">Composite Score</div>
          <div class="summary-value">${formatScore(certification.overallScore)}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Label</div>
          <div class="summary-value">${certification.label}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Decision</div>
          <div class="summary-value">${certification.decision}</div>
        </div>
      </div>
      <div class="metrics">
        <div class="metric"><div class="metric-label">${getCreditScoreLabel(certification.productType)}</div><div class="metric-band">${formatBand(certification.creditScore)}</div><div class="metric-value">${formatScore(certification.creditScore)}</div></div>
        <div class="metric"><div class="metric-label">Non-Starter Score</div><div class="metric-band">${formatBand(certification.fraudScore)}</div><div class="metric-value">${formatScore(certification.fraudScore)}</div></div>
        <div class="metric"><div class="metric-label">Social Score</div><div class="metric-band">${formatBand(certification.socialScore)}</div><div class="metric-value">${formatScore(certification.socialScore)}</div></div>
        <div class="metric"><div class="metric-label">Credit Value Score</div><div class="metric-band">${formatBand(certification.creditValueScore)}</div><div class="metric-value">${formatScore(certification.creditValueScore)}</div></div>
      </div>
      <div class="footer">
        <div class="meta">
          <div class="meta-line"><strong>Issued:</strong> ${new Date(certification.issuedAt).toLocaleString()}</div>
          <div class="meta-line"><strong>Reference Number:</strong> ${certification.applicationNo}</div>
          <div class="meta-line"><strong>Borrower Name:</strong> ${certification.borrowerName}</div>
        </div>
        <div class="qr">
          <img src="${buildQrImageUrl(certification.qrValue)}" alt="Certification QR Code" />
          <p>Verification QR</p>
        </div>
      </div>
    </div>
  </section>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = `loan-certification-${certification.applicationNo}.html`
    link.click()
    window.URL.revokeObjectURL(downloadUrl)
  }

  if (isLoading) {
    return (
      <div className="loan-certification-page">
        <div className="loan-certification-shell">
          <p className="loan-certification-loading">Loading certification...</p>
        </div>
      </div>
    )
  }

  if (!certification) {
    return (
      <div className="loan-certification-page">
        <div className="loan-certification-shell">
          <h1 className="loan-certification-title">Certification Unavailable</h1>
          <p className="loan-certification-copy">
            {loadError || 'No certification data is available for this application yet.'}
          </p>
          <div className="loan-certification-actions">
            <button type="button" className="loan-certification-button loan-certification-button-primary" onClick={() => navigate('/lending-scorecard')}>
              Back to Lending Scorecard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="loan-certification-page">
      <div className="loan-certification-toolbar">
        <button
          type="button"
          className="loan-certification-button loan-certification-button-secondary"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
        <div className="loan-certification-toolbar-actions">
          <button
            type="button"
            className="loan-certification-button loan-certification-button-secondary"
            onClick={handleDownload}
          >
            Download HTML
          </button>
          <button
            type="button"
            className="loan-certification-button loan-certification-button-primary"
            onClick={() => window.print()}
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      <section className="loan-certification-shell">
        <div className="loan-certification-frame">
          <div className="loan-certification-inner">
            <div className="loan-certification-brand">
              <img
                className="loan-certification-brand-mark"
                src={brandLogoDataUri}
                alt={`${APP_NAME} logo`}
              />
              <div className="loan-certification-brand-copy">
                <p className="loan-certification-kicker">Certification of Lending Assessment</p>
                <h1 className="loan-certification-title">{APP_NAME} Certification</h1>
              </div>
            </div>
            <p className="loan-certification-reference">
              Reference No. <strong>{certification.applicationNo}</strong>
            </p>

            <div className="loan-certification-name">{certification.borrowerName}</div>

            <p className="loan-certification-copy">
              This certifies that the above application completed the {APP_NAME} assessment workflow and
              the summarized results below were generated for credit evaluation and certification use.
            </p>

            <div className="loan-certification-summary-grid">
              <div className="loan-certification-summary-card">
                <span className="loan-certification-summary-label">Composite Score</span>
                <strong className="loan-certification-summary-value">
                  {formatScore(certification.overallScore)}
                </strong>
              </div>
              <div className="loan-certification-summary-card">
                <span className="loan-certification-summary-label">Label</span>
                <strong className="loan-certification-summary-value">
                  {certification.label}
                </strong>
              </div>
              <div className="loan-certification-summary-card">
                <span className="loan-certification-summary-label">Decision</span>
                <strong className="loan-certification-summary-value">
                  {certification.decision}
                </strong>
              </div>
            </div>

            <div className="loan-certification-metrics-grid">
              {[
                {
                  label: getCreditScoreLabel(certification.productType),
                  value: formatScore(certification.creditScore),
                  band: formatBand(certification.creditScore),
                },
                {
                  label: 'Non-Starter Score',
                  value: formatScore(certification.fraudScore),
                  band: formatBand(certification.fraudScore),
                },
                {
                  label: 'Social Score',
                  value: formatScore(certification.socialScore),
                  band: formatBand(certification.socialScore),
                },
                {
                  label: 'Credit Value Score',
                  value: formatScore(certification.creditValueScore),
                  band: formatBand(certification.creditValueScore),
                },
              ].map((item) => (
                <div key={item.label} className="loan-certification-metric-card">
                  <span className="loan-certification-metric-label">{item.label}</span>
                  <span className="loan-certification-metric-band">{item.band}</span>
                  <strong className="loan-certification-metric-value">{item.value}</strong>
                </div>
              ))}
            </div>

            <div className="loan-certification-footer">
              <div className="loan-certification-meta">
                <p><strong>Issued:</strong> {new Date(certification.issuedAt).toLocaleString()}</p>
                <p><strong>Borrower:</strong> {certification.borrowerName}</p>
                <p><strong>Reference Number:</strong> {certification.applicationNo}</p>
                <p><strong>Verification Link:</strong> <Link to={`/loan-certification?applicationNo=${encodeURIComponent(certification.applicationNo)}`}>Open certification</Link></p>
              </div>

              <div className="loan-certification-qr">
                <img src={qrImageUrl} alt="Certification QR Code" />
                <span>Verification QR</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
