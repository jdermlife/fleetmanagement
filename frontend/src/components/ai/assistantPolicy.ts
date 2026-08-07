export const AI_DISCLAIMER = 'AI may commit mistakes.'
export const PROPRIETARY_REFUSAL = 'Algorithms are proprietary and cannot be disclosed.'

const PROTECTED_QUESTION_PATTERNS = [
  /\b(?:algorithm|algorithms|formula|formulas|equation|equations)\b/i,
  /\b(?:weight|weights|weighted|weighting|coefficient|coefficients)\b/i,
  /\b(?:threshold|thresholds|cutoff|cutoffs|cut[ -]off|cut[ -]offs)\b/i,
  /\b(?:underlying|hidden|internal|proprietary)\s+(?:criteria|criterion|logic|rules?|model|method)\b/i,
  /\b(?:scoring|score|decision|risk|financial)\s+(?:criteria|criterion|logic|rules?|model|method|parameters?)\b/i,
  /\b(?:source\s+code|system\s+prompt|developer\s+prompt|hidden\s+prompt)\b/i,
  /\b(?:calculate|compute|derive|reverse\s+engineer|reconstruct|replicate|reproduce)\b.{0,50}\b(?:score|rating|decision|model)\b/i,
  /\bhow\b.{0,35}\b(?:score|rating|decision)\b.{0,35}\b(?:calculated|computed|derived|works?)\b/i,
]

export function isProtectedAssistantQuestion(value: string): boolean {
  return PROTECTED_QUESTION_PATTERNS.some((pattern) => pattern.test(value))
}
