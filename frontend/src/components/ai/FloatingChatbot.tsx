import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { askPageAssistant, type PageAssistantHistoryItem } from '../../api'
import {
  AI_DISCLAIMER,
  PROPRIETARY_REFUSAL,
  isProtectedAssistantQuestion,
} from './assistantPolicy'

type FloatingChatbotProps = {
  pathname: string
  authenticated: boolean
  ready: boolean
}

type ChatMessage = PageAssistantHistoryItem & {
  id: number
  welcome?: boolean
}

function getPageTitle(pathname: string): string {
  if (/^\/(?:login)?$/.test(pathname)) return 'Sign in'
  if (pathname === '/register') return 'Create account'
  if (/^\/(?:privacy|terms|return-refund-policy|customer-service|dispute-resolution|subscription-fees)$/.test(pathname)) return 'Policies and support'
  if (/^\/(?:dashboard|snapshot|financial-health-summary)$/.test(pathname)) return 'Financial health overview'
  if (/^\/(?:build-profile|borrower-profile|account|settings)$/.test(pathname)) return 'Profile and account'
  if (/^\/(?:lending-scorecard(?:\/filscore)?|credit-scoring|calculation|aml-kyc-scoring|credit-health-multi-product)$/.test(pathname)) return 'Assessment results'
  if (/^\/loan-/.test(pathname) || pathname === '/approval-queue' || pathname === '/credit-review-workbench') return 'Loan workflow'
  if (/^\/(?:vehicle|driver|live-gps|maintenance|insurance|fuel)/.test(pathname)) return 'Fleet management'
  if (/^\/(?:subscriptions|subscription|billing|invoices|payment-history|trial-expired)/.test(pathname)) return 'Subscription and billing'
  if (pathname.startsWith('/ai') || pathname === '/chat-assistant') return 'AI tools'
  return authenticatedPageTitle(pathname)
}

function authenticatedPageTitle(pathname: string): string {
  return pathname === '/support' ? 'Support' : 'FILSCORE page'
}

function welcomeMessage(authenticated: boolean): ChatMessage {
  return {
    id: 0,
    role: 'assistant',
    welcome: true,
    content: authenticated
      ? 'Ask me about this page, navigation, or how to use FILSCORE. I provide high-level, read-only guidance.'
      : 'Ask me about signing in, registration, public policies, or finding support.',
  }
}

function FloatingChatbot({ pathname, authenticated, ready }: FloatingChatbotProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage(authenticated)])
  const [sending, setSending] = useState(false)
  const nextMessageId = useRef(1)
  const conversationVersion = useRef(0)
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null)
  const pageTitle = useMemo(() => getPageTitle(pathname), [pathname])

  useEffect(() => {
    conversationVersion.current += 1
    setMessages([welcomeMessage(authenticated)])
    setInput('')
    setSending(false)
  }, [pathname, authenticated])

  useEffect(() => {
    const anchor = scrollAnchorRef.current
    if (open && typeof anchor?.scrollIntoView === 'function') {
      anchor.scrollIntoView({ block: 'nearest' })
    }
  }, [messages, open])

  useEffect(() => {
    if (!open) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open])

  const appendAssistantMessage = (content: string) => {
    setMessages((current) => [
      ...current,
      { id: nextMessageId.current++, role: 'assistant', content },
    ])
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const message = input.trim()
    if (!message || sending || !ready) return

    const userMessage: ChatMessage = {
      id: nextMessageId.current++,
      role: 'user',
      content: message,
    }
    const priorHistory = messages
      .filter((item) => !item.welcome)
      .slice(-6)
      .map(({ role, content }) => ({ role, content }))

    setMessages((current) => [...current, userMessage])
    setInput('')

    if (isProtectedAssistantQuestion(message)) {
      appendAssistantMessage(PROPRIETARY_REFUSAL)
      return
    }

    setSending(true)
    const requestVersion = conversationVersion.current
    try {
      const response = await askPageAssistant({
        message,
        pagePath: pathname,
        history: priorHistory,
        authenticated,
      })
      if (requestVersion === conversationVersion.current) {
        appendAssistantMessage(response.answer)
      }
    } catch {
      if (requestVersion === conversationVersion.current) {
        appendAssistantMessage('The assistant is temporarily unavailable. Please try again in a few moments.')
      }
    } finally {
      if (requestVersion === conversationVersion.current) {
        setSending(false)
      }
    }
  }

  return (
    <aside className="page-assistant" aria-label="FILSCORE AI assistant">
      {open ? (
        <section className="page-assistant-panel" role="dialog" aria-modal="false" aria-labelledby="page-assistant-title">
          <header className="page-assistant-header">
            <div>
              <span className="page-assistant-kicker">Read-only assistant</span>
              <h2 id="page-assistant-title">Ask FILSCORE AI</h2>
              <p>{pageTitle}</p>
            </div>
            <button
              type="button"
              className="page-assistant-close"
              aria-label="Close AI assistant"
              onClick={() => setOpen(false)}
            >
              {'\u00d7'}
            </button>
          </header>

          <div className="page-assistant-messages" aria-live="polite">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`page-assistant-message page-assistant-message-${message.role}`}
              >
                <span>{message.role === 'assistant' ? 'FILSCORE AI' : 'You'}</span>
                <p>{message.content}</p>
              </div>
            ))}
            {sending ? (
              <div className="page-assistant-message page-assistant-message-assistant" role="status">
                <span>FILSCORE AI</span>
                <p>Thinking...</p>
              </div>
            ) : null}
            <div ref={scrollAnchorRef} />
          </div>

          <form className="page-assistant-form" onSubmit={handleSubmit}>
            <label htmlFor="page-assistant-question">Your question</label>
            <div className="page-assistant-compose">
              <textarea
                id="page-assistant-question"
                value={input}
                maxLength={1200}
                rows={2}
                placeholder={ready ? 'Ask about this page...' : 'Preparing the assistant...'}
                disabled={!ready || sending}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
              />
              <button type="submit" disabled={!ready || sending || !input.trim()}>
                Ask
              </button>
            </div>
          </form>

          <footer className="page-assistant-notice">
            <strong>{AI_DISCLAIMER}</strong>
            <span>Do not enter passwords or sensitive account details.</span>
          </footer>
        </section>
      ) : null}

      <div className="page-assistant-launcher-wrap">
        <button
          type="button"
          className="page-assistant-launcher"
          aria-label={open ? 'Close FILSCORE AI assistant' : 'Open FILSCORE AI assistant'}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <span aria-hidden="true">AI</span>
          <span>Ask FILSCORE</span>
        </button>
        <span className="page-assistant-launcher-notice">{AI_DISCLAIMER}</span>
      </div>
    </aside>
  )
}

export default FloatingChatbot
