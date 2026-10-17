export type ActivityDay = {
  date: string;
  count: number;
};

export type HeatCell = {
  key: string;
  date: Date;
  count: number;
  future: boolean;
};

const WEEKS = 53;

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function dayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function heatLevel(count: number) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

export function buildWeeks(days: ActivityDay[], today = new Date()) {
  const counts = new Map(days.map((day) => [day.date, day.count]));
  const end = startOfDay(today);
  const start = new Date(end);
  start.setDate(end.getDate() - end.getDay() - (WEEKS - 1) * 7);

  const weeks: HeatCell[][] = [];
  for (let week = 0; week < WEEKS; week++) {
    const column: HeatCell[] = [];
    for (let weekday = 0; weekday < 7; weekday++) {
      const date = new Date(start);
      date.setDate(start.getDate() + week * 7 + weekday);
      const future = date.getTime() > end.getTime();
      const key = dayKey(date);
      column.push({
        key,
        date,
        count: future ? 0 : (counts.get(key) ?? 0),
        future,
      });
    }
    weeks.push(column);
  }
  return weeks;
}

export function monthLabels(weeks: HeatCell[][]) {
  const labels = Array<string>(weeks.length).fill("");
  let last = -4;
  weeks.forEach((week, index) => {
    const firstOfMonth = week.find((cell) => !cell.future && cell.date.getDate() === 1);
    const marker = firstOfMonth ?? (index === 0 ? week.find((cell) => !cell.future) : undefined);
    if (!marker) return;
    if (index !== 0 && !firstOfMonth) return;
    if (index - last < 2) return;
    labels[index] = MONTHS[marker.date.getMonth()] ?? "";
    last = index;
  });
  return labels;
}

export function totalMessages(weeks: HeatCell[][]) {
  return weeks.reduce(
    (sum, week) => sum + week.reduce((inner, cell) => inner + cell.count, 0),
    0,
  );
}

export function describeDay(cell: HeatCell) {
  const when = cell.date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  if (cell.count === 0) return `No messages on ${when}`;
  if (cell.count === 1) return `1 message on ${when}`;
  return `${cell.count} messages on ${when}`;
}
