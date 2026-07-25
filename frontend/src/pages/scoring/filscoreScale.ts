const FILSCORE_MIN = 200
const FILSCORE_RANGE = 700

export type FilscoreBand = {
  grade: string
  internalGrade: string
}

export const FILSCORE_BANDS = [
  { minimum: 860, grade: 'Platinum 1', internalGrade: 'Exceptional' },
  { minimum: 820, grade: 'Platinum 2', internalGrade: 'Excellent' },
  { minimum: 780, grade: 'Gold 1', internalGrade: 'Very Strong' },
  { minimum: 740, grade: 'Gold 2', internalGrade: 'Strong' },
  { minimum: 680, grade: 'Silver 1', internalGrade: 'Good' },
  { minimum: 620, grade: 'Silver 2', internalGrade: 'Acceptable' },
  { minimum: 540, grade: 'Bronze 1', internalGrade: 'Moderate Risk' },
  { minimum: 460, grade: 'Bronze 2', internalGrade: 'High Risk' },
  { minimum: 330, grade: 'Red 1', internalGrade: 'Very High Risk' },
  { minimum: 200, grade: 'Red 2', internalGrade: 'Critical Risk' },
] as const

export const toFilscore = (internalScore: number | null | undefined) => {
  if (typeof internalScore !== 'number' || !Number.isFinite(internalScore)) {
    return null
  }

  const clampedScore = Math.max(0, Math.min(100, internalScore))
  return Math.round(FILSCORE_MIN + (clampedScore / 100) * FILSCORE_RANGE)
}

export const getFilscoreBand = (filscore: number | null | undefined): FilscoreBand | null => {
  if (typeof filscore !== 'number' || !Number.isFinite(filscore)) {
    return null
  }

  const band = FILSCORE_BANDS.find((candidate) => filscore >= candidate.minimum)
  return band
    ? { grade: band.grade, internalGrade: band.internalGrade }
    : { grade: 'Red 2', internalGrade: 'Critical Risk' }
}

type CompositeInputs = {
  creditScore: number | null | undefined
  creditValueScore: number | null | undefined
  socialScore: number | null | undefined
  nonStarterScore: number | null | undefined
}

const normalizeInternalScore = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : null

export const calculateCompositeInternalScore = ({
  creditScore,
  creditValueScore,
  socialScore,
  nonStarterScore,
}: CompositeInputs) => {
  const normalizedCredit = normalizeInternalScore(creditScore)
  const normalizedCreditValue = normalizeInternalScore(creditValueScore)
  const normalizedSocial = normalizeInternalScore(socialScore)
  const normalizedNonStarter = normalizeInternalScore(nonStarterScore)

  if (
    normalizedCredit === null ||
    normalizedCreditValue === null ||
    normalizedSocial === null ||
    normalizedNonStarter === null
  ) {
    return null
  }

  return (
    normalizedCredit * 0.6 +
    normalizedCreditValue * 0.15 +
    normalizedSocial * 0.15 +
    normalizedNonStarter * 0.1
  )
}
