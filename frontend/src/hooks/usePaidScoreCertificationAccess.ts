import { useEffect, useState } from 'react'

import { getMySubscription } from '../api'

export const PAID_SCORE_CERTIFICATION_MESSAGE = 'Score available for paid users only.'

export function usePaidScoreCertificationAccess(isAdmin: boolean) {
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
  }, [isAdmin])

  return { hasPaidScoreAccess, isScoreAccessLoading }
}
