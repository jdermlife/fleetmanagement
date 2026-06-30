import { useMemo, useState } from 'react';

type ResponseOption = {
  label: string;
  score: number;
};

type Question = {
  id: string;
  text: string;
};

type Section = {
  id: string;
  title: string;
  questions: Question[];
  note?: string;
};

const responseScale: ResponseOption[] = [
  { label: 'Strongly Agree', score: 4 },
  { label: 'Agree', score: 3 },
  { label: 'Neutral', score: 2 },
  { label: 'Disagree', score: 1 },
  { label: 'Strongly Disagree', score: 0 },
];

const responseScoreMap = Object.fromEntries(
  responseScale.map((option) => [option.label, option.score]),
) as Record<string, number>;

const psychometricSections: Section[] = [
  {
    id: 'A',
    title: 'Financial Discipline',
    questions: [
      { id: 'q01', text: 'I prepare a monthly budget before spending my income.' },
      { id: 'q02', text: 'I usually pay my bills before their due dates.' },
      { id: 'q03', text: 'I regularly monitor my bank account balances.' },
      { id: 'q04', text: 'I save part of my income every month.' },
      { id: 'q05', text: 'I avoid buying things I cannot afford.' },
    ],
  },
  {
    id: 'B',
    title: 'Savings Behavior',
    questions: [
      { id: 'q06', text: 'I maintain an emergency fund.' },
      { id: 'q07', text: 'I save before making major purchases.' },
      { id: 'q08', text: 'I can cover unexpected expenses without borrowing.' },
      { id: 'q09', text: 'I have long-term financial goals.' },
      { id: 'q10', text: 'I regularly review my savings progress.' },
    ],
  },
  {
    id: 'C',
    title: 'Repayment Responsibility',
    questions: [
      { id: 'q11', text: 'I always try to repay my loans on time.' },
      { id: 'q12', text: 'Keeping a good credit reputation is important to me.' },
      { id: 'q13', text: 'I would rather reduce expenses than miss a loan payment.' },
      { id: 'q14', text: 'I inform lenders early if I anticipate repayment difficulties.' },
      { id: 'q15', text: 'I consider debt repayment a top financial priority.' },
    ],
  },
  {
    id: 'D',
    title: 'Planning & Organization',
    questions: [
      { id: 'q16', text: 'I plan my finances at least six months ahead.' },
      { id: 'q17', text: 'I think carefully before making major financial decisions.' },
      { id: 'q18', text: 'I compare financing options before borrowing.' },
      { id: 'q19', text: 'I consider future obligations before taking on new debt.' },
      { id: 'q20', text: 'I keep important financial documents organized.' },
    ],
  },
  {
    id: 'E',
    title: 'Self-Control & Impulse Management',
    questions: [
      { id: 'q21', text: 'I avoid impulse purchases.' },
      { id: 'q22', text: 'I rarely buy something immediately without thinking.' },
      { id: 'q23', text: 'I can delay gratification for long-term goals.' },
      { id: 'q24', text: 'I resist pressure to spend beyond my budget.' },
      { id: 'q25', text: 'I distinguish between wants and needs.' },
    ],
    note: 'Questions 21 and 22 may be reverse-worded in alternate assessment versions to reduce response bias.',
  },
  {
    id: 'F',
    title: 'Risk Awareness',
    questions: [
      { id: 'q26', text: 'I understand the risks before borrowing money.' },
      { id: 'q27', text: 'I read loan agreements carefully before signing.' },
      { id: 'q28', text: 'I avoid taking financial risks I do not understand.' },
      { id: 'q29', text: 'I consider worst-case scenarios before making financial commitments.' },
      { id: 'q30', text: 'I prefer stable finances over risky opportunities.' },
    ],
  },
  {
    id: 'G',
    title: 'Integrity & Consistency',
    questions: [
      { id: 'q31', text: 'I always provide accurate information in financial applications.' },
      { id: 'q32', text: 'I would never hide important financial information from a lender.' },
      { id: 'q33', text: 'I believe honesty is more important than getting a loan quickly.' },
      { id: 'q34', text: 'I admit mistakes and try to correct them.' },
      { id: 'q35', text: 'I believe financial commitments should always be honored.' },
    ],
  },
  {
    id: 'H',
    title: 'Employment & Career Mindset',
    questions: [
      { id: 'q36', text: 'I continuously improve my professional skills.' },
      { id: 'q37', text: 'I value long-term employment stability.' },
      { id: 'q38', text: 'I actively plan my career growth.' },
      { id: 'q39', text: 'I maintain good relationships with employers or clients.' },
      { id: 'q40', text: 'I strive to maintain a reliable source of income.' },
    ],
  },
  {
    id: 'I',
    title: 'Stress & Financial Resilience',
    questions: [
      { id: 'q41', text: 'I remain calm when facing financial challenges.' },
      { id: 'q42', text: 'I look for practical solutions instead of avoiding financial problems.' },
      { id: 'q43', text: 'I seek advice before making difficult financial decisions.' },
      { id: 'q44', text: 'I believe I can recover from temporary financial setbacks.' },
      { id: 'q45', text: 'I adjust my spending when my income changes.' },
    ],
  },
  {
    id: 'J',
    title: 'Social Responsibility & Community Stability',
    questions: [
      { id: 'q46', text: 'I support my family within my financial means.' },
      { id: 'q47', text: 'I fulfill my responsibilities to people who depend on me.' },
      { id: 'q48', text: 'I value maintaining a good reputation in my community.' },
      { id: 'q49', text: 'I avoid actions that could damage my financial credibility.' },
      { id: 'q50', text: 'I believe financial responsibility is an important personal value.' },
    ],
  },
];

