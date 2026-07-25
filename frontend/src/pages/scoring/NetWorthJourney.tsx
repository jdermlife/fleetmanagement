import { useState } from 'react';

type WealthBuildingComponent = {
  title: string;
  description: string;
};

type WealthManagementTool = {
  title: string;
  description: string;
  route: string;
  actionLabel: string;
};

export const WEALTH_BUILDING_COMPONENTS: WealthBuildingComponent[] = [
  {
    title: 'Net Worth Positioning Score',
    description: 'Shows your current position using assets, liabilities, cash flow, and progress toward your financial goals.',
  },
  {
    title: 'Net Worth Authenticity',
    description: 'Reflects the completeness, consistency, and certification of the financial information you provide.',
  },
  {
    title: 'Net Wealth Foundation',
    description: 'Reviews the financial base supporting your wealth, including liquidity, debt control, savings, and protection.',
  },
  {
    title: 'Wealth Behaviour',
    description: 'Considers your financial habits, investment suitability, goal alignment, and response to changing conditions.',
  },
];

export const WEALTH_MANAGEMENT_TOOLS: WealthManagementTool[] = [
  {
    title: 'Budget Tracker',
    description: 'Plan income, spending, savings, and investments so your available resources support your goals.',
    route: '/budget-expense-tracker',
    actionLabel: 'Open Budget Tracker',
  },
  {
    title: 'Debt Optimizer',
    description: 'Organize loan obligations and identify practical ways to reduce debt pressure on your net worth.',
    route: '/loan-monitoring',
    actionLabel: 'Open Debt Optimizer',
  },
  {
    title: 'Bill Manager',
    description: 'Track due dates and recurring commitments to protect cash flow and avoid missed payments.',
    route: '/bill-reminder',
    actionLabel: 'Open Bill Manager',
  },
];

const MINIMIZED_STORAGE_KEY = 'fms:net-worth-journey:minimized';
const DO_NOT_SHOW_STORAGE_KEY = 'fms:net-worth-journey:do-not-show';

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

export default function NetWorthJourney() {
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
        className="financial-health-journey-fab net-worth-journey-fab"
        onClick={openJourney}
      >
        Improve your Net Worth
      </button>
    );
  }

  return (
    <section
      className="financial-health-journey-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="net-worth-journey-title"
      aria-describedby="net-worth-journey-intro"
    >
      <article className="financial-health-journey-modal net-worth-journey-modal">
        <button
          type="button"
          className="financial-health-journey-minimize"
          onClick={minimizeJourney}
          aria-label="Minimize Improve your Net Worth"
        >
          Minimize
        </button>

        <p className="financial-health-journey-kicker">Wealth Building Guide</p>
        <h2 id="net-worth-journey-title">Improve your Net Worth</h2>
        <p id="net-worth-journey-intro">
          Your Wealth Building Score brings together four views of your financial position,
          the reliability of your information, the strength of your foundation, and your wealth habits.
        </p>

        <div
          className="credit-health-journey-components net-worth-journey-components"
          role="list"
          aria-label="Wealth Building Score components"
        >
          {WEALTH_BUILDING_COMPONENTS.map((component) => (
            <article key={component.title} role="listitem">
              <h3>{component.title}</h3>
              <p>{component.description}</p>
            </article>
          ))}
        </div>

        <section className="net-worth-journey-tools" aria-labelledby="net-worth-tools-title">
          <div>
            <h3 id="net-worth-tools-title">Manage your resources well</h3>
            <p>
              Use these connected tools regularly to turn your Wealth Building insights into practical action.
            </p>
          </div>
          <div className="net-worth-journey-tool-list" role="list">
            {WEALTH_MANAGEMENT_TOOLS.map((tool) => (
              <article key={tool.title} role="listitem">
                <h3>{tool.title}</h3>
                <p>{tool.description}</p>
                <a className="financial-health-journey-action" href={tool.route}>
                  {tool.actionLabel}
                </a>
              </article>
            ))}
          </div>
        </section>

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
          <span>Do not show this Net Worth pop-up again</span>
        </label>

        <button
          type="button"
          className="financial-health-journey-skip"
          onClick={minimizeJourney}
        >
          Continue to Net Worth Positioning
        </button>
      </article>
    </section>
  );
}