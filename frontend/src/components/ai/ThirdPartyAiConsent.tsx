import { useId } from 'react'
import { Link } from 'react-router-dom'

export const AI_PROCESSING_CONSENT_VERSION = '2026-09-13'

export const AI_PROCESSING_CONSENT_TEXT =
  'I authorize FILSCORE to send this recording or document and its contents to OpenAI for transcription, summarization, or structured data extraction. It may contain data entered or uploaded in this app. I confirm that I am authorized to submit this information. Processing is optional and will not begin until I consent.'

type ThirdPartyAiConsentProps = {
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}

export default function ThirdPartyAiConsent({
  checked,
  disabled = false,
  onChange,
}: ThirdPartyAiConsentProps) {
  const consentId = useId()

  return (
    <div className="third-party-ai-consent">
      <label htmlFor={consentId}>
        <input
          id={consentId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{AI_PROCESSING_CONSENT_TEXT}</span>
      </label>
      <Link to="/privacy">Review Privacy Policy</Link>
    </div>
  )
}