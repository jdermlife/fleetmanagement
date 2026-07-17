import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

import {
  getErrorMessage,
  listSubscriptionInvoices,
  listSubscriptionPayments,
  listSubscriptions,
  type SubscriptionInvoice,
  type SubscriptionPayment,
  type SubscriptionRecord,
} from '../../api'

export default function BillingPage() {
  const navigate = useNavigate()
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([])
  const [payments, setPayments] = useState<SubscriptionPayment[]>([])
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasBillingAccessDenied, setHasBillingAccessDenied] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const loadData = async () => {
      try {
        const [subscriptionRows, paymentRows, invoiceRows] = await Promise.all([
          listSubscriptions(),
          listSubscriptionPayments(),
          listSubscriptionInvoices(),
        ])
        setSubscriptions(subscriptionRows)
        setPayments(paymentRows)
        setInvoices(invoiceRows)
        setHasBillingAccessDenied(false)
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 403) {
          setHasBillingAccessDenied(true)
          setMessage('You do not have access to billing records. Contact your administrator to request billing permissions.')
          return
        }

        setHasBillingAccessDenied(false)
        setMessage(getErrorMessage(error, 'Unable to load billing data right now.'))
      } finally {
        setIsLoading(false)
      }
    }

    void loadData()
  }, [])

  const currentPlan = useMemo(
    () => subscriptions.find((subscription) => subscription.status === 'ACTIVE') ?? subscriptions[0] ?? null,
    [subscriptions],
  )

  return (
    <div className="standalone-card auth-screen">
      <h1>Billing</h1>
      <p className="intro">Current plan, payment history, invoices, and receipt actions in one place.</p>

      {isLoading ? <p>Loading billing data...</p> : null}
      {message ? <p className="status-message status-error">{message}</p> : null}

      {!isLoading && hasBillingAccessDenied ? (
        <div className="card auth-helper-card">
          <h3>Billing Access Required</h3>
          <p className="status-message">
            Your account can sign in, but it is not allowed to access billing details and invoices.
          </p>
          <p className="status-message">
            Ask an administrator to grant billing access, then return to this page.
          </p>
          <div className="form-actions">
            <button type="button" onClick={() => navigate('/account')}>Go to Account</button>
          </div>
        </div>
      ) : null}

      {!hasBillingAccessDenied ? (
        <div className="card auth-helper-card" style={{ marginBottom: '16px' }}>
        <h3>Current Plan</h3>
        <p className="status-message">{currentPlan?.subscription_no ?? 'No active subscription found.'}</p>
        <div className="form-actions">
          <button type="button" onClick={() => navigate('/subscription/payment')}>Renew</button>
          <button type="button" onClick={() => navigate('/subscription/payment')}>Upgrade</button>
          <button type="button" onClick={() => setMessage('Receipt download links are available once invoice PDFs are generated.')}>Download Receipt</button>
        </div>
      </div>
      ) : null}

      {!hasBillingAccessDenied ? (
        <div className="card auth-helper-card" style={{ marginBottom: '16px' }}>
        <h3>Payment History</h3>
        {payments.length === 0 ? (
          <p className="status-message">No payment records yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Reference</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Amount</th>
                  <th className="px-3 py-2 text-left">Paid At</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-3 py-2">{payment.payment_reference}</td>
                    <td className="px-3 py-2">{payment.payment_status}</td>
                    <td className="px-3 py-2">{payment.amount ?? 0} {payment.currency ?? 'PHP'}</td>
                    <td className="px-3 py-2">{payment.paid_at ?? 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      ) : null}

      {!hasBillingAccessDenied ? (
        <div className="card auth-helper-card">
        <h3>Invoices</h3>
        {invoices.length === 0 ? (
          <p className="status-message">No invoices yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Invoice No</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Total</th>
                  <th className="px-3 py-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-3 py-2">{invoice.invoice_no}</td>
                    <td className="px-3 py-2">{invoice.status ?? 'N/A'}</td>
                    <td className="px-3 py-2">{invoice.total ?? 0}</td>
                    <td className="px-3 py-2">{invoice.invoice_date ?? 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      ) : null}
    </div>
  )
}
