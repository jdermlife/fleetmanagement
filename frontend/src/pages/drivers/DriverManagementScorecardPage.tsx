import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { api, getErrorMessage } from '../../api'

import type {
  DatabaseStatus,
  DriverManagementScorecardRecord,
  DriverManagementScorecardSubmission,
} from '../../types'

const initialForm: DriverManagementScorecardSubmission = {
  driverName: '',
  licenseClass: 'Professional',
  yearsDriving: 0,
  employmentYears: 0,
  incidentsLast3Years: 0,
  violationsLast3Years: 0,
  trainingHours: 0,
  onTimeRate: 95,
  customerRating: 4.5,
  fatigueEvents: 0,
}

function DriverManagementScorecardPage() {
  const [form, setForm] =
    useState<DriverManagementScorecardSubmission>(
      initialForm,
    )

  const [databaseStatus, setDatabaseStatus] =
    useState<DatabaseStatus | null>(null)

  const [recentRecords, setRecentRecords] =
    useState<DriverManagementScorecardRecord[]>(
      [],
    )

  const [savedRecord, setSavedRecord] =
    useState<DriverManagementScorecardRecord | null>(
      null,
    )

  const [isLoading, setIsLoading] =
    useState(true)

  const [isSaving, setIsSaving] =
    useState(false)

  const [error, setError] = useState('')

  const [successMessage, setSuccessMessage] =
    useState('')

  useEffect(() => {
    void loadPage()
  }, [])

  async function loadPage() {
    setIsLoading(true)

    setError('')

    try {
      const [
        databaseResponse,
        recordsResponse,
      ] = await Promise.all([
        api.get<DatabaseStatus>(
          '/database/status',
        ),

        api.get(
          '/driver-management-scorecards',
        ),
      ])

      console.log(
        'DRIVER SCORECARD API:',
        recordsResponse.data,
      )

      const driverScorecardData =
        recordsResponse.data?.data ||
        recordsResponse.data?.records ||
        recordsResponse.data ||
        []

      const safeRecords =
        Array.isArray(
          driverScorecardData,
        )
          ? driverScorecardData
          : []

      setDatabaseStatus(
        databaseResponse.data,
      )

      setRecentRecords(safeRecords)

      if (safeRecords[0]) {
        setSavedRecord(
          safeRecords[0],
        )
      }
    } catch (loadError: unknown) {
      setError(
        getErrorMessage(
          loadError,
          'Unable to load driver management scorecard data right now.',
        ),
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setError('')

    setSuccessMessage('')

    setIsSaving(true)

    try {
      const response =
        await api.post<DriverManagementScorecardRecord>(
          '/driver-management-scorecards',
          form,
        )

      console.log(
        'SAVE DRIVER SCORECARD API:',
        response.data,
      )

      setSavedRecord(response.data)

      setRecentRecords(
        (current) => [
          response.data,

          ...(Array.isArray(current)
            ? current.filter(
                (record) =>
                  record.id !==
                  response.data.id,
              )
            : []),
        ].slice(0, 20),
      )

      setSuccessMessage(
        'Driver management scorecard saved successfully.',
      )
    } catch (saveError: unknown) {
      setError(
        getErrorMessage(
          saveError,
          'Driver management scorecard could not be saved.',
        ),
      )
    } finally {
      setIsSaving(false)
    }
  }

  function updateNumberField<
    K extends keyof DriverManagementScorecardSubmission,
  >(key: K, value: string) {
    setForm((current) => ({
      ...current,

      [key]:
        value === ''
          ? 0
          : Number(value),
    }))
  }

  return (
    <div className="driver-scorecard-page">
      <div className="driver-scorecard-header">
        <div>
          <h2>
            Driver Management
            Scorecard
          </h2>

          <p>
            Driver scoring
            workflow linked from
            the sidebar.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadPage()
          }
          disabled={isLoading}
        >
          {isLoading
            ? 'Loading...'
            : 'Refresh Records'}
        </button>
      </div>

      <div className="driver-scorecard-grid">
        <article className="lease-card">
          <h3>Database Link</h3>

          {databaseStatus ? (
            <div className="vehicle-db-status">
              <div>
                <span>Engine</span>

                <strong>
                  {databaseStatus.engine}
                </strong>
              </div>

              <div>
                <span>Database</span>

                <strong>
                  {databaseStatus.database ||
                    'Not provided'}
                </strong>
              </div>

              <div>
                <span>Host</span>

                <strong>
                  {databaseStatus.host ||
                    'Local file storage'}
                </strong>
              </div>

              <div>
                <span>Port</span>

                <strong>
                  {databaseStatus.port ??
                    'n/a'}
                </strong>
              </div>

              <div className="vehicle-db-source">
                <span>
                  Resolved Source
                </span>

                <code>
                  {databaseStatus.source}
                </code>
              </div>
            </div>
          ) : (
            <p className="empty-state">
              No database
              connection details
              available yet.
            </p>
          )}
        </article>

        <article className="lease-card">
          <h3>
            Python Driver
            Algorithm
          </h3>

          <ul className="lease-scorecard-list">
            <li>
              Safety history
              contributes 35%.
            </li>

            <li>
              License compliance
              and training
              contribute 20%.
            </li>

            <li>
              Driving experience
              contributes 15%.
            </li>

            <li>
              Service quality
              contributes 20%.
            </li>

            <li>
              Employment
              stability
              contributes 10%.
            </li>
          </ul>
        </article>
      </div>

      <div className="lease-scorecard-workspace">
        <article className="lease-card">
          <h3>
            Driver Input Form
          </h3>

          <form
            className="lease-scorecard-form"
            onSubmit={handleSubmit}
          >
            <label>
              Driver Name

              <input
                value={
                  form.driverName
                }
                onChange={(
                  event,
                ) =>
                  setForm(
                    (
                      current,
                    ) => ({
                      ...current,

                      driverName:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                required
              />
            </label>

            <label>
              License Class

              <select
                value={
                  form.licenseClass
                }
                onChange={(
                  event,
                ) =>
                  setForm(
                    (
                      current,
                    ) => ({
                      ...current,

                      licenseClass:
                        event
                          .target
                          .value,
                    }),
                  )
                }
              >
                <option value="Professional">
                  Professional
                </option>

                <option value="Commercial">
                  Commercial
                </option>

                <option value="Standard">
                  Standard
                </option>
              </select>
            </label>

            <label>
              Years Driving

              <input
                type="number"
                min="0"
                step="0.1"
                value={
                  form.yearsDriving ||
                  ''
                }
                onChange={(
                  event,
                ) =>
                  updateNumberField(
                    'yearsDriving',
                    event.target
                      .value,
                  )
                }
                required
              />
            </label>

            <label>
              Employment Years

              <input
                type="number"
                min="0"
                step="0.1"
                value={
                  form.employmentYears ||
                  ''
                }
                onChange={(
                  event,
                ) =>
                  updateNumberField(
                    'employmentYears',
                    event.target
                      .value,
                  )
                }
                required
              />
            </label>

            <label>
              Incidents in Last
              3 Years

              <input
                type="number"
                min="0"
                step="1"
                value={
                  form.incidentsLast3Years ||
                  ''
                }
                onChange={(
                  event,
                ) =>
                  updateNumberField(
                    'incidentsLast3Years',
                    event.target
                      .value,
                  )
                }
                required
              />
            </label>

            <label>
              Violations in Last
              3 Years

              <input
                type="number"
                min="0"
                step="1"
                value={
                  form.violationsLast3Years ||
                  ''
                }
                onChange={(
                  event,
                ) =>
                  updateNumberField(
                    'violationsLast3Years',
                    event.target
                      .value,
                  )
                }
                required
              />
            </label>

            <label>
              Training Hours

              <input
                type="number"
                min="0"
                step="0.1"
                value={
                  form.trainingHours ||
                  ''
                }
                onChange={(
                  event,
                ) =>
                  updateNumberField(
                    'trainingHours',
                    event.target
                      .value,
                  )
                }
                required
              />
            </label>

            <label>
              On-Time Rate (%)

              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={
                  form.onTimeRate ||
                  ''
                }
                onChange={(
                  event,
                ) =>
                  updateNumberField(
                    'onTimeRate',
                    event.target
                      .value,
                  )
                }
                required
              />
            </label>

            <label>
              Customer Rating
              (0-5)

              <input
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={
                  form.customerRating ||
                  ''
                }
                onChange={(
                  event,
                ) =>
                  updateNumberField(
                    'customerRating',
                    event.target
                      .value,
                  )
                }
                required
              />
            </label>

            <label>
              Fatigue Events

              <input
                type="number"
                min="0"
                step="1"
                value={
                  form.fatigueEvents ||
                  ''
                }
                onChange={(
                  event,
                ) =>
                  updateNumberField(
                    'fatigueEvents',
                    event.target
                      .value,
                  )
                }
                required
              />
            </label>

            <div className="lease-scorecard-preview">
              <span>
                Current record
                target
              </span>

              <strong>
                {databaseStatus?.engine ===
                'postgresql'
                  ? 'PostgreSQL driver scorecard store'
                  : 'SQLite fallback driver store'}
              </strong>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                disabled={
                  isSaving
                }
              >
                {isSaving
                  ? 'Saving Scorecard...'
                  : 'Save and Compute Driver Score'}
              </button>
            </div>
          </form>
        </article>

        <aside className="lease-side-panel">
          <article className="lease-card">
            <h3>
              Latest Computed
              Result
            </h3>

            {savedRecord ? (
              <div className="lease-result-grid">
                <div>
                  <span>
                    Driver
                  </span>

                  <strong>
                    {
                      savedRecord.driverName
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Grade
                  </span>

                  <strong>
                    {
                      savedRecord.riskGrade
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Recommendation
                  </span>

                  <strong>
                    {
                      savedRecord.recommendation
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Final Score
                  </span>

                  <strong>
                    {savedRecord.finalScore.toFixed(
                      2,
                    )}
                  </strong>
                </div>
              </div>
            ) : (
              <p className="empty-state">
                No driver
                scorecards have
                been saved yet.
              </p>
            )}
          </article>

          <article className="lease-card">
            <h3>
              Recent Saved
              Driver Scorecards
            </h3>

            {recentRecords.length ===
            0 ? (
              <p className="empty-state">
                No saved records
                yet.
              </p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>
                        Driver
                      </th>

                      <th>
                        Score
                      </th>

                      <th>
                        Grade
                      </th>

                      <th>
                        Recommendation
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {(
                      Array.isArray(
                        recentRecords,
                      )
                        ? recentRecords
                        : []
                    ).map(
                      (
                        record,
                      ) => (
                        <tr
                          key={
                            record.id
                          }
                        >
                          <td>
                            {
                              record.driverName
                            }
                          </td>

                          <td>
                            {record.finalScore.toFixed(
                              2,
                            )}
                          </td>

                          <td>
                            {
                              record.riskGrade
                            }
                          </td>

                          <td>
                            {
                              record.recommendation
                            }
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </aside>
      </div>

      {error ? (
        <p className="status-message status-error">
          {error}
        </p>
      ) : null}

      {successMessage ? (
        <p className="status-message status-success">
          {successMessage}
        </p>
      ) : null}
    </div>
  )
}

export default DriverManagementScorecardPage