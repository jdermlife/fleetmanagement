interface AuthProgressOverlayProps {
  description: string
  footnote: string
  idPrefix: string
  kicker: string
  orbitLabels?: readonly [string, string, string]
  title: string
}

export default function AuthProgressOverlay({
  description,
  footnote,
  idPrefix,
  kicker,
  orbitLabels,
  title,
}: AuthProgressOverlayProps) {
  const titleId = `${idPrefix}-title`
  const descriptionId = `${idPrefix}-description`

  return (
    <div
      className={`login-signing-overlay${orbitLabels ? ' login-signing-overlay--labelled' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div
        className={`login-signing-orbit${orbitLabels ? ' login-signing-orbit--labelled' : ''}`}
        aria-hidden="true"
      >
        {orbitLabels ? orbitLabels.map((label) => (
          <span key={label}><strong>{label}</strong></span>
        )) : (
          <><span /><span /><span /><span /></>
        )}
      </div>
      <div className="login-signing-panel">
        <div className="login-signing-mark" aria-hidden="true">
          <span />
        </div>
        <p className="login-signing-kicker">{kicker}</p>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        <div
          className="login-signing-progress"
          role="progressbar"
          aria-label={`${title} in progress`}
        >
          <span />
        </div>
        <small>{footnote}</small>
      </div>
    </div>
  )
}
