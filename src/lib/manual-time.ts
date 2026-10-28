import { toLocalDateInputValue } from "./local-date";
export function localDateTimeValue(date = new Date()) {
  return `${toLocalDateInputValue(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
export function validatePastTime(startValue: string, endValue: string, now = Date.now()) {
  const start = new Date(startValue), end = new Date(endValue);
  if (!startValue || !endValue || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) throw new Error("Enter a valid start and end date/time.");
  if (localDateTimeValue(start) !== startValue || localDateTimeValue(end) !== endValue) throw new Error("That local time does not exist. Choose another time.");
  if (end <= start) throw new Error("End time must be after start time.");
  if (end.getTime() > now) throw new Error("Past time entries must end in the past.");
  return { clockIn: start.toISOString(), clockOut: end.toISOString(), hours: (end.getTime() - start.getTime()) / 3_600_000 };
}
