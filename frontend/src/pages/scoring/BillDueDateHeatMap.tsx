export type BillDueDateItem = {
  id: string;
  company: string;
  utilityType: string;
  estimatedDueDay: string;
  dateCovered: string;
};

type BillDueDateHeatMapProps = {
  bills: BillDueDateItem[];
  referenceDate?: Date;
};

export type BillDueUrgency = 'green' | 'amber' | 'red';

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(from: Date, to: Date) {
  return Math.round((startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) / 86_400_000);
}

export function billDueUrgency(daysUntilDue: number): BillDueUrgency {
  if (daysUntilDue <= 2) return 'red';
  if (daysUntilDue <= 9) return 'amber';
  return 'green';
}

export function resolveBillDueDate(bill: BillDueDateItem, referenceDate: Date) {
  const exactDateMatch = bill.dateCovered.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (exactDateMatch) {
    const exactDate = new Date(
      Number(exactDateMatch[1]),
      Number(exactDateMatch[2]) - 1,
      Number(exactDateMatch[3]),
    );
    if (!Number.isNaN(exactDate.getTime())) return exactDate;
  }

  const requestedDay = Number(bill.estimatedDueDay);
  if (!Number.isInteger(requestedDay) || requestedDay < 1 || requestedDay > 31) return null;
  const lastDayOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0).getDate();
  return new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    Math.min(requestedDay, lastDayOfMonth),
  );
}

export function buildBillDueDateHeatMap(bills: BillDueDateItem[], referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const dayCount = new Date(year, month + 1, 0).getDate();
  const dueBills = bills.flatMap((bill) => {
    const dueDate = resolveBillDueDate(bill, referenceDate);
    if (!dueDate || dueDate.getFullYear() !== year || dueDate.getMonth() !== month) return [];
    const daysUntilDue = daysBetween(referenceDate, dueDate);
    return [{ ...bill, dueDate, daysUntilDue, urgency: billDueUrgency(daysUntilDue) }];
  });

  return {
    monthLabel: referenceDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    cells: Array.from({ length: firstWeekday + dayCount }, (_, index) => {
      const day = index - firstWeekday + 1;
      if (day < 1) return null;
      return {
        day,
        isToday: day === referenceDate.getDate(),
        bills: dueBills.filter((bill) => bill.dueDate.getDate() === day),
      };
    }),
  };
}

function timingLabel(daysUntilDue: number) {
  if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? '' : 's'} overdue`;
  if (daysUntilDue === 0) return 'due today';
  return `${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'} remaining`;
}

export default function BillDueDateHeatMap({ bills, referenceDate = new Date() }: BillDueDateHeatMapProps) {
  const calendar = buildBillDueDateHeatMap(bills, referenceDate);

  return (
    <section className="bill-due-heat-map" aria-labelledby="bill-due-heat-map-title">
      <header>
        <div>
          <span>Bill Due-Date Heat Map</span>
          <h2 id="bill-due-heat-map-title">{calendar.monthLabel}</h2>
        </div>
        <div className="bill-due-heat-map-legend" aria-label="Due-date urgency legend">
          <span><i className="bill-due-heat-green" />10+ days</span>
          <span><i className="bill-due-heat-amber" />3-9 days</span>
          <span><i className="bill-due-heat-red" />2 days or overdue</span>
        </div>
      </header>
      <div className="bill-due-calendar" role="grid" aria-label={`${calendar.monthLabel} bill due dates`}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((weekday) => (
          <div className="bill-due-calendar-weekday" role="columnheader" key={weekday}>{weekday}</div>
        ))}
        {calendar.cells.map((cell, index) => cell ? (
          <div
            className={`bill-due-calendar-day${cell.isToday ? ' bill-due-calendar-today' : ''}`}
            role="gridcell"
            aria-label={`${calendar.monthLabel} ${cell.day}${cell.isToday ? ', today' : ''}`}
            key={cell.day}
          >
            <span>{cell.day}</span>
            {cell.bills.map((bill) => (
              <div
                className={`bill-due-calendar-bill bill-due-calendar-bill-${bill.urgency}`}
                aria-label={`${bill.company}, ${bill.utilityType}, ${timingLabel(bill.daysUntilDue)}`}
                title={`${bill.company}: ${timingLabel(bill.daysUntilDue)}`}
                key={bill.id}
              >
                {bill.company}
              </div>
            ))}
          </div>
        ) : <div className="bill-due-calendar-day bill-due-calendar-empty" aria-hidden="true" key={`empty-${index}`} />)}
      </div>
      {bills.length === 0 ? <p className="bill-due-heat-map-empty">Add and save billers to display their due dates.</p> : null}
    </section>
  );
}