export const CREDIT_POLICY_THRESHOLDS = {
  decision: {
    approveMin: 80,
    reviewMin: 65,
  },
  aiProbability: {
    lowRiskMin: 80,
    mediumRiskMin: 50,
    recommendationReviewMinExclusive: 60,
    workflowApproveMin: 70,
  },
  workflow: {
    creditReviewRejectRiskScoreMax: 60,
  },
  dsr: {
    strongMax: 35,
    acceptableMax: 50,
  },
  ltv: {
    safeMax: 80,
    elevatedMin: 90,
    riskyMin: 95,
  },
} as const;

export function isApproveBand(score: number): boolean {
  return score >= CREDIT_POLICY_THRESHOLDS.decision.approveMin;
}

export function isLowRiskProbability(probability: number): boolean {
  return probability >= CREDIT_POLICY_THRESHOLDS.aiProbability.lowRiskMin;
}

export function isMediumRiskProbability(probability: number): boolean {
  return (
    probability >= CREDIT_POLICY_THRESHOLDS.aiProbability.mediumRiskMin &&
    probability < CREDIT_POLICY_THRESHOLDS.aiProbability.lowRiskMin
  );
}

export function isReviewRecommendationProbability(probability: number): boolean {
  return probability > CREDIT_POLICY_THRESHOLDS.aiProbability.recommendationReviewMinExclusive;
}

export function isWorkflowAutoApproveProbability(probability: number): boolean {
  return probability >= CREDIT_POLICY_THRESHOLDS.aiProbability.workflowApproveMin;
}

export function isWorkflowAutoRejectProbability(probability: number): boolean {
  return probability < CREDIT_POLICY_THRESHOLDS.aiProbability.mediumRiskMin;
}

export function isReviewBand(score: number): boolean {
  return (
    score >= CREDIT_POLICY_THRESHOLDS.decision.reviewMin &&
    score < CREDIT_POLICY_THRESHOLDS.decision.approveMin
  );
}

export function isDeclineBand(score: number): boolean {
  return score < CREDIT_POLICY_THRESHOLDS.decision.reviewMin;
}

export function isStrongDsr(dsrPercent: number): boolean {
  return dsrPercent < CREDIT_POLICY_THRESHOLDS.dsr.strongMax;
}

export function isAcceptableDsr(dsrPercent: number): boolean {
  return dsrPercent < CREDIT_POLICY_THRESHOLDS.dsr.acceptableMax;
}

export function isSafeLtv(ltvPercent: number): boolean {
  return ltvPercent < CREDIT_POLICY_THRESHOLDS.ltv.safeMax;
}

export function isElevatedLtv(ltvPercent: number): boolean {
  return ltvPercent >= CREDIT_POLICY_THRESHOLDS.ltv.elevatedMin;
}

export function isRiskyLtv(ltvPercent: number): boolean {
  return ltvPercent >= CREDIT_POLICY_THRESHOLDS.ltv.riskyMin;
}
