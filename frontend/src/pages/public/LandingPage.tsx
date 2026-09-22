import {
  ArrowRight,
  Bot,
  ChartNoAxesCombined,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  Landmark,
  LineChart,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { APP_NAME, brandLogoDataUri } from '../../brand'
import './LandingPage.css'

const tools = [
  {
    icon: ChartNoAxesCombined,
    title: 'Financial Health Dashboard',
    description: 'See your financial position in one clear view, with scores, trends, and priority actions that show what to improve next.',
  },
  {
    icon: ClipboardCheck,
    title: 'Build Profile',
    description: 'Organize income, expenses, assets, debts, and goals once, creating a reliable foundation for every FILSCORE insight.',
  },
  {
    icon: WalletCards,
    title: 'Budget & Expense Tracker',
    description: 'Understand where your money goes, set practical limits, and turn monthly cash flow into a plan you can follow.',
  },
  {
    icon: Landmark,
    title: 'Wealth Builder',
    description: 'Track net worth, liquidity, savings, investments, and retirement progress to make long-term growth measurable.',
  },
  {
    icon: CreditCard,
    title: 'Credit Health & FILSCORE',
    description: 'Evaluate credit readiness, repayment capacity, bureau factors, and fraud risk before making a borrowing decision.',
  },
  {
    icon: ReceiptText,
    title: 'Bill Manager',
    description: 'Keep recurring obligations visible, reduce missed-payment risk, and protect the payment behavior behind your credit health.',
  },
  {
    icon: CircleDollarSign,
    title: 'Financial Decisions',
    description: 'Compare affordability, debt, savings, and future scenarios before committing to a loan or major financial goal.',
  },
  {
    icon: Bot,
    title: 'AI Financial Assistant',
    description: 'Turn your financial data into plain-language explanations, focused recommendations, and practical next steps.',
  },
] as const

const outcomes = [
  'Know your current financial health score',
  'Find the strongest next action for your money',
  'Prepare for borrowing with greater confidence',
  'Track progress across one connected dashboard',
] as const

export default function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-nav">
        <Link className="landing-brand" to="/" aria-label={`${APP_NAME} home`}>
          <img src={brandLogoDataUri} alt="" aria-hidden="true" />
          <span>{APP_NAME}<small>Financial intelligence for life</small></span>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#tools">Tools</a>
          <a href="#trial">Trial</a>
          <a href="#about">About</a>
          <Link className="landing-sign-in" to="/login">Sign In</Link>
        </nav>
      </header>

      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <img className="landing-hero-mark" src={brandLogoDataUri} alt="" aria-hidden="true" />
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">One dashboard. Your full financial picture.</p>
            <h1 id="landing-title">FILSCORE ai - Your Financial Health Dashboard</h1>
            <p className="landing-hero-lead">
              Understand your money, strengthen your credit readiness, and turn financial data into
              decisions you can act on.
            </p>
            <div className="landing-hero-actions">
              <Link className="landing-primary-action" to="/register">
                Start Free Trial <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <a className="landing-secondary-action" href="#tools">Explore the tools</a>
            </div>
            <p className="landing-trust-line">
              <ShieldCheck size={17} aria-hidden="true" /> Secure, guided, and built around your goals.
            </p>
          </div>
          <div className="landing-hero-score" aria-label="FILSCORE dashboard preview">
            <span>Financial health</span>
            <strong>One clear view</strong>
            <div className="landing-score-track"><i /></div>
            <dl>
              <div><dt>Cash flow</dt><dd>Visible</dd></div>
              <div><dt>Credit readiness</dt><dd>Measured</dd></div>
              <div><dt>Next actions</dt><dd>Prioritized</dd></div>
            </dl>
          </div>
        </section>

        <section className="landing-tools" id="tools" aria-labelledby="tools-title">
          <div className="landing-section-heading">
            <p>Connected financial tools</p>
            <h2 id="tools-title">From daily cash flow to long-term financial health</h2>
            <span>Each tool adds context to your dashboard, helping you move from numbers to practical decisions.</span>
          </div>
          <div className="landing-tool-grid">
            {tools.map(({ icon: Icon, title, description }, index) => (
              <article className="landing-tool" key={title}>
                <div className="landing-tool-number">{String(index + 1).padStart(2, '0')}</div>
                <Icon size={24} strokeWidth={1.8} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-outcomes" aria-labelledby="outcomes-title">
          <div>
            <p className="landing-eyebrow">Built for better decisions</p>
            <h2 id="outcomes-title">Your financial information should tell you what to do next.</h2>
          </div>
          <ul>
            {outcomes.map((outcome) => (
              <li key={outcome}><LineChart size={20} aria-hidden="true" />{outcome}</li>
            ))}
          </ul>
        </section>

        <section className="landing-trial" id="trial" aria-labelledby="trial-title">
          <div className="landing-trial-copy">
            <p>Complimentary access</p>
            <h2 id="trial-title">Explore FILSCORE with a 2-day free trial.</h2>
            <span>Build your profile, review your dashboard, and experience the premium financial tools before committing.</span>
          </div>
          <div className="landing-trial-actions">
            <Link className="landing-primary-action" to="/register">
              Create Free Account <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link to="/fees">View plans and fees</Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer" id="about">
        <div className="landing-footer-about">
          <img src={brandLogoDataUri} alt="FILSCORE" />
          <div>
            <h2>About Quantech International</h2>
            <p>
              Quantech.International Solutions OPC builds practical digital systems that help
              people and organizations use financial intelligence with greater clarity and confidence.
            </p>
          </div>
        </div>
        <nav aria-label="Legal and support links">
          <Link to="/about-filscore">About FILSCORE</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/customer-service">Customer Service</Link>
        </nav>
        <p className="landing-copyright">© {new Date().getFullYear()} Quantech.International Solutions OPC</p>
      </footer>
    </div>
  )
}