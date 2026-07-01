const FILSCORE_MIN = 200
const FILSCORE_RANGE = 700

export const toFilscore = (internalScore: number | null | undefined) => {
  if (typeof internalScore !== 'number' || !Number.isFinite(internalScore)) {
    return null
  }

  const clampedScore = Math.max(0, Math.min(100, internalScore))
  return Math.round(FILSCORE_MIN + (clampedScore / 100) * FILSCORE_RANGE)
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
