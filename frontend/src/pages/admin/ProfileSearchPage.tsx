import { ExternalLink, Search } from 'lucide-react'
import { FormEvent, useState } from 'react'

import {
  createAdminProfileSearch,
  type ProfileSearchResponse,
} from '../../api'
import './ProfileSearchPage.css'

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

export default function ProfileSearchPage() {
  const [accountName, setAccountName] = useState('')
  const [result, setResult] = useState<ProfileSearchResponse | null>(null)
  const [error, setError] = useState('')
  const [isSearching, setIsSearching] = useState(false)

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
    } catch (searchError) {
      setResult(null)
      setError(getErrorMessage(searchError))
    } finally {
      setIsSearching(false)
    }
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
        </section>
      ) : null}
    </div>
  )
}
