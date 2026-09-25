import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

type ReportCertificateModalProps = {
  children: ReactNode
  mode: 'credit' | 'protection' | 'wealth'
  onClose: () => void
  title: string
}

export default function ReportCertificateModal({
  children,
  mode,
  onClose,
  title,
}: ReportCertificateModalProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return createPortal(
    <div
      className="reports-certificate-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reports-certificate-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className="reports-certificate-modal">
        <header className="reports-certificate-toolbar">
          <div>
            <span>Reports &amp; Statements</span>
            <h2 id="reports-certificate-modal-title">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close certificate report">
            <X aria-hidden="true" />
          </button>
        </header>
        <div className={`reports-certificate-body is-${mode}`}>
          {children}
        </div>
      </section>
    </div>,
    document.body,
  )
}
