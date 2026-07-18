import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import { useAutosaveDraft } from '../../autosave';
import { useLoanApplicationsMetrics } from '../../hooks/useLoanApplicationsMetrics';
import { buildBillReminderSnapshot } from './liveTrackerMetrics';

type WorkflowStep = 1 | 2 | 3;
type BillerFrequency = 'Monthly' | 'Quarterly' | 'Semi-Annual' | 'Annual' | 'Weekly';

type BillerSetup = {
  id: string;
  company: string;
  utilityType: string;
  estimatedDueDay: string;
  emailReminder10DaysBefore: boolean;
  frequency: BillerFrequency;
  dateCovered: string;
  budgetedAmount: number;
};

interface BillReminderDraft {
  step: WorkflowStep;
  periodStart: string;
  periodEnd: string;
  draftBillers: BillerSetup[];
  billerAllocationDraft: Record<string, string>;
  editingBillerId: string | null;
  company: string;
  utilityType: string;
  estimatedDueDay: string;
  emailReminder10DaysBefore: boolean;
  frequency: BillerFrequency;
  budgetedAmount: string;
  savedSetup: BillerSetup[];
  actualEntries: Record<string, string>;
  varianceNotes: Record<string, string>;
  step3RecordSavedAt: string;
  isBaselineAllocationFixed: boolean;
}

const DEFAULT_BILL_REMINDER_DRAFT: BillReminderDraft = {
  step: 1,
  periodStart: '',
  periodEnd: '',
  draftBillers: [],
  billerAllocationDraft: {},
  editingBillerId: null,
  company: '',
  utilityType: '',
  estimatedDueDay: '',
  emailReminder10DaysBefore: false,
  frequency: 'Monthly',
  budgetedAmount: '',
  savedSetup: [],
  actualEntries: {},
  varianceNotes: {},
  step3RecordSavedAt: '',
  isBaselineAllocationFixed: false,
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatSignedCurrency(amount: number) {
  const absoluteAmount = formatCurrency(Math.abs(amount));
  if (amount > 0) {
    return `+${absoluteAmount}`;
  }
  if (amount < 0) {
    return `-${absoluteAmount}`;
  }
  return absoluteAmount;
}

function toSafeNumber(rawValue: string | number | undefined) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function isBlank(rawValue: string | undefined) {
  return (rawValue ?? '').trim() === '';
}

function formatPercentInput(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '';
  }

  return value.toFixed(2).replace(/\.00$/, '');
}

function formatEstimatedDueDayLabel(rawValue: string | undefined) {
  const trimmed = (rawValue ?? '').trim();
  const day = Number(trimmed);

  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return trimmed || 'Not set';
  }

  const lastTwoDigits = day % 100;
  const lastDigit = day % 10;
  let suffix = 'th';

  if (lastTwoDigits < 11 || lastTwoDigits > 13) {
    if (lastDigit === 1) {
      suffix = 'st';
    } else if (lastDigit === 2) {
      suffix = 'nd';
    } else if (lastDigit === 3) {
      suffix = 'rd';
    }
  }

  return `${day}${suffix} of the month`;
}

function getBillerStatus(dateCovered: string) {
  const now = new Date();
  const due = new Date(dateCovered);
  if (Number.isNaN(due.getTime())) {
    return {
      id: 'watch' as const,
      label: 'Date Needed',
      note: 'Update coverage date',
      daysUntil: Number.NaN,
    };
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const daysUntil = Math.round((startOfDue - startOfNow) / msPerDay);

  if (daysUntil < 0) {
    return {
      id: 'attention' as const,
      label: 'Past Due',
      note: `${Math.abs(daysUntil)} day(s) overdue`,
      daysUntil,
    };
  }

  if (daysUntil <= 5) {
    return {
      id: 'watch' as const,
      label: 'Due Soon',
      note: `${daysUntil} day(s) remaining`,
      daysUntil,
    };
  }

  return {
    id: 'maintain' as const,
    label: 'On Track',
    note: `${daysUntil} day(s) until due date`,
    daysUntil,
  };
}

function buildVarianceExplanation(variance: number) {
  if (variance === 0) {
    return 'On budget target';
  }
  return variance > 0
    ? 'Actual payment is above budgeted amount'
    : 'Actual payment is below budgeted amount';
}

function buildAiVarianceReason(utilityType: string, variance: number) {
  if (variance <= 0) {
    return 'No over-budget alert from AI for this biller in the current cycle.';
  }

  const lowerType = utilityType.toLowerCase();

  if (lowerType.includes('electric')) {
    return 'AI reason: Higher usage from cooling appliances or tariff adjustments may have increased the electric bill.';
  }
  if (lowerType.includes('water')) {
    return 'AI reason: Leak-related wastage, seasonal demand, or utility rate changes may have increased the water bill.';
  }
  if (lowerType.includes('internet') || lowerType.includes('mobile') || lowerType.includes('telco')) {
    return 'AI reason: Overage charges, add-on services, or plan repricing may have increased telecom-related charges.';
  }
  if (lowerType.includes('loan') || lowerType.includes('amortization') || lowerType.includes('mortgage')) {
    return 'AI reason: Interest repricing, penalties, or additional principal servicing may have increased amortization outflow.';
  }
  if (lowerType.includes('insurance')) {
    return 'AI reason: Premium adjustments, riders, or policy updates may have increased insurance due amounts.';
  }

  return 'AI reason: A usage spike, pricing update, penalties, or one-time charges may explain this higher-than-budget payment.';
}

function SaveCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ width: '18px', height: '18px' }}>
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor" />
    </svg>
  );
}

