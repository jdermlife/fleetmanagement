import { Capacitor } from '@capacitor/core'
import { useEffect, useState } from 'react'

import {
  getMyStoreEntitlements,
  getMySubscription,
  type StoreEntitlementCategory,
} from '../api'

export const PAID_SCORE_CERTIFICATION_MESSAGE = 'Score available for paid users only.'

export function usePaidScoreCertificationAccess(
  isAdmin: boolean,
  category: StoreEntitlementCategory = 'SCORES',
) {
  const [hasPaidScoreAccess, setHasPaidScoreAccess] = useState(isAdmin)
  const [isScoreAccessLoading, setIsScoreAccessLoading] = useState(!isAdmin)

  useEffect(() => {
    let disposed = false

    if (isAdmin) {
      setHasPaidScoreAccess(true)
      setIsScoreAccessLoading(false)
      return () => {
        disposed = true
      }
    }

    setHasPaidScoreAccess(false)
    setIsScoreAccessLoading(true)

    const loadSubscription = async () => {
      try {
        if (Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios') {
          const entitlements = await getMyStoreEntitlements()
          const categoryKey = category.toLowerCase() as Lowercase<StoreEntitlementCategory>
          if (!disposed) setHasPaidScoreAccess(entitlements[categoryKey])
          return
        }
        const subscription = await getMySubscription()
        const type = subscription?.subscription_type?.toUpperCase()
        const status = subscription?.status?.toUpperCase()
        if (!disposed) {
          setHasPaidScoreAccess(
            status === 'ACTIVE' && (type === 'PAID' || type === 'LIFETIME'),
          )
        }
      } catch {
        if (!disposed) {
          setHasPaidScoreAccess(false)
        }
      } finally {
        if (!disposed) {
          setIsScoreAccessLoading(false)
        }
      }
    }

    void loadSubscription()

    return () => {
      disposed = true
    }
  }, [category, isAdmin])

  return { hasPaidScoreAccess, isScoreAccessLoading }
}
