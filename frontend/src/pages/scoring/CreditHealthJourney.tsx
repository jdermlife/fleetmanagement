import { useState } from 'react';

type CreditHealthComponent = {
  title: string;
  description: string;
};

type CreditHealthStep = {
  number: number;
  title: string;
  description: string;
};

export const CREDIT_HEALTH_COMPONENTS: CreditHealthComponent[] = [
  {
    title: "Credit Scorecard (5 C's of Credit)",
    description:
      'Reviews Character, Capacity, Capital, Collateral, and Conditions to understand overall credit readiness.',
  },
  {
    title: 'Credit Values Indicator',
    description:
      'Reflects financial behavior, repayment discipline, planning habits, and responsible decision-making.',
  },
  {
    title: 'Social Scorecard',
    description:
      'Considers residence, employment, family, community, education, and banking stability.',
  },
];

export const CREDIT_HEALTH_STEPS: CreditHealthStep[] = [
  {
    number: 1,
    title: 'Goal Setting',
    description: 'Define the financial purpose, product, amount, term, and expected repayment plan.',
  },
  {
    number: 2,
    title: 'Applicant Information',
    description: 'Provide identity, contact, personal, and residence information.',
  },
  {
    number: 3,
    title: 'Employment, Income and Credit Values',
    description: 'Record work, income, obligations, and complete the Credit Values assessment.',
  },
  {
    number: 4,
    title: 'Spouse / Co-Borrower Information',
    description: 'Add spouse or co-borrower details when another person supports the application.',
  },
  {
    number: 5,
    title: 'Banking Relationships',
    description: 'Describe deposit accounts, existing credit, loans, and payment history.',
  },
  {
    number: 6,
    title: 'Collateral Details',
    description: 'Identify the security or assets supporting the application, when applicable.',
  },
  {
    number: 7,
    title: 'Document Upload Center',
    description: 'Submit supporting documents for identity, income, banking, and collateral verification.',
  },
  {
    number: 8,
    title: 'FILScore',
    description: 'Bring the verified Credit Health signals together and generate the final report.',
  },
];

const MINIMIZED_STORAGE_KEY = 'fms:credit-health-journey:minimized';
const DO_NOT_SHOW_STORAGE_KEY = 'fms:credit-health-journey:do-not-show';

function safeStorageGet(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Continue without persistence when storage is unavailable.
  }
}

function safeStorageRemove(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Continue without persistence when storage is unavailable.
  }
}

export default function CreditHealthJourney() {
  const [isMinimized, setIsMinimized] = useState(
    () => safeStorageGet(MINIMIZED_STORAGE_KEY) === '1',
  );
  const [doNotShowAgain, setDoNotShowAgain] = useState(
    () => safeStorageGet(DO_NOT_SHOW_STORAGE_KEY) === '1',
  );
  const [isDismissed, setIsDismissed] = useState(
    () => safeStorageGet(DO_NOT_SHOW_STORAGE_KEY) === '1',
  );

  const minimizeJourney = () => {
    if (doNotShowAgain) {
      safeStorageSet(DO_NOT_SHOW_STORAGE_KEY, '1');
      safeStorageRemove(MINIMIZED_STORAGE_KEY);
      setIsDismissed(true);
      setIsMinimized(true);
      return;
    }

    safeStorageSet(MINIMIZED_STORAGE_KEY, '1');
    setIsMinimized(true);
  };

  const openJourney = () => {
    safeStorageRemove(MINIMIZED_STORAGE_KEY);
    setIsMinimized(false);
  };

  if (isDismissed) {
    return null;
  }

  if (isMinimized) {
    return (
      <button
        type="button"
        className="financial-health-journey-fab credit-health-journey-fab"
        onClick={openJourney}
      >
        Assess your Credit Health
      </button>
    );
  }

  return (
    <section
      className="financial-health-journey-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="credit-health-journey-title"
      aria-describedby="credit-health-journey-intro"
    >
      <article className="financial-health-journey-modal credit-health-journey-modal">
        <button
          type="button"
          className="financial-health-journey-minimize"
          onClick={minimizeJourney}
          aria-label="Minimize Assess your Credit Health"
        >
          Minimize
        </button>

        <p className="financial-health-journey-kicker">Credit Health Guide</p>
        <h2 id="credit-health-journey-title">Assess your Credit Health</h2>
        <p id="credit-health-journey-intro">
          Credit Health brings together three complementary views of your financial readiness.
          Complete Steps 1 to 8 to build a clear and well-supported assessment.
        </p>

        <div
          className="credit-health-journey-components"
          role="list"
          aria-label="Credit Health components"
        >
          {CREDIT_HEALTH_COMPONENTS.map((component) => (
            <article key={component.title} role="listitem">
              <h3>{component.title}</h3>
              <p>{component.description}</p>
            </article>
          ))}
        </div>

        <div
          className="financial-health-journey-step-list credit-health-journey-step-list"
          role="list"
          aria-label="Credit Health steps"
        >
          {CREDIT_HEALTH_STEPS.map((journeyStep) => (
            <article
              key={journeyStep.number}
              className="financial-health-journey-step credit-health-journey-step"
              role="listitem"
            >
              <span className="credit-health-journey-step-number" aria-hidden="true">
                {journeyStep.number}
              </span>
              <div className="financial-health-journey-step-copy">
                <h3>Step {journeyStep.number}: {journeyStep.title}</h3>
                <p>{journeyStep.description}</p>
              </div>
            </article>
          ))}
        </div>

        <aside className="credit-health-journey-note" aria-label="Credit Health next steps">
          <strong>Continue improving after Step 8</strong>
          <p>
            Take note of the FILSCORE recommendations. Use your Wealth Building Score to
            continuously improve your Credit Health while building and increasing your wealth.
          </p>
        </aside>

        <label className="financial-health-journey-toggle">
          <input
            type="checkbox"
            checked={doNotShowAgain}
            onChange={(event) => {
              const shouldHide = event.target.checked;
              setDoNotShowAgain(shouldHide);
              if (shouldHide) {
                safeStorageSet(DO_NOT_SHOW_STORAGE_KEY, '1');
              } else {
                safeStorageRemove(DO_NOT_SHOW_STORAGE_KEY);
              }
            }}
          />
          <span>Do not show this Credit Health pop-up again</span>
        </label>

        <button
          type="button"
          className="financial-health-journey-skip"
          onClick={minimizeJourney}
        >
          Continue to Credit Health
        </button>
      </article>
    </section>
  );
}