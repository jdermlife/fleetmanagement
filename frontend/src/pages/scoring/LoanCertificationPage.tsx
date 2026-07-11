import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { fetchLoanApplication, type LoanApplicationRecord } from '../../api/loan'
import { getErrorMessage } from '../../api'
import { APP_NAME, brandLogoDataUri } from '../../brand'
import { calculateInformationProvidedPercent } from './applicationCompleteness'
import { calculateCompositeInternalScore, getFilscoreBand, toFilscore } from './filscoreScale'

type CertificationSnapshot = {
  applicationNo: string
  borrowerName: string
  productType: string
  issuedAt: string
  informationProvidedPercent: number
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
    borrowerName: record.borrower_name?.trim() || 'Unnamed Applicant / Borrower',
    productType: normalizeProductType(record.product_type),
    issuedAt: new Date().toISOString(),
    informationProvidedPercent: calculateInformationProvidedPercent(record),
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

const formatInformationProvided = (value: number) =>
  `${Math.max(0, Math.min(100, Math.round(value)))}%`

const buildRecommendationStatement = (certification: CertificationSnapshot) =>
  `Recommendation: ${certification.decision} based on a composite score of ${formatScore(certification.overallScore)}, calculated from the Credit Score (${formatScore(certification.creditScore)} at 60%), Credit Values Score (${formatScore(certification.creditValueScore)} at 15%), Social Score (${formatScore(certification.socialScore)} at 15%), and Non-Starter Score (${formatScore(certification.fraudScore)} at 10%).`

const getCertificationMetadata = (applicationNo: string, issuedAt: string) => {
  const issuedDate = new Date(issuedAt)

  if (Number.isNaN(issuedDate.getTime())) {
    return {
      certificateId: `${applicationNo.replace(/[+/]/g, '')}Pending`,
      issuedLabel: 'Pending',
      validUntilLabel: 'Pending',
    }
  }

  const pad = (value: number) => String(value).padStart(2, '0')
  const certificateId = [
    applicationNo.replace(/[+/]/g, ''),
    issuedDate.getFullYear(),
    pad(issuedDate.getMonth() + 1),
    pad(issuedDate.getDate()),
    pad(issuedDate.getHours()),
    pad(issuedDate.getMinutes()),
  ].join('')

  const validUntil = new Date(issuedDate)
  const issueDay = validUntil.getDate()
  validUntil.setDate(1)
  validUntil.setMonth(validUntil.getMonth() + 6)
  const finalDayOfValidMonth = new Date(
    validUntil.getFullYear(),
    validUntil.getMonth() + 1,
    0,
  ).getDate()
  validUntil.setDate(Math.min(issueDay, finalDayOfValidMonth))

  return {
    certificateId,
    issuedLabel: issuedDate.toLocaleString(),
    validUntilLabel: validUntil.toLocaleString(),
  }
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
  const [isToolbarHidden, setIsToolbarHidden] = useState(false)
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const TOP_ANCHOR_PX = 64
    const HIDE_DELTA_PX = 16
    const SHOW_DELTA_PX = -10
    let lastY = window.scrollY

    const handleScroll = () => {
      const currentY = window.scrollY
      const delta = currentY - lastY

      if (currentY <= TOP_ANCHOR_PX) {
        setIsToolbarHidden(false)
        lastY = currentY
        return
      }

      if (delta >= HIDE_DELTA_PX) {
        setIsToolbarHidden(true)
      } else if (delta <= SHOW_DELTA_PX) {
        setIsToolbarHidden(false)
      }

      lastY = currentY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const qrImageUrl = useMemo(
    () => (certification ? buildQrImageUrl(certification.qrValue) : ''),
    [certification],
  )

  const handleDownload = () => {
    if (!certification) {
      return
    }

    const { certificateId, issuedLabel, validUntilLabel } = getCertificationMetadata(
      certification.applicationNo,
      certification.issuedAt,
    )
    const informationProvided = formatInformationProvided(
      certification.informationProvidedPercent,
    )
    const recommendationStatement = buildRecommendationStatement(certification)

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${APP_NAME} ${certification.applicationNo}</title>
  <style>
    @page {
      size: A5 portrait;
      margin: 7mm;
    }
    body {
      margin: 0;
      padding: 6px;
      background: #ffffff;
      color: #0f2547;
      font-family: Arial, sans-serif;
    }
    .sheet {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
      background: #ffffff;
      border: 6px solid #0038a8;
      border-radius: 8px;
      box-shadow: 0 8px 18px rgba(15, 37, 71, 0.08);
      position: relative;
      overflow: hidden;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sheet::before {
      content: "";
      position: absolute;
      inset: 6px;
      border: 2px solid #f4d36a;
      border-radius: 4px;
      pointer-events: none;
    }
    .content {
      padding: 12px 14px 14px;
      position: relative;
      z-index: 1;
    }
    .brand-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .brand-mark {
      width: 36px;
      height: 36px;
      object-fit: contain;
    }
    .kicker {
      text-align: center;
      color: #0f766e;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      font-size: 7px;
    }
    h1 {
      margin: 3px 0 2px;
      text-align: center;
      color: #0038a8;
      font-size: 16px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    h2 {
      margin: 0;
      text-align: center;
      color: #7a5a00;
      font-size: 7px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .name {
      margin-top: 8px;
      text-align: center;
      font-size: 13px;
      font-weight: 700;
      color: #0f2547;
    }
    .subcopy {
      margin: 4px auto 0;
      max-width: 420px;
      text-align: center;
      line-height: 1.4;
      font-size: 7px;
      color: #4c5f78;
    }
    .summary {
      margin-top: 8px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
    }
    .summary-card {
      min-height: 60px;
      border: 1px solid rgba(163, 184, 200, 0.52);
      border-radius: 12px;
      padding: 7px 8px;
      background:
        radial-gradient(circle at bottom right, rgba(15, 118, 110, 0.1), transparent 34%),
        radial-gradient(circle at top right, rgba(250, 204, 21, 0.2), transparent 40%),
        linear-gradient(135deg, #fffdf3 0%, #fff7d3 48%, #eef8f7 100%);
      text-align: left;
      display: grid;
      align-content: space-between;
    }
    .summary-label {
      font-size: 6px;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      color: #0f766e;
      font-weight: 700;
    }
    .summary-value {
      margin-top: 6px;
      font-size: 15px;
      font-weight: 700;
      line-height: 1;
      color: #0d3ea3;
      overflow-wrap: anywhere;
    }
    .metrics {
      margin-top: 6px;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
    }
    .metric {
      min-height: 64px;
      border-radius: 12px;
      border: 1px solid rgba(163, 184, 200, 0.52);
      background:
        radial-gradient(circle at bottom right, rgba(15, 118, 110, 0.1), transparent 34%),
        radial-gradient(circle at top right, rgba(250, 204, 21, 0.2), transparent 40%),
        linear-gradient(135deg, #fffdf3 0%, #fff7d3 48%, #eef8f7 100%);
      padding: 7px 8px;
      display: grid;
      align-content: space-between;
    }
    .metric-label {
      font-size: 6px;
      color: #0f766e;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      font-weight: 700;
    }
    .metric-band {
      margin-top: 2px;
      color: #0d3ea3;
      font-size: 6px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 700;
    }
    .metric-value {
      margin-top: 4px;
      color: #0f2547;
      font-size: 13px;
      line-height: 1;
      font-weight: 700;
    }
    .recommendation {
      margin-top: 6px;
      padding: 7px 8px;
      border: 1px solid rgba(163, 184, 200, 0.52);
      border-radius: 8px;
      background: #f8fafc;
      color: #0f2547;
      font-size: 7px;
      line-height: 1.4;
    }
    .footer {
      margin-top: 8px;
      display: flex;
      justify-content: space-between;
      gap: 6px;
      align-items: flex-end;
    }
    .meta {
      display: grid;
      gap: 2px;
      padding-bottom: 2px;
    }
    .meta-line {
      font-size: 7px;
      color: #4c5f78;
      line-height: 1.3;
    }
    .meta-line strong {
      color: #0f2547;
    }
    .qr {
      display: grid;
      justify-items: center;
      gap: 2px;
      min-width: 86px;
      text-align: center;
    }
    .qr img {
      width: 68px;
      height: 68px;
      border-radius: 6px;
      border: 3px solid #ffffff;
      box-shadow: 0 6px 14px rgba(15, 37, 71, 0.08);
      background: #ffffff;
    }
    .qr p {
      margin: 2px 0 0;
      color: #546275;
      font-size: 6px;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-weight: 700;
    }
    .information-provided {
      margin-top: 6px;
      padding-top: 5px;
      border-top: 1px solid rgba(163, 184, 200, 0.52);
      color: #0f2547;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-align: center;
      text-transform: uppercase;
    }
    .ai-disclaimer {
      margin: 4px 0 0;
      color: #6b7280;
      font-size: 6px;
      line-height: 1.3;
      text-align: center;
    }
    @media print {
      body {
        padding: 0;
        background: #ffffff;
      }
      .sheet {
        max-width: none;
        width: 100%;
        box-shadow: none;
      }
      .brand-mark {
        width: 32px;
        height: 32px;
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
        <h1>${APP_NAME}</h1>
      </div>
      <h2>Reference No. ${certification.applicationNo}</h2>
      <h2>Product Being Applied For: ${certification.productType || 'Not Specified'}</h2>
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
      <div class="recommendation">${recommendationStatement}</div>
      <div class="footer">
        <div class="meta">
          <div class="meta-line"><strong>Certificate ID:</strong> ${certificateId}</div>
          <div class="meta-line"><strong>Issued:</strong> ${issuedLabel}</div>
          <div class="meta-line"><strong>Valid Until:</strong> ${validUntilLabel}</div>
          <div class="meta-line"><strong>Reference Number:</strong> ${certification.applicationNo}</div>
          <div class="meta-line"><strong>Product Being Applied For:</strong> ${certification.productType || 'Not Specified'}</div>
          <div class="meta-line"><strong>Applicant / Borrower Name:</strong> ${certification.borrowerName}</div>
          <div class="meta-line"><strong>Verification Link:</strong> Open certification</div>
        </div>
        <div class="qr">
          <img src="${buildQrImageUrl(certification.qrValue)}" alt="Certification QR Code" />
          <p>Verification QR</p>
        </div>
      </div>
      <div class="information-provided">Information Provided: ${informationProvided}</div>
      <p class="ai-disclaimer">AI-assisted recommendations may contain mistakes.</p>
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

  const { certificateId, issuedLabel, validUntilLabel } = getCertificationMetadata(
    certification.applicationNo,
    certification.issuedAt,
  )
  const informationProvided = formatInformationProvided(
    certification.informationProvidedPercent,
  )
  const recommendationStatement = buildRecommendationStatement(certification)

  return (
    <div className="loan-certification-page">
      <div className={`loan-certification-toolbar${isToolbarHidden ? ' loan-certification-toolbar-hidden' : ''}`}>
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
                <h1 className="loan-certification-title">{APP_NAME}</h1>
              </div>
            </div>
            <p className="loan-certification-reference">
              Reference No. <strong>{certification.applicationNo}</strong>
            </p>
            <p className="loan-certification-reference">
              Product Being Applied For: <strong>{certification.productType || 'Not Specified'}</strong>
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
                  label: 'Credit Values Score',
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

            <div className="loan-certification-recommendation">
              {recommendationStatement}
            </div>

            <div className="loan-certification-footer">
              <div className="loan-certification-meta">
                <p><strong>Certificate ID:</strong> {certificateId}</p>
                <p><strong>Issued:</strong> {issuedLabel}</p>
                <p><strong>Valid Until:</strong> {validUntilLabel}</p>
                <p><strong>Applicant / Borrower:</strong> {certification.borrowerName}</p>
                <p><strong>Reference Number:</strong> {certification.applicationNo}</p>
                <p><strong>Product Being Applied For:</strong> {certification.productType || 'Not Specified'}</p>
                <p><strong>Verification Link:</strong> <Link to={`/loan-certification?applicationNo=${encodeURIComponent(certification.applicationNo)}`}>Open certification</Link></p>
              </div>

              <div className="loan-certification-qr">
                <img src={qrImageUrl} alt="Certification QR Code" />
                <span>Verification QR</span>
              </div>
            </div>
            <div className="loan-certification-information-provided">
              Information Provided: <strong>{informationProvided}</strong>
            </div>
            <p className="loan-certification-ai-disclaimer">
              AI-assisted recommendations may contain mistakes.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