const totalQuestions = psychometricSections.reduce(
  (count, section) => count + section.questions.length,
  0,
);
const maxSectionScore = 20;
const maxRawScore = 200;

const buildInitialResponses = () =>
  psychometricSections.flatMap((section) => section.questions).reduce<Record<string, string>>(
    (responses, question) => {
      responses[question.id] = '';
      return responses;
    },
    {},
  );

const getReadinessLabel = (score: number) => {
  if (score >= 85) {
    return 'Very Strong';
  }

  if (score >= 70) {
    return 'Strong';
  }

  if (score >= 55) {
    return 'Moderate';
  }

  if (score >= 40) {
    return 'Watchlist';
  }

  return 'High Attention';
};

function CreditScoring() {
  const [responses, setResponses] = useState<Record<string, string>>(() => buildInitialResponses());

  const sectionSummaries = useMemo(
    () =>
      psychometricSections.map((section) => {
        const answeredCount = section.questions.filter((question) => responses[question.id]).length;
        const rawScore = section.questions.reduce(
          (sum, question) => sum + (responseScoreMap[responses[question.id]] ?? 0),
          0,
        );
        const normalizedScore = (rawScore / maxSectionScore) * 100;

        return {
          ...section,
          answeredCount,
          rawScore,
          normalizedScore,
        };
      }),
    [responses],
  );

  const answeredQuestions = useMemo(
    () => Object.values(responses).filter(Boolean).length,
    [responses],
  );

  const rawScore = useMemo(
    () => sectionSummaries.reduce((sum, section) => sum + section.rawScore, 0),
    [sectionSummaries],
  );

  const normalizedScore = (rawScore / maxRawScore) * 100;
  const completionRate = (answeredQuestions / totalQuestions) * 100;
  const readinessLabel = getReadinessLabel(normalizedScore);
  const scoreRingDegrees = Math.max(0, Math.min(360, (normalizedScore / 100) * 360));
  const scoreRingStyle = {
    background: `
      radial-gradient(circle at center, #fffef7 0 54%, transparent 55%),
      conic-gradient(#0f766e 0deg ${scoreRingDegrees}deg, rgba(226, 232, 240, 0.9) ${scoreRingDegrees}deg 360deg)
    `,
  };

  const handleResponseChange = (questionId: string, value: string) => {
    setResponses((current) => ({
      ...current,
      [questionId]: current[questionId] === value ? '' : value,
    }));
  };

  const handleReset = () => {
    setResponses(buildInitialResponses());
  };

  return (
    <div className="psychometric-page">
      <section className="psychometric-hero">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">FILSCORE Assessment Model</span>
          <h1>Psychometric Scoring</h1>
          <p>
            This page follows the FILSCORE psychometric questionnaire structure and applies your
            updated response scale of 0 to 4 across 10 sections with 5 questions each.
          </p>
        </div>

        <div className="psychometric-hero-metric">
          <span>Overall Score</span>
          <strong>{normalizedScore.toFixed(1)}</strong>
          <small>{readinessLabel}</small>
        </div>
      </section>

      <section className="psychometric-summary-grid">
        <article className="psychometric-summary-card psychometric-summary-card-highlight">
          <span>Completion</span>
          <strong>{answeredQuestions} / 50</strong>
          <small>{completionRate.toFixed(0)}% answered</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Raw Score</span>
          <strong>{rawScore}</strong>
          <small>Out of {maxRawScore}</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Section Maximum</span>
          <strong>{maxSectionScore}</strong>
          <small>5 questions x 4 points</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Assessment Model</span>
          <strong>10 Sections</strong>
          <small>50 questions normalized to 100</small>
        </article>
      </section>

      <section className="psychometric-layout">
        <div className="psychometric-main">
          <article className="psychometric-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Response Scale</span>
                <h2>Scoring guide used by this page</h2>
              </div>
              <button type="button" className="psychometric-reset-button" onClick={handleReset}>
                Reset Answers
              </button>
            </div>

            <div className="psychometric-scale-table-wrap">
              <table className="psychometric-scale-table">
                <thead>
                  <tr>
                    <th>Response</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {responseScale.map((option) => (
                    <tr key={option.label}>
                      <td>{option.label}</td>
                      <td>{option.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="psychometric-formula-grid">
              <div className="psychometric-formula-card">
                <span>Maximum per section</span>
                <strong>5 questions x 4 = 20</strong>
              </div>
              <div className="psychometric-formula-card">
                <span>Maximum total</span>
                <strong>10 x 20 = 200</strong>
              </div>
              <div className="psychometric-formula-card psychometric-formula-card-accent">
                <span>Normalization formula</span>
                <strong>Psychometric Score = (Raw Score / 200) x 100</strong>
              </div>
            </div>
          </article>

          <div className="psychometric-sections">
            {sectionSummaries.map((section, sectionIndex) => (
              <article key={section.id} className="psychometric-section-card">
                <div className="psychometric-section-header">
                  <div>
                    <span className="psychometric-section-code">Section {section.id}</span>
                    <h3>{section.title}</h3>
                    <p>
                      {section.answeredCount} of {section.questions.length} answered
                    </p>
                  </div>

                  <div className="psychometric-section-score">
                    <strong>
                      {section.rawScore} / {maxSectionScore}
                    </strong>
                    <span>{section.normalizedScore.toFixed(0)} / 100</span>
                  </div>
                </div>

                <div className="psychometric-progress-track" aria-hidden="true">
                  <div
                    className="psychometric-progress-bar"
                    style={{ width: `${(section.rawScore / maxSectionScore) * 100}%` }}
                  />
                </div>

                <div className="psychometric-question-list">
                  {section.questions.map((question, index) => (
                    <div key={question.id} className="psychometric-question-card">
                      <div className="psychometric-question-copy">
                        <span className="psychometric-question-number">
                          {index + 1 + sectionIndex * 5}
                        </span>
                        <p>{question.text}</p>
                      </div>

                      <div className="psychometric-option-grid">
                        {responseScale.map((option) => {
                          const isActive = responses[question.id] === option.label;

                          return (
                            <button
                              key={option.label}
                              type="button"
                              className={`psychometric-option-button${isActive ? ' psychometric-option-button-active' : ''}`}
                              onClick={() => handleResponseChange(question.id, option.label)}
                              aria-pressed={isActive}
                            >
                              <span>{option.label}</span>
                              <strong>{option.score}</strong>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {section.note ? <p className="psychometric-section-note">{section.note}</p> : null}
              </article>
            ))}
          </div>
        </div>

        <aside className="psychometric-side-panel">
          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Overall Computation</span>
            <h2>Score snapshot</h2>

            <div className="psychometric-score-ring" style={scoreRingStyle}>
              <strong>{normalizedScore.toFixed(1)}</strong>
              <span>/ 100</span>
            </div>

            <ul className="psychometric-breakdown-list">
              <li>
                <span>Raw score</span>
                <strong>{rawScore}</strong>
              </li>
              <li>
                <span>Maximum raw score</span>
                <strong>{maxRawScore}</strong>
              </li>
              <li>
                <span>Readiness band</span>
                <strong>{readinessLabel}</strong>
              </li>
              <li>
                <span>Sections completed</span>
                <strong>
                  {sectionSummaries.filter((section) => section.answeredCount === section.questions.length).length} / 10
                </strong>
              </li>
            </ul>
          </article>

          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Section Totals</span>
            <h2>Per-section results</h2>

            <ul className="psychometric-breakdown-list">
              {sectionSummaries.map((section) => (
                <li key={section.id}>
                  <span>
                    {section.id}. {section.title}
                  </span>
                  <strong>
                    {section.rawScore} / {maxSectionScore}
                  </strong>
                </li>
              ))}
            </ul>
          </article>
        </aside>
      </section>
    </div>
  );
}

export default CreditScoring;
