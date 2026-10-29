import { describe, expect, it } from 'vitest'

import type { SubscriptionPlan } from '../src/api'
import {
  resolveNativeSubscriptionProductId,
  selectPaymentPlan,
} from '../src/pages/subscriptions/paymentPlanSelection'

function plan(overrides: Partial<SubscriptionPlan>): SubscriptionPlan {
  return {
    id: 0,
    plan_code: '',
    plan_name: '',
    description: null,
    billing_cycle: 'MONTHLY',
    monthly_price: null,
    yearly_price: null,
    minimum_monthly_fee: null,
    per_record_fee: null,
    currency: 'PHP',
    max_users: null,
    max_vehicles: null,
    max_drivers: null,
    max_storage_gb: null,
    trial_days: 0,
    display_order: 0,
    is_public: true,
    is_custom_pricing: false,
    max_ai_requests_per_month: 0,
    max_api_calls_per_month: 0,
    max_documents: 0,
    max_reports: 0,
    max_meetings: 0,
    max_storage_files: 0,
    storage_unit: 'GB',
    support_level: 'STANDARD',
    sla_hours: 0,
    color_code: null,
    icon_name: null,
    ai_enabled: false,
    api_enabled: false,
    reporting_enabled: false,
    is_active: true,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

const plans: SubscriptionPlan[] = [
  plan({
    id: 1,
    plan_code: 'FREE',
    plan_name: 'Free',
    monthly_price: 0,
    display_order: 1,
  }),
  plan({
    id: 2,
    plan_code: 'SINGLE_PROFILE',
    plan_name: 'Single Profile',
    monthly_price: 160,
    display_order: 2,
  }),
  plan({
    id: 3,
    plan_code: 'MULTIPLE_PROFILE',
    plan_name: 'Multiple Profile',
    monthly_price: 1600,
    display_order: 3,
  }),
]

describe('selectPaymentPlan', () => {
  it('replaces a legacy free-plan link with the paid single plan on iOS', () => {
    expect(selectPaymentPlan(plans, 1, null, true)?.plan_code).toBe('SINGLE_PROFILE')
  })

  it('selects the requested multiple-profile plan on iOS', () => {
    expect(selectPaymentPlan(plans, 0, 'multiple', true)?.plan_code).toBe('MULTIPLE_PROFILE')
  })

  it('does not rewrite a web free-plan selection', () => {
    expect(selectPaymentPlan(plans, 1, null, false)?.plan_code).toBe('FREE')
  })
})

describe('resolveNativeSubscriptionProductId', () => {
  const products = [
    {
      mapping: { product_id: 'FHFS003' },
      subscriptionPeriod: { unitString: 'year' },
    },
    {
      mapping: { product_id: 'FHFS001' },
      subscriptionPeriod: { unitString: 'month' },
    },
  ]

  it('defaults to the monthly Apple product', () => {
    expect(resolveNativeSubscriptionProductId(products, '')).toBe('FHFS001')
  })

  it('preserves an annual Apple product selected by the user', () => {
    expect(resolveNativeSubscriptionProductId(products, 'FHFS003')).toBe('FHFS003')
  })
})
