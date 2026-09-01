export const fastTractAppointmentStatuses = [
  "new",
  "confirmed",
  "cancelled",
  "showed",
  "noshow",
  "invalid",
  "completed",
  "active",
] as const;

export type FastTractAppointmentStatus = (typeof fastTractAppointmentStatuses)[number];

export type FastTractCalendar = {
  id: string;
  name: string;
  locationId?: string;
  description?: string;
  calendarType?: string;
  eventColor?: string;
  isActive?: boolean;
};

export type FastTractAppointment = {
  id: string;
  calendarId: string;
  locationId?: string;
  contactId?: string;
  title: string;
  startTime: string;
  endTime: string;
  appointmentStatus: FastTractAppointmentStatus;
  assignedUserId?: string;
  address?: string;
  description?: string;
  calendarName?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
};

export type ScheduleSummary = {
  today: number;
  tomorrow: number;
  nextSevenDays: number;
  needsConfirmation: number;
  cancelled: number;
};

const dayMs = 24 * 60 * 60 * 1000;

function validDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function normalizeAppointmentStatus(value?: string | null): FastTractAppointmentStatus {
  const normalized = String(value ?? "new").trim().toLowerCase().replace(/\s+/g, "_");
  if (normalized === "booked") return "confirmed";
  if (normalized === "no_show" || normalized === "no-show") return "noshow";
  return fastTractAppointmentStatuses.includes(normalized as FastTractAppointmentStatus)
    ? normalized as FastTractAppointmentStatus
    : "new";
}

export function appointmentStatusLabel(status: FastTractAppointmentStatus) {
  const labels: Record<FastTractAppointmentStatus, string> = {
    new: "Needs confirmation",
    confirmed: "Confirmed",
    cancelled: "Cancelled",
    showed: "Showed",
    noshow: "No show",
    invalid: "Invalid",
    completed: "Completed",
    active: "Active",
  };
  return labels[status];
}

export function appointmentStart(appointment: FastTractAppointment) {
  return validDate(appointment.startTime);
}

export function appointmentEnd(appointment: FastTractAppointment) {
  return validDate(appointment.endTime);
}

export function appointmentDurationMinutes(appointment: FastTractAppointment) {
  const start = appointmentStart(appointment);
  const end = appointmentEnd(appointment);
  if (!start || !end || end.getTime() <= start.getTime()) return 0;
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}

export function sortAppointments(appointments: FastTractAppointment[]) {
  return [...appointments].sort((a, b) => {
    const aStart = appointmentStart(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bStart = appointmentStart(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return aStart - bStart || a.title.localeCompare(b.title);
  });
}

export function localDateKey(value: Date | string) {
  const date = typeof value === "string" ? validDate(value) : value;
  if (!date) return "unknown";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function groupAppointmentsByDay(appointments: FastTractAppointment[]) {
  const grouped = new Map<string, FastTractAppointment[]>();
  for (const appointment of sortAppointments(appointments)) {
    const key = appointment.startTime ? localDateKey(appointment.startTime) : "unknown";
    grouped.set(key, [...(grouped.get(key) ?? []), appointment]);
  }
  return [...grouped.entries()].map(([date, items]) => ({ date, appointments: items }));
}

export function summarizeSchedule(
  appointments: FastTractAppointment[],
  now = new Date(),
): ScheduleSummary {
  const todayStart = startOfDay(now).getTime();
  const tomorrowStart = todayStart + dayMs;
  const dayAfterTomorrow = tomorrowStart + dayMs;
  const sevenDayEnd = todayStart + 7 * dayMs;

  const active = appointments.filter((appointment) => appointment.appointmentStatus !== "cancelled");
  return {
    today: active.filter((appointment) => {
      const value = appointmentStart(appointment)?.getTime();
      return value !== undefined && value >= todayStart && value < tomorrowStart;
    }).length,
    tomorrow: active.filter((appointment) => {
      const value = appointmentStart(appointment)?.getTime();
      return value !== undefined && value >= tomorrowStart && value < dayAfterTomorrow;
    }).length,
    nextSevenDays: active.filter((appointment) => {
      const value = appointmentStart(appointment)?.getTime();
      return value !== undefined && value >= todayStart && value < sevenDayEnd;
    }).length,
    needsConfirmation: active.filter((appointment) => appointment.appointmentStatus === "new").length,
    cancelled: appointments.filter((appointment) => appointment.appointmentStatus === "cancelled").length,
  };
}

export function localDateInputValue(value: Date | string) {
  const date = typeof value === "string" ? validDate(value) : value;
  return date ? localDateKey(date) : "";
}

export function localTimeInputValue(value: Date | string) {
  const date = typeof value === "string" ? validDate(value) : value;
  if (!date) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function localDateTimeToIso(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return "";
  const value = new Date(`${date}T${time}:00`);
  return Number.isNaN(value.getTime()) ? "" : value.toISOString();
}

export function addMinutesToIso(startTime: string, minutes: number) {
  const start = validDate(startTime);
  if (!start || !Number.isFinite(minutes) || minutes <= 0) return "";
  return new Date(start.getTime() + minutes * 60_000).toISOString();
}

export function scheduleRange(days = 30, now = new Date()) {
  const safeDays = Math.min(62, Math.max(1, Math.floor(days)));
  const start = startOfDay(now);
  const end = new Date(start.getTime() + safeDays * dayMs);
  return { start: start.toISOString(), end: end.toISOString() };
}
