import { ExternalLink, Search, Trash2 } from 'lucide-react'
import { FormEvent, useRef, useState } from 'react'

import {
  createAdminProfileSearch,
  type ProfileSearchResponse,
} from '../../api'
import './ProfileSearchPage.css'

const findingCategories = [
  'Identity/profile match',
  'Telephone/contact',
  'Employment/employer',
  'Residence/location',
  'Social profiles',
  'News/web references',
  'Other notes',
] as const

type FindingCategory = typeof findingCategories[number]

interface VerifiedFinding {
  id: number
  category: FindingCategory
  details: string
  sourceTitle: string
  sourceUrl: string
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === 'object'
    && error !== null
    && 'response' in error
    && typeof error.response === 'object'
    && error.response !== null
    && 'data' in error.response
  ) {
    const data = error.response.data
    if (typeof data === 'object' && data !== null && 'detail' in data && typeof data.detail === 'string') {
      return data.detail
    }
  }
  return 'Unable to prepare the search. Please try again.'
}

function normalizeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export default function ProfileSearchPage() {
  const [accountName, setAccountName] = useState('')
  const [result, setResult] = useState<ProfileSearchResponse | null>(null)
  const [error, setError] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [findings, setFindings] = useState<VerifiedFinding[]>([])
  const [findingCategory, setFindingCategory] = useState<FindingCategory>(findingCategories[0])
  const [findingDetails, setFindingDetails] = useState('')
  const [sourceTitle, setSourceTitle] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [findingError, setFindingError] = useState('')
  const nextFindingId = useRef(1)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedName = accountName.trim().replace(/\s+/g, ' ')
    if (normalizedName.length < 2) {
      setError('Enter at least two characters.')
      setResult(null)
      return
    }

    setError('')
    setIsSearching(true)
    try {
      setResult(await createAdminProfileSearch(normalizedName))
      setFindings([])
      setFindingError('')
    } catch (searchError) {
      setResult(null)
      setError(getErrorMessage(searchError))
    } finally {
      setIsSearching(false)
    }
  }

  const handleAddFinding = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedUrl = normalizeSourceUrl(sourceUrl)
    if (!normalizedUrl) {
      setFindingError('Enter a valid source URL beginning with http:// or https://.')
      return
    }

    setFindings((currentFindings) => [
      ...currentFindings,
      {
        id: nextFindingId.current,
        category: findingCategory,
        details: findingDetails.trim(),
        sourceTitle: sourceTitle.trim(),
        sourceUrl: normalizedUrl,
      },
    ])
    nextFindingId.current += 1
    setFindingDetails('')
    setSourceTitle('')
    setSourceUrl('')
    setFindingError('')
  }

  const removeFinding = (findingId: number) => {
    setFindings((currentFindings) => currentFindings.filter((finding) => finding.id !== findingId))
  }

  return (
    <div className="psychometric-page profile-search-page">
      <section className="psychometric-hero" aria-labelledby="profile-search-title">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">Administration</span>
          <h1 id="profile-search-title">Public Profile Search</h1>
          <p>Prepare focused searches across the public web and major social platforms for authorized verification.</p>
        </div>
        <Search aria-hidden="true" size={54} />
      </section>

      <section className="psychometric-panel" aria-labelledby="profile-search-form-title">
        <div className="psychometric-panel-header">
          <div>
            <span className="psychometric-panel-kicker">Search subject</span>
            <h2 id="profile-search-form-title">Enter a name</h2>
          </div>
        </div>

        <form className="profile-search-form" onSubmit={handleSubmit}>
          <label htmlFor="profile-search-name">Full name or account name</label>
          <div className="profile-search-input-row">
            <input
              id="profile-search-name"
              name="accountName"
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
              maxLength={120}
              autoComplete="off"
              placeholder="e.g. Jane Doe"
              required
            />
            <button type="submit" disabled={isSearching}>
              {isSearching ? 'Preparing searches...' : 'Search public sources'}
            </button>
          </div>
          <p className="profile-search-notice">
            This tool creates search links only. It does not bypass platform access controls, scrape private profiles,
            or verify that public information belongs to the same person. Confirm every match independently and use
            personal information only for an authorized purpose.
          </p>
          {error ? <p className="profile-search-error" role="alert">{error}</p> : null}
        </form>
      </section>

      {result ? (
        <section className="psychometric-panel" aria-labelledby="profile-search-results-title">
          <div className="psychometric-panel-header">
            <div>
              <span className="psychometric-panel-kicker">Public source links</span>
              <h2 id="profile-search-results-title">Searches for {result.accountName}</h2>
            </div>
          </div>
          <div className="profile-search-results">
            {result.links.map((link) => (
              <article className="profile-search-result" key={link.id}>
                <div>
                  <small>Platform</small>
                  <strong>{link.platform}</strong>
                </div>
                <div>
                  <small>Information type</small>
                  <span>{link.category}</span>
                </div>
                <div>
                  <small>Search details</small>
                  <span>{link.description}</span>
                </div>
                <a href={link.url} target="_blank" rel="noreferrer">
                  Open search <ExternalLink aria-hidden="true" size={15} />
                </a>
              </article>
            ))}
          </div>

          <section className="profile-search-findings" aria-labelledby="profile-search-findings-title">
            <div>
              <span className="psychometric-panel-kicker">Verified evidence</span>
              <h3 id="profile-search-findings-title">Add a finding</h3>
              <p>
                After reviewing a search, record only information you independently verified and cite the exact public
                page where it appears.
              </p>
            </div>

            <form className="profile-search-finding-form" onSubmit={handleAddFinding}>
              <label>
                Finding category
                <select
                  value={findingCategory}
                  onChange={(event) => setFindingCategory(event.target.value as FindingCategory)}
                >
                  {findingCategories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label className="profile-search-wide-field">
                Verified finding
                <textarea
                  value={findingDetails}
                  onChange={(event) => setFindingDetails(event.target.value)}
                  maxLength={1000}
                  placeholder="State the verified finding without adding unsupported assumptions."
                  required
                />
              </label>
              <label>
                Source name
                <input
                  value={sourceTitle}
                  onChange={(event) => setSourceTitle(event.target.value)}
                  maxLength={160}
                  placeholder="e.g. Employer staff directory"
                  required
                />
              </label>
              <label>
                Exact source URL
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  maxLength={2000}
                  placeholder="https://example.com/public-page"
                  required
                />
              </label>
              <div className="profile-search-finding-actions">
                <button type="submit">Add verified finding</button>
                {findingError ? <p className="profile-search-error" role="alert">{findingError}</p> : null}
              </div>
            </form>
          </section>

          <section className="profile-search-summary" aria-labelledby="profile-search-summary-title">
            <div>
              <span className="psychometric-panel-kicker">Verified findings</span>
              <h3 id="profile-search-summary-title">Findings Summary</h3>
            </div>
            {findings.length > 0 ? (
              <>
                <p>
                  {findings.length} independently recorded {findings.length === 1 ? 'finding' : 'findings'} for{' '}
                  <strong>{result.accountName}</strong> across{' '}
                  {new Set(findings.map((finding) => finding.category)).size}{' '}
                  {new Set(findings.map((finding) => finding.category)).size === 1 ? 'category' : 'categories'}.
                </p>
                <ul className="profile-search-summary-list">
                  {findings.map((finding) => (
                    <li key={finding.id}>
                      <div>
                        <strong>{finding.category}</strong>
                        <p>{finding.details}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFinding(finding.id)}
                        aria-label={`Remove ${finding.category} finding`}
                      >
                        <Trash2 aria-hidden="true" size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="profile-search-empty-summary">
                No verified findings have been recorded. Open the searches above, verify any match independently, and
                add each supported finding with its exact source.
              </p>
            )}
            <p className="profile-search-summary-caveat">
              This summary contains administrator-recorded findings, not automatically verified identity data.
              Similar names and outdated pages can refer to a different person; confirm each source before relying on
              it.
            </p>
          </section>

          <section className="profile-search-references" aria-labelledby="profile-search-references-title">
            <h3 id="profile-search-references-title">References</h3>
            {findings.length > 0 ? (
              <ol>
                {findings.map((finding) => (
                  <li key={finding.id}>
                    <span>
                      <strong>{finding.sourceTitle}</strong>
                      <small>{finding.category}</small>
                    </span>
                    <a href={finding.sourceUrl} target="_blank" rel="noreferrer">
                      View source <ExternalLink aria-hidden="true" size={14} />
                    </a>
                  </li>
                ))}
              </ol>
            ) : (
              <p>References will appear here after a verified finding is added.</p>
            )}
          </section>
        </section>
      ) : null}
    </div>
  )
}
