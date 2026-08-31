import type { ProfileHistoryRecord } from '../../api'
import type { FinancialHealthSummaryResult } from './financialHealthSummaryEngine'

export type FinancialHealthSnapshotAmounts = {
  netWorth: number
  netIncome: number
  monthlyCashFlow: number
  totalAssets: number
  totalLiabilities: number
}

export type FinancialHealthSnapshotPayload = {
  schemaVersion: 1
  modelVersion: 'financial-health-v1'
  reportingMonth: string
  score: number
  index: number
  indicators: Array<{ id: string; label: string; score: number; weight: number }>
  amounts: FinancialHealthSnapshotAmounts
}

export type FinancialHealthSnapshot = ProfileHistoryRecord & {
  payload: FinancialHealthSnapshotPayload
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function currentReportingMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function reportingMonthEnd(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) throw new Error('Invalid reporting month')
  const year = Number(match[1])
  const monthIndex = Number(match[2])
  if (monthIndex < 1 || monthIndex > 12) throw new Error('Invalid reporting month')
  return new Date(Date.UTC(year, monthIndex, 0, 23, 59, 59, 999)).toISOString()
}

export function formatReportingMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, monthNumber - 1, 1)))
}

export function buildFinancialHealthSnapshotPayload(
  reportingMonth: string,
  summary: FinancialHealthSummaryResult,
  amounts: FinancialHealthSnapshotAmounts,
): FinancialHealthSnapshotPayload {
  return {
    schemaVersion: 1,
    modelVersion: 'financial-health-v1',
    reportingMonth,
    score: summary.score,
    index: summary.index,
    indicators: summary.indicators.map(({ id, label, score, weight }) => ({ id, label, score, weight })),
    amounts,
  }
}

export function parseFinancialHealthSnapshot(record: ProfileHistoryRecord): FinancialHealthSnapshot | null {
  const payload = record.payload
  if (!payload || typeof payload !== 'object') return null
  const value = payload as Partial<FinancialHealthSnapshotPayload>
  if (
    value.schemaVersion !== 1
    || value.modelVersion !== 'financial-health-v1'
    || typeof value.reportingMonth !== 'string'
    || !/^\d{4}-\d{2}$/.test(value.reportingMonth)
    || !isFiniteNumber(value.score)
    || !isFiniteNumber(value.index)
    || !Array.isArray(value.indicators)
    || !value.amounts
  ) return null
  const validIndicators = value.indicators.every((indicator) =>
    indicator
    && typeof indicator.id === 'string'
    && typeof indicator.label === 'string'
    && isFiniteNumber(indicator.score)
    && isFiniteNumber(indicator.weight),
  )
  const amounts = value.amounts as Partial<FinancialHealthSnapshotAmounts>
  if (!validIndicators || ![
    amounts.netWorth,
    amounts.netIncome,
    amounts.monthlyCashFlow,
    amounts.totalAssets,
    amounts.totalLiabilities,
  ].every(isFiniteNumber)) return null
  return record as FinancialHealthSnapshot
}