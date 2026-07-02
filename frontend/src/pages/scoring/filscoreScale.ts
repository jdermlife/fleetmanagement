const FILSCORE_MIN = 200
const FILSCORE_RANGE = 700

export type FilscoreBand = {
  grade: string
  internalGrade: string
}

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

  if (filscore >= 860) return { grade: 'Platinum 1', internalGrade: 'Exceptional' }
  if (filscore >= 820) return { grade: 'Platinum 2', internalGrade: 'Excellent' }
  if (filscore >= 780) return { grade: 'Gold 1', internalGrade: 'Very Strong' }
  if (filscore >= 740) return { grade: 'Gold 2', internalGrade: 'Strong' }
  if (filscore >= 680) return { grade: 'Silver 1', internalGrade: 'Good' }
  if (filscore >= 620) return { grade: 'Silver 2', internalGrade: 'Acceptable' }
  if (filscore >= 540) return { grade: 'Bronze 1', internalGrade: 'Moderate Risk' }
  if (filscore >= 460) return { grade: 'Bronze 2', internalGrade: 'High Risk' }
  if (filscore >= 330) return { grade: 'Red 1', internalGrade: 'Very High Risk' }
  return { grade: 'Red 2', internalGrade: 'Critical Risk' }
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
