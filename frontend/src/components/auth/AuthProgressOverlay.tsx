interface AuthProgressOverlayProps {
  description: string
  footnote: string
  idPrefix: string
  kicker: string
  title: string
}

export default function AuthProgressOverlay({
  description,
  footnote,
  idPrefix,
  kicker,
  title,
}: AuthProgressOverlayProps) {
  const titleId = `${idPrefix}-title`
  const descriptionId = `${idPrefix}-description`

  return (
    <div
      className="login-signing-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div className="login-signing-panel">
        <div className="login-signing-mark" aria-hidden="true">
          <span />
        </div>
        <p className="login-signing-kicker">{kicker}</p>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        <div className="login-signing-progress" aria-hidden="true">
          <span />
        </div>
        <small>{footnote}</small>
      </div>
    </div>
  )
}
