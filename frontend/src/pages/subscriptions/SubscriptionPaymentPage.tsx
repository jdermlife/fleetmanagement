import { Capacitor } from '@capacitor/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import {
  cancelPublicTrialPayment,
  cancelRecurringSubscription,
  cancelSubscriptionPayment,
  capturePayPalOrder,
  capturePublicTrialPayPalOrder,
  createPublicTrialPayMongoCheckout,
  createPublicTrialPayPalOrder,
  createPayMongoCheckout,
  createPayMongoSubscription,
  createPayPalOrder,
  createPayPalSubscription,
  createFreeSubscription,
  createSubscription,
  fetchCurrentUser,
  getMySubscription,
  getAuthToken,
  getErrorMessage,
  listPublicSubscriptionPlans,
  type SubscriptionPlan,
  type SubscriptionRecord,
} from '../../api'
import {
  loadNativeStoreProducts,
  manageNativeSubscriptions,
  purchaseNativeSubscription,
  restoreNativeSubscriptions,
  type NativeStoreProduct,
} from '../../nativeBilling'
import { loadPayPalSdk, type PayPalButtonsInstance } from '../../paypalSdk'
import payMongoLogo from '../../assets/paymongo-official.png'

function PayMongoButtonContent({ label }: { label: string }) {
  return (
    <>
      <img className="trial-expired-paymongo-logo" src={payMongoLogo} alt="" aria-hidden="true" />
      <span>{label}</span>
    </>
  )
}


      {!isLoading && !selectedSubscription && !selectedPlan ? (
        <section className="stack-panel auth-panel">
          <p className="status-message">
            No subscription selected. Please choose or create a subscription from your account page first.
          </p>
          <div className="form-actions">
            <button type="button" className="auth-link-button" onClick={() => navigate('/account')}>
              Go to Account
            </button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
