import { useEffect, useState } from 'react'

import {
  isPrivacyOptionsFormRequired,
  showPrivacyOptionsForm,
} from '../../nativeAds'

export default function PrivacyChoicesCard() {
  const [isRequired, setIsRequired] = useState(false)
  const [isOpening, setIsOpening] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    void isPrivacyOptionsFormRequired()
      .then((required) => {
        if (isMounted) {
          setIsRequired(required)
        }
      })
      .catch((error) => {
        console.error('[AdMob] Unable to check privacy options availability:', error)
        if (isMounted) {
          setMessage('Privacy choices are temporarily unavailable. Please try again later.')
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const handleOpenPrivacyChoices = async () => {
    setIsOpening(true)
    setMessage('')

    try {
      await showPrivacyOptionsForm()
      setMessage('Privacy Choices closed.')
    } catch (error) {
      console.error('[AdMob] Unable to show privacy options form:', error)
      setMessage('Unable to open Privacy Choices right now. Please try again later.')
    } finally {
      setIsOpening(false)
    }
  }

  if (!isRequired && !message) {
    return null
  }

  return (
    <section className="card auth-helper-card" aria-labelledby="privacy-choices-heading">
      <h3 id="privacy-choices-heading">Privacy Choices</h3>
      {isRequired ? (
        <>
          <p className="intro">
            Review or update how your data may be used for advertising under applicable U.S.
            state privacy laws.
          </p>
          <div className="form-actions">
            <button type="button" onClick={() => void handleOpenPrivacyChoices()} disabled={isOpening}>
              {isOpening ? 'Opening...' : 'Open Privacy Choices'}
            </button>
          </div>
        </>
      ) : null}
      {message ? (
        <p className={`status-message${isRequired ? '' : ' status-error'}`} role="status">
          {message}
        </p>
      ) : null}
    </section>
  )
}
