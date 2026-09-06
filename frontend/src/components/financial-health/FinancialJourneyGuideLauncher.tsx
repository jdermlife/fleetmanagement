import { useState } from 'react'

import FinancialJourneyGuide, {
  type JourneyStep,
  type JourneyStepId,
} from './FinancialJourneyGuide'

type FinancialJourneyGuideLauncherProps = {
  applicationNo?: string | null
  currentStep: JourneyStepId
}

const EMPTY_COMPLETION: Record<JourneyStepId, boolean> = {
  createProfile: false,
  creditHealth: false,
  wealthBuilder: false,
  budgetTargets: false,
  billsLoans: false,
  billManager: false,
}

export default function FinancialJourneyGuideLauncher({
  applicationNo,
  currentStep,
}: FinancialJourneyGuideLauncherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [doNotShowAgain, setDoNotShowAgain] = useState(false)

  const launchStep = (step: JourneyStep) => {
    if (step.id === currentStep) {
      setIsOpen(false)
      return
    }

    const applicationQuery = applicationNo?.trim()
      ? `?applicationNo=${encodeURIComponent(applicationNo.trim())}`
      : ''
    window.location.assign(`${step.route}${applicationQuery}`)
  }

  return (
    <>
      <FinancialJourneyGuide
        completion={EMPTY_COMPLETION}
        currentStep={currentStep}
        doNotShowAgain={doNotShowAgain}
        isOpen={isOpen}
        onDoNotShowAgainChange={setDoNotShowAgain}
        onLaunchStep={launchStep}
        onMinimize={() => setIsOpen(false)}
      />

      <section className="financial-health-compute-bar" aria-label="Financial journey controls">
        <div>
          <strong>Financial Health Journey</strong>
          <span>Review the guided steps or open your Financial Health summary.</span>
        </div>
        <button
          type="button"
          className="financial-health-journey-main-fab"
          onClick={() => window.location.assign('/financial-health-summary')}
        >
          Financial Health
        </button>
        <button
          type="button"
          className="financial-health-journey-main-fab"
          aria-label="Financial Journey Guide"
          onClick={() => setIsOpen(true)}
        >
          User Guide
        </button>
      </section>
    </>
  )
}
