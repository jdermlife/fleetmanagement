type SubscriptionAccessDeniedCardProps = {
  onGoToAccount: () => void
}

export default function SubscriptionAccessDeniedCard({ onGoToAccount }: SubscriptionAccessDeniedCardProps) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">Billing Access Required</p>
      <p className="mt-3 text-sm text-amber-950">
        Your account can sign in, but it is not allowed to access subscription billing records.
      </p>
      <p className="mt-2 text-sm text-amber-900">
        Ask an administrator to grant billing access, then refresh this page.
      </p>
      <div className="mt-4 flex justify-center">
        <button type="button" onClick={onGoToAccount}>
          Go to Account
        </button>
      </div>
    </div>
  )
}