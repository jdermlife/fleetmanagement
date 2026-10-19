import { useEffect, useMemo, useState } from 'react'

import {
  fetchAdminLoanProfileRepository,
  type AdminLoanProfileRecord,
} from '../../api/loan'
import AuthProgressOverlay from '../../components/auth/AuthProgressOverlay'
import { useAuthorization } from '../../hooks/useAuthorization'
import { CREDIT_VALUES_QUESTIONS, STEP_3_FIELDS } from '../scoring/buildProfileStep3'
import {
  SPOUSE_EMPLOYMENT_FIELDS,
  SPOUSE_FIELDS,
} from '../scoring/buildProfileStep4'
import { BANKING_RELATIONSHIP_FIELDS } from '../scoring/buildProfileStep5'
import { GOAL_SETTING_FIELDS } from '../scoring/buildProfileStep6'
import {
  ADDITIONAL_COLLATERAL_FIELDS,
  AUTO_LOAN_FIELDS,
  HOME_LOAN_FIELDS,
  MOTORCYCLE_LOAN_FIELDS,
} from '../scoring/buildProfileStep7'

type ProfileField = { key: string; label: string }
type ProfileData = Record<string, unknown> & { values?: Record<string, unknown> }

const PAGE_SIZE = 25

const STEP_1_FIELDS: ProfileField[] = [
  { key: 'fullName', label: 'Full Name' },
  { key: 'email', label: 'Email Address' },
  { key: 'mobileNumber', label: 'Mobile Number' },
  { key: 'dateOfBirth', label: 'Date of Birth' },
  { key: 'age', label: 'Age' },
  { key: 'governmentId', label: 'Government ID Number' },
  { key: 'placeOfBirth', label: 'Place of Birth' },
  { key: 'gender', label: 'Gender' },
  { key: 'dependents', label: 'Number of Dependents' },
  { key: 'citizenship', label: 'Citizenship' },
  { key: 'civilStatus', label: 'Civil Status' },
  { key: 'homePhoneNumber', label: 'Home Phone Number' },
  { key: 'tin', label: 'TIN Number' },
  { key: 'sssGsis', label: 'SSS / GSIS Number' },
  { key: 'otherGovernmentId', label: 'Other Government ID Type' },
  { key: 'otherGovernmentIdNumber', label: 'Other Government ID Number' },
  { key: 'idIssueDate', label: 'ID Issue Date' },
  { key: 'idExpiryDate', label: 'ID Expiry Date' },
  { key: 'address', label: 'Present Address' },
  { key: 'permanentAddress', label: 'Permanent Address' },
  { key: 'mailingAddress', label: 'Mailing Address' },
  { key: 'lengthOfStay', label: 'Length of Stay at Present Address' },
  { key: 'homeOwnership', label: 'Home Ownership' },
  { key: 'education', label: 'Educational Attainment' },
  { key: 'numberOfVehiclesOwned', label: 'Number of Vehicles Owned' },
]

const uniqueFields = (fields: ProfileField[]): ProfileField[] => {
  const seen = new Set<string>()
  return fields.filter((field) => field.key && !seen.has(field.key) && seen.add(field.key))
}

const STEP_GROUPS: Array<{ title: string; fields: ProfileField[] }> = [
  { title: 'Step 1 - Tell Us About Yourself', fields: STEP_1_FIELDS },
  { title: 'Step 2 - Spouse and Dependents', fields: SPOUSE_FIELDS },
  {
    title: 'Step 3 - Source of Income, Wealth, and Credit Values',
    fields: uniqueFields([
      ...STEP_3_FIELDS,
      ...CREDIT_VALUES_QUESTIONS.map((question) => ({
        key: `creditValues.${question.field}`,
        label: question.prompt,
      })),
    ]),
  },
  { title: 'Step 4 - Related Party Information', fields: SPOUSE_EMPLOYMENT_FIELDS },
  { title: 'Step 5 - Banking Relationships', fields: uniqueFields(BANKING_RELATIONSHIP_FIELDS) },
  { title: 'Step 6 - Goal Setting', fields: GOAL_SETTING_FIELDS },
  {
    title: 'Step 7 - Collateral Assets',
    fields: uniqueFields([
      ...HOME_LOAN_FIELDS,
      ...AUTO_LOAN_FIELDS,
      ...MOTORCYCLE_LOAN_FIELDS,
      ...ADDITIONAL_COLLATERAL_FIELDS,
    ]),
  },
]

const COLLECTIONS: Array<{ key: string; label: string; step: number }> = [
  { key: 'dependents', label: 'Dependents', step: 2 },
  { key: 'step3FinancialInvestments', label: 'Financial Investments', step: 3 },
  { key: 'coBorrowers', label: 'Co-Borrowers', step: 4 },
  { key: 'guarantors', label: 'Guarantors', step: 4 },
  { key: 'additionalCollaterals', label: 'Additional Collaterals', step: 7 },
  { key: 'realEstateCollaterals', label: 'Real Estate Collaterals', step: 7 },
  { key: 'financialInstrumentCollaterals', label: 'Financial Instrument Collaterals', step: 7 },
]

