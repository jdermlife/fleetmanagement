export interface CashBasisDayEntry {
  income: string;
  expenses: string;
}

export interface CashBasisCalendarDay {
  dateKey: string;
  day: number;
  weekday: number;
}

function parseAmount(value: string | undefined) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

export function normalizeMonth(value: string | undefined, fallbackDate = new Date()) {
  if (value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    return value;
  }

  const year = fallbackDate.getFullYear();
  const month = String(fallbackDate.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function buildCashBasisCalendar(monthValue: string): CashBasisCalendarDay[] {
  const month = normalizeMonth(monthValue);
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    return {
      dateKey: `${month}-${String(day).padStart(2, '0')}`,
      day,
      weekday: new Date(year, monthNumber - 1, day).getDay(),
    };
  });
}

export function calculateCashBasisTotals(
  days: CashBasisCalendarDay[],
  entries: Record<string, CashBasisDayEntry>,
) {
  return days.reduce(
    (totals, day) => {
      totals.income += parseAmount(entries[day.dateKey]?.income);
      totals.expenses += parseAmount(entries[day.dateKey]?.expenses);
      totals.net = totals.income - totals.expenses;
      return totals;
    },
    { income: 0, expenses: 0, net: 0 },
  );
}