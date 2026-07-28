import type { NetWorthBuildingScoreResult } from './netWorthBuildingEngine'

export type AiAdvisory = {
  analysis: string[]
  recommendation: string
}

type AdvisoryInput = {
  score: NetWorthBuildingScoreResult
  amounts: Record<string, string | number | undefined>
  labels?: Record<string, string>
  currency?: string
  previousNetWorth?: number
}

const numberValue = (value: string | number | undefined) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

export function computeAiAdvisories({ score, amounts, labels = {}, currency = 'PHP', previousNetWorth }: AdvisoryInput): Record<string, AiAdvisory> {
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
  const formatSignedCurrency = (amount: number) => `${amount < 0 ? '-' : amount > 0 ? '+' : ''}${formatCurrency(Math.abs(amount))}`
  const entries = Object.entries(amounts).map(([id, value]) => ({ id, label: labels[id] ?? id, amount: numberValue(value) }))
  const largest = (prefix: string) => entries.filter((entry) => entry.id.startsWith(prefix) && entry.amount > 0).sort((left, right) => right.amount - left.amount)[0]
  const largestAsset = largest('asset-')
  const largestLiability = largest('liability-')
  const liquidityRatio = score.metrics.totalAssets > 0 ? (score.metrics.liquidAssets / score.metrics.totalAssets) * 100 : 0
  const netWorthChange = previousNetWorth === undefined ? null : score.metrics.netWorth - previousNetWorth
  const historyAnalysis = netWorthChange === null
    ? 'Previous-month data is not available in this profile, so month-over-month growth and the fastest-growing asset cannot yet be measured.'
    : `Net worth changed by ${formatSignedCurrency(netWorthChange)} from the previous recorded month.`
  const emergencyTarget = score.metrics.monthlyExpenses * 3
  const emergencyGap = Math.max(emergencyTarget - score.metrics.liquidAssets, 0)
  const projectedLabel = score.metrics.projectedNetWorthAtGoalDate !== score.metrics.netWorth
    ? formatSignedCurrency(score.metrics.projectedNetWorthAtGoalDate)
    : 'not available until a target period and positive cash flow are entered'

  return {
    'ai-net-worth': {
      analysis: [
        `Assets total ${formatCurrency(score.metrics.totalAssets)} versus liabilities of ${formatCurrency(score.metrics.totalLiabilities)}, producing net worth of ${formatSignedCurrency(score.metrics.netWorth)}.`,
        largestAsset ? `${largestAsset.label} is the largest current asset contributor at ${formatCurrency(largestAsset.amount)}.` : 'No asset contributor has been entered yet.',
        largestLiability ? `${largestLiability.label} is the largest liability reducing wealth at ${formatCurrency(largestLiability.amount)}.` : 'No liability is currently reducing wealth.',
        historyAnalysis,
        'Age-and-income peer benchmarking is pending because comparable demographic benchmark data is not stored in this profile.',
        `Projected net worth at the selected goal date is ${projectedLabel}.`,
      ],
      recommendation: `${largestAsset ? `${largestAsset.label} is the main concentration in the current asset mix. ` : ''}${score.metrics.totalLiabilities > 0 ? `Prioritize reducing ${largestLiability?.label ?? 'the largest liability'} while diversifying assets and preserving liquidity.` : 'Maintain diversification and convert positive cash flow into durable assets.'}`,
    },
    'ai-liquid-net-worth': {
      analysis: [
        `Liquid assets total ${formatCurrency(score.metrics.liquidAssets)}, equal to ${liquidityRatio.toFixed(1)}% of total assets.`,
        `Current reserves cover ${score.metrics.emergencyFundMonths.toFixed(1)} months of entered expenses.`,
        emergencyGap > 0 ? `An additional ${formatCurrency(emergencyGap)} would reach a three-month reserve.` : 'The current liquid reserve meets or exceeds three months of entered expenses.',
      ],
      recommendation: liquidityRatio < 10
        ? `Only ${liquidityRatio.toFixed(1)}% of assets are immediately liquid. Increase accessible cash reserves before adding illiquid commitments.`
        : `Liquidity is ${liquidityRatio.toFixed(1)}% of assets. Maintain an accessible reserve while balancing return and flexibility.`,
    },
    'ai-monthly-cash-flow': {
      analysis: [
        `Monthly income is ${formatCurrency(score.metrics.monthlyIncome)} and expenses are ${formatCurrency(score.metrics.monthlyExpenses)}.`,
        `The current monthly surplus is ${formatSignedCurrency(score.metrics.monthlyCashFlow)}.`,
        'Trend, seasonality, and income-stability analysis require additional monthly snapshots.',
      ],
      recommendation: score.metrics.monthlyCashFlow > 0
        ? `Cash flow is positive, with approximately ${formatCurrency(score.metrics.monthlyCashFlow)} available monthly. Automate reserves, debt reduction, and diversified investing.`
        : `Cash flow is not positive. Reduce recurring expenses or strengthen dependable income before taking on new commitments.`,
    },
    'ai-savings-rate': {
      analysis: [
        `${score.metrics.savingsRatePercent.toFixed(1)}% of entered monthly income remains after expenses.`,
        score.metrics.savingsRatePercent >= 20 ? 'The current rate is above the commonly used 20% savings guideline.' : 'The current rate is below the commonly used 20% savings guideline.',
        'Historical trend and peer comparison require prior snapshots and an approved benchmark dataset.',
      ],
      recommendation: score.metrics.savingsRatePercent >= 20
        ? `A ${score.metrics.savingsRatePercent.toFixed(1)}% savings rate is strong. Direct the surplus toward emergency reserves, retirement, and diversified investments.`
        : `Raise the ${score.metrics.savingsRatePercent.toFixed(1)}% savings rate gradually by controlling recurring expenses and automating contributions.`,
    },
    'ai-dti': {
      analysis: [
        `Annualized debt-to-income is ${score.metrics.debtToIncomeRatioPercent.toFixed(1)}% based on entered liabilities and monthly income.`,
        score.metrics.debtToIncomeRatioPercent <= 36 ? 'The ratio is within a commonly used lending affordability threshold.' : 'The ratio is above a commonly used lending affordability threshold and may constrain borrowing capacity.',
        'Final lending eligibility also depends on payment obligations, bureau history, product policy, and verified income.',
      ],
      recommendation: score.metrics.debtToIncomeRatioPercent <= 36
        ? `DTI of ${score.metrics.debtToIncomeRatioPercent.toFixed(1)}% indicates manageable leverage under the current inputs. Preserve capacity by limiting new debt.`
        : `DTI of ${score.metrics.debtToIncomeRatioPercent.toFixed(1)}% signals elevated debt burden. Reduce liabilities before seeking additional credit.`,
    },
    'ai-dta': {
      analysis: [
        `${score.metrics.debtToAssetRatioPercent.toFixed(1)}% of assets are offset by liabilities.`,
        score.metrics.debtToAssetRatioPercent <= 30 ? 'Current leverage supports a comparatively strong solvency position.' : 'Current leverage reduces balance-sheet resilience.',
      ],
      recommendation: score.metrics.debtToAssetRatioPercent <= 30
        ? `A ${score.metrics.debtToAssetRatioPercent.toFixed(1)}% debt-to-asset ratio indicates limited leverage risk. Keep debt growth below asset growth.`
        : `Reduce the ${score.metrics.debtToAssetRatioPercent.toFixed(1)}% leverage ratio by prioritizing high-cost liabilities and avoiding debt-funded asset concentration.`,
    },
    'ai-emergency-fund-months': {
      analysis: [
        `Liquid reserves cover ${score.metrics.emergencyFundMonths.toFixed(1)} months of current expenses.`,
        `A three-month reserve target is ${formatCurrency(emergencyTarget)} under the entered expense level.`,
        emergencyGap > 0 ? `The current three-month reserve gap is ${formatCurrency(emergencyGap)}.` : 'No three-month reserve gap is detected.',
      ],
      recommendation: score.metrics.emergencyFundMonths < 3
        ? `Coverage of ${score.metrics.emergencyFundMonths.toFixed(1)} months is below the common 3-6 month range. Build accessible reserves before increasing illiquid allocations.`
        : `Coverage of ${score.metrics.emergencyFundMonths.toFixed(1)} months meets the lower end of the common 3-6 month range. Review it when expenses change.`,
    },
    'ai-credit-health': {
      analysis: [
        `The wealth model's leverage-control proxy is ${score.componentScores.leverageControl.toFixed(0)}/100.`,
        'A complete Credit Health assessment also uses the FILSCORE credit score, bureau records, payment history, utilization, adverse events, and credit trend.',
        'Those credit-specific sources are not available inside this Wealth Position snapshot.',
      ],
      recommendation: `The current leverage proxy is ${score.componentScores.leverageControl.toFixed(0)}/100. Maintain timely payments and low utilization, and review the dedicated Credit Health score for lending probability and bureau analysis.`,
    },
    'ai-investment-readiness': {
      analysis: [
        `Investment Readiness is ${score.componentScores.investmentReadiness.toFixed(0)}/100, with ${score.metrics.investmentReadinessPercent.toFixed(1)}% of assets in investment or retirement accounts.`,
        `Monthly investable surplus is currently ${formatSignedCurrency(Math.max(score.metrics.monthlyCashFlow, 0))}.`,
        `Liquidity is ${liquidityRatio.toFixed(1)}% of assets; risk tolerance and time horizon require the separate suitability responses.`,
      ],
      recommendation: score.componentScores.investmentReadiness < 60
        ? `Readiness of ${score.componentScores.investmentReadiness.toFixed(0)}/100 needs improvement. Establish adequate liquidity, then build a diversified portfolio aligned with suitability and time horizon.`
        : `Readiness of ${score.componentScores.investmentReadiness.toFixed(0)}/100 supports planned investing. Preserve diversification and an emergency reserve.`,
    },
    'ai-retirement-readiness': {
      analysis: [
        `Retirement Readiness is ${score.componentScores.retirementReadiness.toFixed(0)}/100.`,
        `Entered retirement assets cover approximately ${score.metrics.retirementCoverageYears.toFixed(1)} years of current expenses before inflation and investment returns.`,
        'A retirement-age estimate and inflation-adjusted funding gap require age, contribution history, expected returns, and retirement assumptions.',
      ],
      recommendation: score.componentScores.retirementReadiness < 60
        ? `A ${score.componentScores.retirementReadiness.toFixed(0)}/100 score indicates a retirement funding gap. Increase recurring retirement contributions and review assumptions annually.`
        : `A ${score.componentScores.retirementReadiness.toFixed(0)}/100 score shows progress. Continue inflation-aware contributions and diversify retirement assets.`,
    },
    'ai-financial-independence-index': {
      analysis: [
        `Passive income currently covers ${score.metrics.financialIndependencePercent.toFixed(1)}% of monthly expenses.`,
        `The Financial Independence component score is ${score.componentScores.financialIndependence.toFixed(0)}/100.`,
        'Years to independence and FIRE sustainability require historical growth, withdrawal-rate, inflation, and return assumptions.',
      ],
      recommendation: `Increase recurring passive income relative to expenses and maintain diversified assets to improve the current ${score.componentScores.financialIndependence.toFixed(0)}/100 independence score.`,
    },
    'ai-overall-financial-wellness': {
      analysis: [
        `Overall Financial Wellness Rating: ${score.score} (Grade ${score.grade} - ${score.rating}).`,
        `Strength signals: savings ${score.metrics.savingsRatePercent.toFixed(1)}%, leverage ${score.metrics.debtToAssetRatioPercent.toFixed(1)}%, and monthly cash flow ${formatSignedCurrency(score.metrics.monthlyCashFlow)}.`,
        `Priority signals: emergency coverage ${score.metrics.emergencyFundMonths.toFixed(1)} months, investment readiness ${score.componentScores.investmentReadiness.toFixed(0)}/100, and retirement readiness ${score.componentScores.retirementReadiness.toFixed(0)}/100.`,
      ],
      recommendation: `You are currently rated ${score.grade} - ${score.rating}. Prioritize liquidity, retirement contributions, and diversified investing while preserving positive cash flow and controlled leverage.`,
    },
  }
}