import type { SubscriptionPlan } from '../../api'

export function billingAmount(plan: SubscriptionPlan): number {
  const monthlyPrice = plan.monthly_price && plan.monthly_price > 0 ? plan.monthly_price : 0
  const yearlyPrice = plan.yearly_price && plan.yearly_price > 0 ? plan.yearly_price : 0
  const minimumFee = plan.minimum_monthly_fee && plan.minimum_monthly_fee > 0
    ? plan.minimum_monthly_fee
    : 0

  if (plan.billing_cycle === 'YEARLY') {
    return yearlyPrice || monthlyPrice * 12 || minimumFee
  }
  if (plan.billing_cycle === 'QUARTERLY') {
    return monthlyPrice * 3 || minimumFee
  }
  return monthlyPrice || minimumFee
}

export function selectPaymentPlan(
  plans: SubscriptionPlan[],
  selectedPlanId: number,
  selectedPlanName: string | null,
  usesNativeStore: boolean,
): SubscriptionPlan | null {
  const planById = plans.find((plan) => plan.id === selectedPlanId)
  if (planById && (!usesNativeStore || planById.plan_code !== 'FREE')) {
    return planById
  }

  if (usesNativeStore && selectedPlanName === 'multiple') {
    return plans.find((plan) => plan.plan_code === 'MULTIPLE_PROFILE') ?? null
  }

  if (usesNativeStore) {
    return plans.find((plan) => plan.plan_code === 'SINGLE_PROFILE' && billingAmount(plan) > 0) ?? null
  }

  return null
}
