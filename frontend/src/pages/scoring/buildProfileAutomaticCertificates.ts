export type AutomaticCertificate = 'credit' | 'wealth'

export const CREDIT_ASSESSMENT_SHOWN_KEY = 'creditReadinessAssessmentShown'
export const WEALTH_CERTIFICATE_SHOWN_KEY = 'wealthAssessmentCertificateShown'

export function selectAutomaticCertificate(
  stepCompletion: Record<number, number>,
  values: Record<string, string>,
): AutomaticCertificate | null {
  const stepsComplete = (lastStep: number) => Array.from(
    { length: lastStep },
    (_, index) => stepCompletion[index + 1] === 100,
  ).every(Boolean)

  if (stepsComplete(12) && values[WEALTH_CERTIFICATE_SHOWN_KEY] !== 'true') return 'wealth'
  if (stepsComplete(7) && values[CREDIT_ASSESSMENT_SHOWN_KEY] !== 'true') return 'credit'
  return null
}
