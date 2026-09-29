export const STEP_9_EDITED_PREFIX = 'wealthTargetEdited.'

export function initializeStep9DesiredTargets(
  values: Record<string, string>,
  entryIds: string[],
): Record<string, string> {
  if (values.wealthSetupSaved === 'true') return values

  const initializedValues = { ...values }
  entryIds.forEach((entryId) => {
    const existingTarget = values[`wealthActual.${entryId}`]
    if (values[`${STEP_9_EDITED_PREFIX}${entryId}`] === 'true' || (existingTarget?.trim() && Number(existingTarget) !== 0)) return
    initializedValues[`wealthActual.${entryId}`] = values[entryId] ?? '0'
  })

  if (!initializedValues.wealthActualAsOfDate?.trim() && values.asOfDate?.trim()) {
    initializedValues.wealthActualAsOfDate = values.asOfDate
  }

  return initializedValues
}