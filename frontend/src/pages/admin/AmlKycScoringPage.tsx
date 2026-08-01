import { useMemo, useState } from 'react'

import { AML_QUESTIONS, computeAmlRiskAssessment } from './amlKycScoringEngine'

const initialAnswers = Object.fromEntries(AML_QUESTIONS.map((question) => [question.id, '']))

export default function AmlKycScoringPage() {
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers)
  const result = useMemo(() => computeAmlRiskAssessment(answers), [answers])

  return (
    <div className="psychometric-page aml-kyc-page">
      <section className="psychometric-hero aml-kyc-hero" aria-labelledby="aml-kyc-title">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">Administration</span>
          <h1 id="aml-kyc-title">AML / KYC Risk Assessment</h1>
          <p>Complete the ten screening sections to calculate the customer AML risk classification and due-diligence requirement.</p>
        </div>
        <div className="aml-kyc-progress" aria-live="polite">
          <span>Assessment progress</span>
          <strong>{result.answeredCount} / {result.totalQuestions}</strong>
          <small>{result.complete ? 'Ready for review' : 'Complete every section'}</small>
        </div>
      </section>

      <section className="psychometric-panel aml-kyc-scorecard" aria-labelledby="aml-scorecard-title">
        <div className="psychometric-panel-header">
          <div>
            <span className="psychometric-panel-kicker">Customer screening</span>
            <h2 id="aml-scorecard-title">AML Risk Scorecard</h2>
          </div>
          <button
            type="button"
            className="psychometric-reset-button"
            onClick={() => setAnswers(initialAnswers)}
          >
            Reset Assessment
          </button>
        </div>

        <div className="aml-kyc-question-grid">
          {AML_QUESTIONS.map((question, index) => (
            <label key={question.id} className="aml-kyc-question">
              <span className="aml-kyc-question-number">Section {index + 1}</span>
              <strong>{question.section}</strong>
              <span>{question.question}</span>
              <select
                aria-label={question.section}
                value={answers[question.id]}
                onChange={(event) => setAnswers((current) => ({
                  ...current,
                  [question.id]: event.target.value,
                }))}
              >
                <option value="">Select an answer</option>
                {question.options.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>

      <section className="psychometric-panel aml-kyc-result" aria-labelledby="aml-result-title" aria-live="polite">
        <div>
          <span className="psychometric-panel-kicker">Assessment result</span>
          <h2 id="aml-result-title">AML Risk Classification</h2>
        </div>
        {result.complete ? (
          <div className="aml-kyc-result-grid">
            <div><span>AML Score</span><strong>{result.score} / 100</strong></div>
            <div><span>Risk Classification</span><strong>{result.classification}</strong></div>
            <div><span>Due Diligence</span><strong>{result.dueDiligence}</strong></div>
          </div>
        ) : (
          <p>Complete all ten sections to calculate the AML score and risk classification.</p>
        )}
      </section>
    </div>
  )
}