function formatDateTime(value?: string | null): string {
  if (!value) return 'Not available'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString()
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not provided'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.length ? value.map(formatValue).join(', ') : 'Not provided'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function CollectionDetails({ label, value }: { label: string; value: unknown }) {
  if (!Array.isArray(value) || value.length === 0) return null

  return (
    <div className="mt-5 border-t border-slate-200 pt-4">
      <h4 className="text-sm font-semibold text-slate-900">{label}</h4>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {value.map((item, index) => {
          const entries = item && typeof item === 'object'
            ? Object.entries(item as Record<string, unknown>).filter(([key]) => key !== 'id')
            : [['Value', item] as [string, unknown]]
          return (
            <dl key={index} className="border border-slate-200 bg-slate-50 p-4">
              <dt className="mb-3 text-xs font-semibold uppercase text-slate-500">Record {index + 1}</dt>
              {entries.map(([key, entryValue]) => (
                <div key={key} className="grid grid-cols-2 gap-3 border-t border-slate-200 py-2 text-sm first:border-t-0">
                  <dt className="font-medium text-slate-600">{key.replace(/([A-Z])/g, ' $1').trim()}</dt>
                  <dd className="break-words text-slate-900">{formatValue(entryValue)}</dd>
                </div>
              ))}
            </dl>
          )
        })}
      </div>
    </div>
  )
}

export default function LoanRepository2() {
  const { isAdmin, isLoading: isAuthorizationLoading } = useAuthorization()
  const [records, setRecords] = useState<AdminLoanProfileRecord[]>([])
  const [selectedApplicationNo, setSelectedApplicationNo] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isAuthorizationLoading || !isAdmin) {
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError('')
    void fetchAdminLoanProfileRepository(PAGE_SIZE, (page - 1) * PAGE_SIZE)
      .then((response) => {
        if (!active) return
        setRecords(response.records)
        setTotal(response.total)
        setSelectedApplicationNo((current) =>
          response.records.some((record) => record.application_no === current) ? current : null,
        )
      })
      .catch(() => {
        if (active) setError('Failed to load Loan Repository 2.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [isAdmin, isAuthorizationLoading, page])

  const filteredRecords = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    if (!query) return records
    return records.filter((record) => [
      record.application_no,
      record.borrower_name,
      record.created_by_username,
      record.created_by_email ?? '',
    ].some((value) => value.toLowerCase().includes(query)))
  }, [records, searchText])

  const selectedRecord = records.find((record) => record.application_no === selectedApplicationNo)
  const profile = (selectedRecord?.build_profile ?? {}) as ProfileData
  const values = profile.values ?? {}
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  if (isAuthorizationLoading) {
    return (
      <AuthProgressOverlay
        description="Confirming your account role before loading protected loan profile records."
        footnote="This page is restricted to administrators."
        idPrefix="loan-repository-2-access"
        kicker="Secure administration"
        title="Checking administrator access"
      />
    )
  }

  if (!isAdmin) {
    return (
      <section className="mx-auto max-w-3xl p-6">
        <div className="border border-red-200 bg-red-50 p-5 text-red-800" role="alert">
          Loan Repository 2 is available to administrators only.
        </div>
      </section>
    )
  }

  return (
    <main className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
      <header className="border-b border-slate-300 pb-5">
        <p className="text-xs font-semibold uppercase text-blue-700">Administration</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">Loan Repository 2</h1>
        <p className="mt-2 text-sm text-slate-600">Build Profile records for Steps 1 through 7.</p>
      </header>

      <section aria-label="Loan application register" className="border border-slate-300 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Applications</h2>
            <p className="text-sm text-slate-500">{total.toLocaleString()} total records</p>
          </div>
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search current page"
            aria-label="Search applications"
            className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 sm:max-w-sm"
          />
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-600" role="status">Loading applications...</div>
        ) : error ? (
          <div className="m-4 border border-red-200 bg-red-50 p-4 text-red-800" role="alert">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">Application Number</th>
                  <th className="whitespace-nowrap px-4 py-3">Created By</th>
                  <th className="whitespace-nowrap px-4 py-3">Creator Email</th>
                  <th className="whitespace-nowrap px-4 py-3">Created At</th>
                  <th className="whitespace-nowrap px-4 py-3">Applicant / Borrower</th>
                  <th className="px-4 py-3"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRecords.map((record) => (
                  <tr key={record.application_no} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-950">{record.application_no}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{record.created_by_username}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{record.created_by_email || 'Not available'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDateTime(record.created_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{record.borrower_name || 'Not provided'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedApplicationNo(record.application_no)}
                        className="border border-blue-700 px-3 py-2 font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        View profile
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredRecords.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No applications found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
          <span className="text-slate-600">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)} className="border border-slate-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
            <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="border border-slate-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
          </div>
        </div>
      </section>

      {selectedRecord && (
        <section aria-labelledby="profile-details-title" className="border border-slate-300 bg-white p-4 sm:p-6">
          <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-blue-700">{selectedRecord.application_no}</p>
              <h2 id="profile-details-title" className="text-2xl font-bold text-slate-950">{selectedRecord.borrower_name || 'Applicant profile'}</h2>
            </div>
            <button type="button" onClick={() => setSelectedApplicationNo(null)} className="self-start px-2 py-1 text-sm font-semibold text-slate-600 hover:text-slate-950">Close</button>
          </div>

          <div className="mt-5 space-y-4">
            {STEP_GROUPS.map((group, index) => (
              <details key={group.title} open={index === 0} className="border border-slate-200">
                <summary className="cursor-pointer bg-slate-100 px-4 py-3 font-semibold text-slate-950">{group.title}</summary>
                <div className="p-4">
                  <dl className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
                    {group.fields.map((field) => (
                      <div key={field.key} className="border-b border-slate-200 py-3">
                        <dt className="text-xs font-semibold uppercase text-slate-500">{field.label}</dt>
                        <dd className="mt-1 break-words text-sm text-slate-900">{formatValue(values[field.key])}</dd>
                      </div>
                    ))}
                  </dl>
                  {COLLECTIONS.filter((collection) => collection.step === index + 1).map((collection) => (
                    <CollectionDetails key={collection.key} label={collection.label} value={profile[collection.key]} />
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}