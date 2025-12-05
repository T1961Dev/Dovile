export function getTodayISO(tz = "UTC") {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const formatted = formatter.format(now);
  return formatted;
}

export function toISODate(date: Date) {
  return date.toISOString().split("T")[0]!;
}

export function addDays(date: string, offset: number) {
  const d = new Date(`${date}T00:00:00`);
  d.setUTCDate(d.getUTCDate() + offset);
  return toISODate(d);
}