export default function BillReminderPage() {
  const { applications, error, lastUpdated, loading, reload } = useLoanApplicationsMetrics();
  const snapshot = useMemo(
    () => buildBillReminderSnapshot(applications),
    [applications],
  );

  const [step, setStep] = useState<WorkflowStep>(1);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const [draftBillers, setDraftBillers] = useState<BillerSetup[]>([]);
  const [billerAllocationDraft, setBillerAllocationDraft] = useState<Record<string, string>>({});
  const [editingBillerId, setEditingBillerId] = useState<string | null>(null);

  const [company, setCompany] = useState('');
  const [utilityType, setUtilityType] = useState('');
  const [estimatedDueDay, setEstimatedDueDay] = useState('');
  const [emailReminder10DaysBefore, setEmailReminder10DaysBefore] = useState(false);
  const [frequency, setFrequency] = useState<BillerFrequency>('Monthly');
  const [budgetedAmount, setBudgetedAmount] = useState('');

  const [savedSetup, setSavedSetup] = useState<BillerSetup[]>([]);
  const [actualEntries, setActualEntries] = useState<Record<string, string>>({});
  const [varianceNotes, setVarianceNotes] = useState<Record<string, string>>({});
  const [step3RecordSavedAt, setStep3RecordSavedAt] = useState('');
  const [isBaselineAllocationFixed, setIsBaselineAllocationFixed] = useState(false);
  const [setupStatusMessage, setSetupStatusMessage] = useState('');

  const autosaveValue = useMemo<BillReminderDraft>(() => ({
    step,
    periodStart,
    periodEnd,
    draftBillers,
    billerAllocationDraft,
    editingBillerId,
    company,
    utilityType,
    estimatedDueDay,
    emailReminder10DaysBefore,
    frequency,
    budgetedAmount,
    savedSetup,
    actualEntries,
    varianceNotes,
    step3RecordSavedAt,
    isBaselineAllocationFixed,
  }), [
    actualEntries,
    budgetedAmount,
    company,
    draftBillers,
    billerAllocationDraft,
    estimatedDueDay,
    emailReminder10DaysBefore,
    editingBillerId,
    frequency,
    periodEnd,
    periodStart,
    savedSetup,
    step,
    step3RecordSavedAt,
    isBaselineAllocationFixed,
    utilityType,
    varianceNotes,
  ]);

  const handleAutosaveHydrate = useCallback((draft: BillReminderDraft) => {
    setStep(draft.step);
    setPeriodStart(draft.periodStart);
    setPeriodEnd(draft.periodEnd);
    setDraftBillers(draft.draftBillers);
    setBillerAllocationDraft(draft.billerAllocationDraft ?? {});
    setEditingBillerId(draft.editingBillerId);
    setCompany(draft.company);
    setUtilityType(draft.utilityType);
    setEstimatedDueDay(draft.estimatedDueDay ?? '');
    setEmailReminder10DaysBefore(draft.emailReminder10DaysBefore ?? false);
    setFrequency(draft.frequency);
    setBudgetedAmount(draft.budgetedAmount);
    setSavedSetup(draft.savedSetup);
    setActualEntries(draft.actualEntries);
    setVarianceNotes(draft.varianceNotes);
    setStep3RecordSavedAt(draft.step3RecordSavedAt ?? '');
    setIsBaselineAllocationFixed(draft.isBaselineAllocationFixed ?? false);
  }, []);

  useAutosaveDraft({
    scope: 'bill-reminder',
    entityKey: 'primary',
    value: autosaveValue,
    defaults: DEFAULT_BILL_REMINDER_DRAFT,
    onHydrate: handleAutosaveHydrate,
  });

  const workflowSteps: Array<{ id: WorkflowStep; label: string; description: string }> = [
    {
      id: 1,
      label: 'Choose Period Covered',
      description: 'Select covered dates for this workflow.',
    },
    {
      id: 2,
      label: 'Set Up Baseline',
      description: 'Enter setup values before saving.',
    },
    {
      id: 3,
      label: 'Actual vs Setup Variance',
      description: 'Enter actual values and review variance.',
    },
  ];

  const currentStepLabel = workflowSteps.find((item) => item.id === step)?.label ?? 'Bill Workflow';
  const completionPercent = Math.round((step / workflowSteps.length) * 100);
  const stepperButtonClass = 'loan-stepper-button';

  const stepCompletionById = useMemo<Record<WorkflowStep, number>>(() => {
    const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

    const periodFieldsCompleted = [periodStart, periodEnd].filter((value) => !isBlank(value)).length;
    const periodCompletion = periodFieldsCompleted / 2;

    const billerCompletion = draftBillers.length === 0
      ? 0
      : draftBillers.reduce((sum, biller) => {
        const completedFields = [
          !isBlank(biller.company),
          !isBlank(biller.utilityType),
          !isBlank(biller.estimatedDueDay),
          !isBlank(biller.dateCovered),
          biller.budgetedAmount > 0,
        ].filter(Boolean).length;
        return sum + (completedFields / 5);
      }, 0) / draftBillers.length;

    const step1Percent = clamp(((periodCompletion * 0.4) + (billerCompletion * 0.6)) * 100);

    const allocationProvided = draftBillers.some((biller) => !isBlank(billerAllocationDraft[biller.id]));
    const allocationTotal = draftBillers.reduce((sum, biller) => {
      return sum + toSafeNumber(billerAllocationDraft[biller.id] ?? '');
    }, 0);
    const allocationBalanced = draftBillers.length === 0 || Math.abs(100 - allocationTotal) < 0.01;
    const hasDraftBillers = draftBillers.length > 0;
    const setupSaved = savedSetup.length > 0;
    const baselineFixed = isBaselineAllocationFixed;
    const baselineChecks = [hasDraftBillers, allocationProvided, allocationBalanced, setupSaved].filter(Boolean).length;
    const step2Percent = (setupSaved && baselineFixed) ? 100 : clamp((baselineChecks / 4) * 100);

    const setupCount = savedSetup.length;
    const actualCompleted = setupCount > 0
      ? savedSetup.filter((biller) => !isBlank(actualEntries[biller.id])).length / setupCount
      : 0;
    const notesCompleted = setupCount > 0
      ? savedSetup.filter((biller) => !isBlank(varianceNotes[biller.id])).length / setupCount
      : 0;
    const hasSavedVarianceRecord = !isBlank(step3RecordSavedAt);
    const step3Percent = setupCount === 0
      ? 0
      : clamp(((actualCompleted * 0.7) + (notesCompleted * 0.2) + (hasSavedVarianceRecord ? 0.1 : 0)) * 100);

    return {
      1: step1Percent,
      2: step2Percent,
      3: step3Percent,
    };
  }, [
    actualEntries,
    billerAllocationDraft,
    draftBillers,
    periodEnd,
    periodStart,
    savedSetup,
    isBaselineAllocationFixed,
    step3RecordSavedAt,
    varianceNotes,
  ]);

  const draftCards = useMemo(
    () =>
      [...draftBillers]
        .map((biller) => ({
          ...biller,
          status: getBillerStatus(biller.dateCovered),
        }))
        .sort((left, right) => {
          const leftDays = Number.isNaN(left.status.daysUntil) ? Number.POSITIVE_INFINITY : left.status.daysUntil;
          const rightDays = Number.isNaN(right.status.daysUntil) ? Number.POSITIVE_INFINITY : right.status.daysUntil;
          return leftDays - rightDays;
        }),
    [draftBillers],
  );

  const dueSoonCount = useMemo(
    () => draftCards.filter((biller) => biller.status.id === 'watch').length,
    [draftCards],
  );
  const pastDueCount = useMemo(
    () => draftCards.filter((biller) => biller.status.id === 'attention').length,
    [draftCards],
  );

  const draftBudgetTotal = useMemo(
    () => draftBillers.reduce((sum, biller) => sum + biller.budgetedAmount, 0),
    [draftBillers],
  );

  const savedBudgetTotal = useMemo(
    () => savedSetup.reduce((sum, biller) => sum + biller.budgetedAmount, 0),
    [savedSetup],
  );

  useEffect(() => {
    if (draftBillers.length === 0) {
      if (Object.keys(billerAllocationDraft).length > 0) {
        setBillerAllocationDraft({});
      }
      return;
    }

    const totalBudget = draftBillers.reduce((sum, biller) => sum + biller.budgetedAmount, 0);
    const nextDraft = draftBillers.reduce<Record<string, string>>((accumulator, biller) => {
      const existingValue = billerAllocationDraft[biller.id];
      if (existingValue !== undefined) {
        accumulator[biller.id] = existingValue;
        return accumulator;
      }

      const share = totalBudget > 0 ? (biller.budgetedAmount / totalBudget) * 100 : 0;
      accumulator[biller.id] = formatPercentInput(share);
      return accumulator;
    }, {});

    const changed = draftBillers.length !== Object.keys(billerAllocationDraft).length
      || draftBillers.some((biller) => billerAllocationDraft[biller.id] !== nextDraft[biller.id]);

    if (changed) {
      setBillerAllocationDraft(nextDraft);
    }
  }, [billerAllocationDraft, draftBillers]);

  const billerAllocationSummary = useMemo(() => {
    const totalAllocation = draftBillers.reduce((sum, biller) => {
      return sum + toSafeNumber(billerAllocationDraft[biller.id] ?? '');
    }, 0);

    const varianceToTarget = Number((100 - totalAllocation).toFixed(2));

    return {
      totalAllocation: Number(totalAllocation.toFixed(2)),
      varianceToTarget,
      isBalanced: draftBillers.length === 0 || Math.abs(varianceToTarget) < 0.01,
    };
  }, [billerAllocationDraft, draftBillers]);

  const resetForm = () => {
    setEditingBillerId(null);
    setCompany('');
    setUtilityType('');
    setEstimatedDueDay('');
    setEmailReminder10DaysBefore(false);
    setFrequency('Monthly');
    setBudgetedAmount('');
  };

  const handleAddBiller = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!company.trim() || !utilityType.trim() || isBlank(estimatedDueDay) || isBlank(budgetedAmount)) {
      return;
    }

    const budgetAmount = toSafeNumber(budgetedAmount);

    if (editingBillerId) {
      setDraftBillers((previous) =>
        previous.map((biller) =>
          biller.id === editingBillerId
            ? {
                ...biller,
                company: company.trim(),
                utilityType: utilityType.trim(),
                estimatedDueDay: estimatedDueDay.trim(),
                emailReminder10DaysBefore,
                frequency,
                budgetedAmount: budgetAmount,
              }
            : biller,
        ),
      );
      resetForm();
      return;
    }

    const fallbackCoveredDate = periodEnd || periodStart || new Date().toISOString().slice(0, 10);

    setDraftBillers((previous) => {
      const nextId = `${Date.now()}-${previous.length + 1}`;
      return [
        ...previous,
        {
          id: nextId,
        company: company.trim(),
        utilityType: utilityType.trim(),
        estimatedDueDay: estimatedDueDay.trim(),
        emailReminder10DaysBefore,
        frequency,
        dateCovered: fallbackCoveredDate,
        budgetedAmount: budgetAmount,
        },
      ];
    });

    resetForm();
  };

  const handleNormalizeBillerAllocation = () => {
    const currentTotal = draftBillers.reduce((sum, biller) => {
      return sum + toSafeNumber(billerAllocationDraft[biller.id] ?? '');
    }, 0);

    if (currentTotal <= 0) {
      setSetupStatusMessage('Enter biller allocation percentages first before normalizing to 100%.');
      return;
    }

    let runningTotal = 0;
    const normalized = draftBillers.reduce<Record<string, string>>((accumulator, biller, index) => {
      if (index === draftBillers.length - 1) {
        accumulator[biller.id] = formatPercentInput(Math.max(0, 100 - runningTotal));
        return accumulator;
      }

      const nextValue = Number(((toSafeNumber(billerAllocationDraft[biller.id] ?? '') / currentTotal) * 100).toFixed(2));
      runningTotal += nextValue;
      accumulator[biller.id] = formatPercentInput(nextValue);
      return accumulator;
    }, {});

    setBillerAllocationDraft(normalized);
    setSetupStatusMessage('Biller allocation percentages were normalized to 100%.');
  };

  const handleApplyBillerAllocation = () => {
    if (!billerAllocationSummary.isBalanced) {
      setSetupStatusMessage(`Biller allocation must total 100%. Current variance is ${billerAllocationSummary.varianceToTarget.toFixed(2)}%.`);
      return;
    }

    if (draftBudgetTotal <= 0) {
      setSetupStatusMessage('Add billers with budgeted amounts first before applying revised allocation percentages.');
      return;
    }

    let allocatedTotal = 0;
    setDraftBillers((previous) => previous.map((biller, index) => {
      if (index === previous.length - 1) {
        return {
          ...biller,
          budgetedAmount: Number((draftBudgetTotal - allocatedTotal).toFixed(2)),
        };
      }

      const nextAmount = Number(((draftBudgetTotal * toSafeNumber(billerAllocationDraft[biller.id] ?? '')) / 100).toFixed(2));
      allocatedTotal += nextAmount;
      return {
        ...biller,
        budgetedAmount: nextAmount,
      };
    }));

    setSetupStatusMessage('Biller budgeted amounts were recalculated using the revised allocation percentages.');
  };

  const handleSaveSetup = () => {
    if (!periodStart || !periodEnd) {
      setSetupStatusMessage('Please complete period covered before saving this setup.');
      setStep(1);
      return;
    }

    if (draftBillers.length === 0) {
      setSetupStatusMessage('Please add at least one biller in Step 1 before saving setup.');
      setStep(1);
      return;
    }

    if (!billerAllocationSummary.isBalanced) {
      setSetupStatusMessage(`Biller allocation must stay at 100% before saving Step 2. Current variance is ${billerAllocationSummary.varianceToTarget.toFixed(2)}%.`);
      return;
    }

    setSavedSetup(
      draftBillers.map((biller) => ({
        ...biller,
      })),
    );
    setActualEntries({});
    setVarianceNotes({});
    setStep3RecordSavedAt('');
    setIsBaselineAllocationFixed(true);
    setSetupStatusMessage('Setup saved. Continue with Step 3 to enter actual values and monitor variance.');
    setStep(3);
  };

  const handleFixBaselineAllocation = () => {
    if (!periodStart || !periodEnd) {
      setSetupStatusMessage('Please complete period covered before fixing baseline allocation.');
      setStep(1);
      return;
    }

    if (draftBillers.length === 0) {
      setSetupStatusMessage('Please add at least one biller in Step 1 before fixing baseline allocation.');
      setStep(1);
      return;
    }

    if (!billerAllocationSummary.isBalanced) {
      setSetupStatusMessage(`Biller allocation must stay at 100% before fixing Step 2 baseline. Current variance is ${billerAllocationSummary.varianceToTarget.toFixed(2)}%.`);
      return;
    }

    setSavedSetup(
      draftBillers.map((biller) => ({
        ...biller,
      })),
    );
    setActualEntries({});
    setVarianceNotes({});
    setStep3RecordSavedAt('');
    setIsBaselineAllocationFixed(true);
    setSetupStatusMessage('Baseline allocation fixed. You can proceed to Step 3 and update actual values only.');
  };

  const handleUnfixBaselineAllocation = () => {
    setIsBaselineAllocationFixed(false);
    setSetupStatusMessage('Baseline allocation unlocked. You may now revise Step 2 setup and allocation.');
  };

  const handleSaveVarianceRecord = () => {
    const hasComputedVariance = varianceRows.some((row) => row.hasActual);
    if (!hasComputedVariance) {
      setSetupStatusMessage('Please enter at least one actual amount in Step 3 before saving the record.');
      return;
    }

    setStep3RecordSavedAt(new Date().toISOString());
    setSetupStatusMessage('Step 3 record saved successfully.');
  };

  const varianceRows = useMemo(() => {
    return savedSetup.map((biller) => {
      const rawActual = actualEntries[biller.id] ?? '';
      const hasActual = !isBlank(rawActual);
      const actualAmount = hasActual ? toSafeNumber(rawActual) : 0;
      const variance = hasActual ? actualAmount - biller.budgetedAmount : 0;

      return {
        ...biller,
        hasActual,
        actualAmount,
        variance,
      };
    });
  }, [savedSetup, actualEntries]);

  const setupVsActualTotals = useMemo(() => {
    const setupTotal = varianceRows.reduce((sum, row) => sum + row.budgetedAmount, 0);
    const actualTotal = varianceRows
      .filter((row) => row.hasActual)
      .reduce((sum, row) => sum + row.actualAmount, 0);

    return {
      setupTotal,
      actualTotal,
      netVariance: actualTotal - setupTotal,
    };
  }, [varianceRows]);

  const topVarianceRows = useMemo(() => {
    return varianceRows
      .filter((row) => row.hasActual)
      .map((row) => ({
        ...row,
        magnitude: Math.abs(row.variance),
      }))
      .sort((left, right) => right.magnitude - left.magnitude)
      .slice(0, 5);
  }, [varianceRows]);

  const maxVarianceMagnitude = useMemo(
    () => topVarianceRows.reduce((largest, row) => Math.max(largest, row.magnitude), 0),
    [topVarianceRows],
  );

  const billsPaymentHealthScore = useMemo(() => {
    if (!draftCards.length) {
      return 0;
    }

    const total = draftCards.reduce((sum, biller) => {
      if (biller.status.id === 'maintain') {
        return sum + 100;
      }
      if (biller.status.id === 'watch') {
        return sum + 65;
      }
      return sum + 25;
    }, 0);

    return total / draftCards.length;
  }, [draftCards]);

  const aiRecommendations = useMemo(() => {
    if (!varianceRows.length) {
      return ['Save your setup to generate bill variance recommendations.'];
    }

    const hasAnyActual = varianceRows.some((row) => row.hasActual);
    if (!hasAnyActual) {
      return ['Start entering actual bill payments in Step 3 to activate AI recommendations.'];
    }

    const priorityRows = varianceRows
      .filter((row) => row.hasActual && row.variance > 0)
      .sort((left, right) => right.variance - left.variance)
      .slice(0, 3);

    const suggestions = priorityRows.map((row) => {
      return `${row.company} (${row.utilityType}) is over budget by ${formatCurrency(row.variance)}. Consider pre-scheduling payment and revising monthly allocation.`;
    });

    if (pastDueCount > 0) {
      suggestions.push('Settle past due billers first before discretionary payments to avoid late fees.');
    }

    if (suggestions.length === 0) {
      suggestions.push('Actual payments are within budgeted amounts. Keep variance explanations updated for each biller.');
    }

    suggestions.push(`Total bill variance is ${formatSignedCurrency(setupVsActualTotals.netVariance)} versus saved setup.`);

    return suggestions.slice(0, 4);
  }, [varianceRows, pastDueCount, setupVsActualTotals.netVariance]);

  return (
    <div className="psychometric-page bill-reminder-dashboard-page">
      <section className="psychometric-hero bill-reminder-dashboard-hero">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">Billing Workflow Controls</span>
          <h1>Bill Reminder</h1>
          <p>
            Period: <strong>{snapshot.periodLabel}</strong> | Date: <strong>{snapshot.dateLabel}</strong>
          </p>
          <p>
            Use a guided workflow to set period coverage, configure billers, save setup, and track actual
            payment variance with AI recommendations.
          </p>
        </div>

        <div className="psychometric-hero-metric bill-reminder-dashboard-scorecard">
          <span>Bills Payment Health Score</span>
          <strong>{billsPaymentHealthScore.toFixed(1)}</strong>
          <small>{`Step ${step}/${workflowSteps.length}: ${currentStepLabel}`}</small>
        </div>
      </section>

      <section className="psychometric-summary-grid budget-dashboard-summary-grid">
        <article className="psychometric-summary-card psychometric-summary-card-highlight">
          <span>Progress</span>
          <strong>{completionPercent}%</strong>
          <small>{currentStepLabel}</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Draft Billers</span>
          <strong>{draftBillers.length}</strong>
          <small>Configured in setup workflow</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Saved Setup</span>
          <strong>{savedSetup.length}</strong>
          <small>Available for variance tracking</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Budget Total</span>
          <strong>{formatCurrency(draftBudgetTotal)}</strong>
          <small>Current draft budgeted bill amount</small>
        </article>
      </section>

      <section className="budget-dashboard-layout">
        <div className="budget-dashboard-main">
          <article className="psychometric-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Workflow Form</span>
                <h2>{`Step ${step}: ${currentStepLabel}`}</h2>
              </div>
              <button
                type="button"
                className="psychometric-reset-button"
                onClick={reload}
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh Data'}
              </button>
            </div>

            {error ? (
              <p className="psychometric-section-note" role="alert">
                {error}
              </p>
            ) : null}

            <p className="psychometric-section-note">
              {snapshot.sourceLabel} | {snapshot.sourceApplicationNo}
              {lastUpdated ? ` | Updated ${lastUpdated.toLocaleString()}` : ''}
            </p>

            {setupStatusMessage ? (
              <div className="budget-workflow-status-banner" role="status">
                {setupStatusMessage}
              </div>
            ) : null}

            {step === 1 ? (
              <div className="budget-workflow-step-block">
                <h3 className="workflow-duplicate-step-title">Step 1: Choose Period Covered</h3>
                <p className="psychometric-section-note">
                  In this same step, choose period covered and encode biller setup including company,
                  utility type or amortization, estimated due date, frequency, and budgeted amount.
                </p>

                <div className="budget-workflow-grid-two">
                  <label>
                    Period Start
                    <input
                      type="date"
                      value={periodStart}
                      onChange={(event) => setPeriodStart(event.target.value)}
                    />
                  </label>
                  <label>
                    Period End
                    <input
                      type="date"
                      value={periodEnd}
                      onChange={(event) => setPeriodEnd(event.target.value)}
                    />
                  </label>
                </div>

                <form className="budget-workflow-income-grid" onSubmit={handleAddBiller}>
                  <label>
                    Company
                    <input
                      value={company}
                      onChange={(event) => setCompany(event.target.value)}
                      placeholder="Electric Company"
                      required
                    />
                  </label>

                  <label>
                    Utility Type or Amortization For
                    <input
                      value={utilityType}
                      onChange={(event) => setUtilityType(event.target.value)}
                      placeholder="Electricity or Home Loan Amortization"
                      required
                    />
                  </label>

                  <label>
                    Estimated Due Date (Day of Month)
                    <input
                      type="number"
                      min={1}
                      max={31}
                      step="1"
                      value={estimatedDueDay}
                      onChange={(event) => setEstimatedDueDay(event.target.value)}
                      placeholder="10"
                      required
                    />
                  </label>

                  <label>
                    Email Reminder (10 days before due date)
                    <input
                      type="checkbox"
                      checked={emailReminder10DaysBefore}
                      onChange={(event) => setEmailReminder10DaysBefore(event.target.checked)}
                    />
                  </label>

                  <label>
                    Frequency
                    <select
                      value={frequency}
                      onChange={(event) => setFrequency(event.target.value as BillerFrequency)}
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Semi-Annual">Semi-Annual</option>
                      <option value="Annual">Annual</option>
                      <option value="Weekly">Weekly</option>
                    </select>
                  </label>

                  <label>
                    Budgeted Amount
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={budgetedAmount}
                      onChange={(event) => setBudgetedAmount(event.target.value)}
                      placeholder="0"
                      required
                    />
                  </label>

                  <div className="budget-workflow-inline-actions">
                    <button type="submit" className="psychometric-reset-button">
                      {editingBillerId ? 'Update Biller' : 'Add Biller'}
                    </button>
                    {editingBillerId ? (
                      <button
                        type="button"
                        className="budget-dashboard-category-reset"
                        onClick={resetForm}
                      >
                        Cancel Edit
                      </button>
                    ) : null}
                  </div>
                </form>

                <div className="psychometric-scale-table-wrap">
                  <table className="psychometric-scale-table">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Utility / Amortization</th>
                        <th>Estimated Due Date</th>
                        <th>Email Reminder (10 Days Before)</th>
                        <th>Frequency</th>
                        <th>Budgeted Amount</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draftCards.map((biller) => (
                        <tr key={biller.id}>
                          <td data-label="Company">{biller.company}</td>
                          <td data-label="Utility / Amortization">{biller.utilityType}</td>
                          <td data-label="Estimated Due Date">{formatEstimatedDueDayLabel(biller.estimatedDueDay)}</td>
                          <td data-label="Email Reminder (10 Days Before)">
                            <input type="checkbox" checked={biller.emailReminder10DaysBefore} readOnly aria-label={`${biller.company} email reminder 10 days before due date`} />
                          </td>
                          <td data-label="Frequency">{biller.frequency}</td>
                          <td data-label="Budgeted Amount">{formatCurrency(biller.budgetedAmount)}</td>
                          <td data-label="Status">{biller.status.label}</td>
                          <td data-label="Actions">
                            <div className="budget-workflow-inline-actions">
                              <button
                                type="button"
                                className="budget-dashboard-category-reset"
                                onClick={() => {
                                  setEditingBillerId(biller.id);
                                  setCompany(biller.company);
                                  setUtilityType(biller.utilityType);
                                  setEstimatedDueDay(biller.estimatedDueDay ?? '');
                                  setEmailReminder10DaysBefore(Boolean(biller.emailReminder10DaysBefore));
                                  setFrequency(biller.frequency);
                                  setBudgetedAmount(String(biller.budgetedAmount));
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="budget-dashboard-category-reset"
                                onClick={() => {
                                  setDraftBillers((previous) => previous.filter((item) => item.id !== biller.id));
                                  if (editingBillerId === biller.id) {
                                    resetForm();
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {draftCards.length === 0 ? (
                        <tr>
                          <td colSpan={8}>No billers added yet. Add at least one setup line.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="budget-workflow-inline-actions">
                  <button type="button" className="psychometric-reset-button" onClick={() => setStep(2)}>
                    Continue to Step 2
                  </button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="budget-workflow-step-block">
                <h3 className="workflow-duplicate-step-title">Step 2: Set Up Baseline</h3>
                <p className="psychometric-section-note">
                  Review setup values, then click save. Saved lines will be shown in Step 3 first column for variance monitoring.
                </p>

                <div className="budget-dashboard-category-summary">
                  <div className="budget-dashboard-category-summary-card">
                    <span>Period Covered</span>
                    <strong>{periodStart && periodEnd ? `${periodStart} to ${periodEnd}` : 'Not set'}</strong>
                  </div>
                  <div className="budget-dashboard-category-summary-card">
                    <span>Biller Count</span>
                    <strong>{draftBillers.length}</strong>
                  </div>
                  <div className="budget-dashboard-category-summary-card">
                    <span>Budgeted Total</span>
                    <strong>{formatCurrency(draftBudgetTotal)}</strong>
                  </div>
                  <div className="budget-dashboard-category-summary-card">
                    <span>Allocation Total</span>
                    <strong>{billerAllocationSummary.totalAllocation.toFixed(2)}%</strong>
                  </div>
                </div>

                <p className="psychometric-section-note">
                  Revise each biller allocation percentage if needed. Total allocation must remain at 100% before saving Step 2.
                </p>

                <p className="psychometric-section-note" style={{ color: isBaselineAllocationFixed ? '#047857' : '#b45309' }}>
                  {isBaselineAllocationFixed
                    ? 'Baseline allocation is fixed. Step 2 setup is locked and Step 3 actual values are the only updates.'
                    : 'Baseline allocation is not fixed yet. Click "Fix Baseline Allocation" once ready.'}
                </p>

                <div className="psychometric-scale-table-wrap">
                  <table className="psychometric-scale-table">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Utility / Amortization</th>
                        <th>Estimated Due Date</th>
                        <th>Email Reminder (10 Days Before)</th>
                        <th>Frequency</th>
                        <th>Date Covered</th>
                        <th>Allocation %</th>
                        <th>Budgeted Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draftBillers.map((biller) => (
                        <tr key={biller.id}>
                          <td data-label="Company">{biller.company}</td>
                          <td data-label="Utility / Amortization">{biller.utilityType}</td>
                          <td data-label="Estimated Due Date">{formatEstimatedDueDayLabel(biller.estimatedDueDay)}</td>
                          <td data-label="Email Reminder (10 Days Before)">
                            <input type="checkbox" checked={biller.emailReminder10DaysBefore} readOnly aria-label={`${biller.company} baseline email reminder 10 days before due date`} />
                          </td>
                          <td data-label="Frequency">{biller.frequency}</td>
                          <td data-label="Date Covered">{biller.dateCovered || 'Not set'}</td>
                          <td data-label="Allocation %">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="0.01"
                              value={billerAllocationDraft[biller.id] ?? ''}
                              onChange={(event) => {
                                setBillerAllocationDraft((previous) => ({
                                  ...previous,
                                  [biller.id]: event.target.value,
                                }));
                              }}
                              className="budget-dashboard-category-input"
                              aria-label={`${biller.company} allocation percentage`}
                              disabled={isBaselineAllocationFixed}
                            />
                          </td>
                          <td data-label="Budgeted Amount">{formatCurrency(biller.budgetedAmount)}</td>
                        </tr>
                      ))}
                      {draftBillers.length === 0 ? (
                        <tr>
                          <td colSpan={8}>No billers to review yet.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="budget-workflow-inline-actions">
                  <button type="button" className="budget-dashboard-category-reset" onClick={() => setStep(1)} disabled={isBaselineAllocationFixed}>
                    Back to Step 1
                  </button>
                  <button type="button" className="budget-dashboard-category-reset" onClick={handleNormalizeBillerAllocation} disabled={isBaselineAllocationFixed}>
                    Normalize to 100%
                  </button>
                  <button type="button" className="budget-dashboard-category-reset" onClick={handleApplyBillerAllocation} disabled={isBaselineAllocationFixed}>
                    Apply Revised % Allocation
                  </button>
                  {isBaselineAllocationFixed ? (
                    <>
                      <button type="button" className="budget-dashboard-category-reset" onClick={handleUnfixBaselineAllocation}>
                        Unfix / Revise Baseline
                      </button>
                      <button type="button" className="psychometric-reset-button" onClick={() => setStep(3)}>
                        Continue to Step 3
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="budget-dashboard-category-reset" onClick={handleFixBaselineAllocation}>
                        Fix Baseline Allocation
                      </button>
                      <button
                        type="button"
                        className="psychometric-save-circle"
                        onClick={handleSaveSetup}
                        aria-label="Save setup and continue to step 3"
                      >
                        <SaveCheckIcon />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="budget-workflow-step-block">
                <h3 className="workflow-duplicate-step-title">Step 3: Actual vs Setup Variance</h3>
                <p className="psychometric-section-note">
                  First column shows saved setup. Second column is blank for user actuals. Third column shows variance.
                  Fourth column shows AI variance explanation and fifth column provides user variance explanation in small letters.
                </p>

                {savedSetup.length === 0 ? (
                  <p className="psychometric-section-note">
                    No saved setup yet. Complete Step 2 and click save setup first.
                  </p>
                ) : (
                  <div className="psychometric-scale-table-wrap">
                    <table className="psychometric-scale-table">
                      <thead>
                        <tr>
                          <th>Setup (Saved)</th>
                          <th>Actual (User Input)</th>
                          <th>Variance (B/W)</th>
                          <th>Variance Explanation by AI</th>
                          <th>Variance Explanation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {varianceRows.map((row) => (
                          <tr key={row.id}>
                            <td data-label="Setup (Saved)">
                              <strong>{row.company}</strong>
                              <div>{row.utilityType}</div>
                              <div>{formatEstimatedDueDayLabel(row.estimatedDueDay)}</div>
                              <div>{row.emailReminder10DaysBefore ? 'Email reminder: Enabled (10 days before)' : 'Email reminder: Disabled'}</div>
                              <div>{row.frequency}</div>
                              <div>{row.dateCovered || 'No date covered'}</div>
                              <div>{formatCurrency(row.budgetedAmount)}</div>
                            </td>
                            <td data-label="Actual (User Input)">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={actualEntries[row.id] ?? ''}
                                onChange={(event) => {
                                  setActualEntries((previous) => ({
                                    ...previous,
                                    [row.id]: event.target.value,
                                  }));
                                }}
                                placeholder="Enter actual payment"
                                aria-label={`${row.company} actual payment`}
                              />
                            </td>
                            <td
                              data-label="Variance (B/W)"
                              className={`bill-reminder-variance-cell ${row.hasActual ? (row.variance < 0 ? 'bill-reminder-variance-lower' : (row.variance > 0 ? 'bill-reminder-variance-higher' : 'bill-reminder-variance-neutral')) : 'bill-reminder-variance-pending'}`}
                            >
                              {row.hasActual ? formatSignedCurrency(row.variance) : 'Pending input'}
                            </td>
                            <td data-label="Variance Explanation by AI">
                              <small className="budget-workflow-variance-copy">
                                {row.hasActual
                                  ? buildAiVarianceReason(row.utilityType, row.variance)
                                  : 'Awaiting user actual amount to generate AI explanation.'}
                              </small>
                            </td>
                            <td data-label="Variance Explanation">
                              <small className="budget-workflow-variance-copy">
                                {row.hasActual
                                  ? (varianceNotes[row.id]?.trim() || buildVarianceExplanation(row.variance))
                                  : 'Awaiting user actual amount.'}
                              </small>
                              {row.hasActual ? (
                                <input
                                  type="text"
                                  value={varianceNotes[row.id] ?? ''}
                                  onChange={(event) => {
                                    setVarianceNotes((previous) => ({
                                      ...previous,
                                      [row.id]: event.target.value,
                                    }));
                                  }}
                                  placeholder="Optional explanation"
                                  aria-label={`${row.company} variance explanation`}
                                />
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="budget-workflow-inline-actions">
                  <button type="button" className="budget-dashboard-category-reset" onClick={() => setStep(2)}>
                    Back to Step 2
                  </button>
                  <button
                    type="button"
                    className="psychometric-save-circle"
                    onClick={handleSaveVarianceRecord}
                    aria-label="Save"
                  >
                    <SaveCheckIcon />
                  </button>
                </div>

                {step3RecordSavedAt ? (
                  <p className="psychometric-section-note">
                    Last saved: {new Date(step3RecordSavedAt).toLocaleString()}
                  </p>
                ) : null}
              </div>
            ) : null}
          </article>

          {step === 3 ? (
            <article className="psychometric-panel">
              <div className="psychometric-panel-header">
                <div>
                  <span className="psychometric-panel-kicker">AI Recommendations and Graphs</span>
                  <h2>Variance coaching for bill monitoring</h2>
                </div>
              </div>

              <div className="budget-workflow-ai-grid">
                <article className="budget-workflow-ai-card">
                  <h3>AI Recommendations</h3>
                  <ul className="psychometric-breakdown-list">
                    {aiRecommendations.map((item) => (
                      <li key={item}>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>

                <article className="budget-workflow-ai-card">
                  <h3>Setup vs Actual Graph</h3>
                  <div className="budget-workflow-graph-row">
                    <span>Saved Setup Total</span>
                    <div className="budget-workflow-graph-track">
                      <div
                        className="budget-workflow-graph-bar budget-workflow-graph-bar-setup"
                        style={{
                          width: `${Math.min(
                            100,
                            setupVsActualTotals.setupTotal > 0
                              ? (setupVsActualTotals.setupTotal / Math.max(setupVsActualTotals.setupTotal, setupVsActualTotals.actualTotal, 1)) * 100
                              : 0,
                          )}%`,
                        }}
                      />
                    </div>
                    <strong>{formatCurrency(setupVsActualTotals.setupTotal)}</strong>
                  </div>

                  <div className="budget-workflow-graph-row">
                    <span>Actual Total</span>
                    <div className="budget-workflow-graph-track">
                      <div
                        className="budget-workflow-graph-bar budget-workflow-graph-bar-warning"
                        style={{
                          width: `${Math.min(
                            100,
                            setupVsActualTotals.actualTotal > 0
                              ? (setupVsActualTotals.actualTotal / Math.max(setupVsActualTotals.setupTotal, setupVsActualTotals.actualTotal, 1)) * 100
                              : 0,
                          )}%`,
                        }}
                      />
                    </div>
                    <strong>{formatCurrency(setupVsActualTotals.actualTotal)}</strong>
                  </div>

                  <div className="budget-workflow-graph-row">
                    <span>Net Variance</span>
                    <div className="budget-workflow-graph-track">
                      <div
                        className={`budget-workflow-graph-bar ${setupVsActualTotals.netVariance > 0 ? 'budget-workflow-graph-bar-alert' : 'budget-workflow-graph-bar-actual'}`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.abs(setupVsActualTotals.netVariance) > 0
                              ? (Math.abs(setupVsActualTotals.netVariance) / Math.max(Math.abs(setupVsActualTotals.setupTotal), 1)) * 100
                              : 0,
                          )}%`,
                        }}
                      />
                    </div>
                    <strong>{formatSignedCurrency(setupVsActualTotals.netVariance)}</strong>
                  </div>
                </article>

                <article className="budget-workflow-ai-card">
                  <h3>Top Variance Graph</h3>
                  {topVarianceRows.length === 0 ? (
                    <p className="psychometric-section-note">Enter actual values to visualize top variance billers.</p>
                  ) : (
                    <div className="budget-workflow-variance-chart">
                      {topVarianceRows.map((row) => (
                        <div key={row.id} className="budget-workflow-variance-row">
                          <span>{row.company}</span>
                          <div className="budget-workflow-graph-track">
                            <div
                              className={`budget-workflow-graph-bar ${row.variance > 0 ? 'budget-workflow-graph-bar-warning' : 'budget-workflow-graph-bar-setup'}`}
                              style={{
                                width: `${maxVarianceMagnitude > 0 ? (row.magnitude / maxVarianceMagnitude) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <strong>{formatSignedCurrency(row.variance)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              </div>
            </article>
          ) : null}
        </div>

        <aside className="budget-dashboard-side">
          <article className="psychometric-panel psychometric-sticky-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Workflow Steps</span>
                <h2>Navigate Workflow Steps</h2>
              </div>
            </div>

            <div className="lending-psychometric-step-list">
              {workflowSteps.map((workflowStep) => {
                const isActive = step === workflowStep.id;
                const isCompleted = step > workflowStep.id;
                const stepPercent = stepCompletionById[workflowStep.id];
                const statusLabel = `${stepPercent}% information provided`;

                return (
                  <button
                    key={workflowStep.id}
                    type="button"
                    onClick={() => setStep(workflowStep.id)}
                    className={`${stepperButtonClass} lending-psychometric-step-button ${isActive ? 'loan-stepper-button-active border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'loan-stepper-button-idle border-gray-200 bg-white hover:border-blue-400 hover:text-blue-600'}`}
                  >
                    <div className={`lending-psychometric-step-index ${isActive || isCompleted ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>
                      {workflowStep.id}
                    </div>
                    <div className="lending-psychometric-step-copy">
                      <strong>{workflowStep.label}</strong>
                      <span>{statusLabel}</span>
                      <div className="lending-step-information-track" aria-hidden="true">
                        <div
                          className={`lending-step-information-bar${stepPercent < 30 ? ' lending-step-information-bar-low' : ''}`}
                          style={{ width: `${stepPercent}%` }}
                        />
                      </div>
                      <small>{workflowStep.description}</small>
                    </div>
                  </button>
                );
              })}
            </div>
          </article>

          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Setup Snapshot</span>
            <h2>{savedSetup.length > 0 ? 'Setup Saved' : 'Setup Draft'}</h2>
            <ul className="psychometric-breakdown-list">
              <li>
                <span>Period Covered</span>
                <strong>{periodStart && periodEnd ? `${periodStart} to ${periodEnd}` : 'Not set'}</strong>
              </li>
              <li>
                <span>Draft Budget</span>
                <strong>{formatCurrency(draftBudgetTotal)}</strong>
              </li>
              <li>
                <span>Saved Budget</span>
                <strong>{formatCurrency(savedBudgetTotal)}</strong>
              </li>
            </ul>
          </article>

          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Due Health</span>
            <h2>{snapshot.performanceBand}</h2>
            <ul className="psychometric-breakdown-list">
              <li>
                <span>Due Soon</span>
                <strong>{dueSoonCount}</strong>
              </li>
              <li>
                <span>Past Due</span>
                <strong>{pastDueCount}</strong>
              </li>
              <li>
                <span>Ready to Pay</span>
                <strong>{snapshot.readyToPayCount}</strong>
              </li>
            </ul>
          </article>
        </aside>
      </section>
    </div>
  );
}
