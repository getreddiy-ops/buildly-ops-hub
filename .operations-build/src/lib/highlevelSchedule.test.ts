import { describe, expect, it } from "vitest";
import {
  addMinutesToIso,
  appointmentDurationMinutes,
  groupAppointmentsByDay,
  localDateTimeToIso,
  normalizeAppointmentStatus,
  sortAppointments,
  summarizeSchedule,
  type FastTractAppointment,
} from "./highlevelSchedule";

function appointment(overrides: Partial<FastTractAppointment> = {}): FastTractAppointment {
  return {
    id: "appointment-1",
    calendarId: "calendar-1",
    title: "Site visit",
    startTime: "2026-09-01T10:00:00-07:00",
    endTime: "2026-09-01T11:00:00-07:00",
    appointmentStatus: "confirmed",
    ...overrides,
  };
}

describe("highlevelSchedule", () => {
  it("normalizes HighLevel appointment statuses", () => {
    expect(normalizeAppointmentStatus("booked")).toBe("confirmed");
    expect(normalizeAppointmentStatus("no_show")).toBe("noshow");
    expect(normalizeAppointmentStatus("COMPLETED")).toBe("completed");
    expect(normalizeAppointmentStatus("unknown-status")).toBe("new");
  });

  it("sorts and groups appointments by local day", () => {
    const rows = [
      appointment({ id: "later", title: "Later", startTime: "2026-09-02T14:00:00-07:00" }),
      appointment({ id: "early", title: "Early", startTime: "2026-09-01T08:00:00-07:00" }),
      appointment({ id: "mid", title: "Mid", startTime: "2026-09-01T11:00:00-07:00" }),
    ];

    expect(sortAppointments(rows).map((row) => row.id)).toEqual(["early", "mid", "later"]);
    const grouped = groupAppointmentsByDay(rows);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].appointments.map((row) => row.id)).toEqual(["early", "mid"]);
  });

  it("summarizes the contractor's immediate schedule", () => {
    const now = new Date(2026, 8, 1, 7, 0, 0);
    const summary = summarizeSchedule([
      appointment({ id: "today", appointmentStatus: "confirmed", startTime: new Date(2026, 8, 1, 10).toISOString() }),
      appointment({ id: "tomorrow", appointmentStatus: "new", startTime: new Date(2026, 8, 2, 9).toISOString() }),
      appointment({ id: "later", appointmentStatus: "active", startTime: new Date(2026, 8, 6, 9).toISOString() }),
      appointment({ id: "cancelled", appointmentStatus: "cancelled", startTime: new Date(2026, 8, 1, 13).toISOString() }),
    ], now);

    expect(summary).toEqual({
      today: 1,
      tomorrow: 1,
      nextSevenDays: 3,
      needsConfirmation: 1,
      cancelled: 1,
    });
  });

  it("calculates duration without guessing invalid time ranges", () => {
    expect(appointmentDurationMinutes(appointment())).toBe(60);
    expect(appointmentDurationMinutes(appointment({ endTime: "2026-09-01T09:00:00-07:00" }))).toBe(0);
  });

  it("builds explicit ISO date ranges for appointment actions", () => {
    const start = localDateTimeToIso("2026-09-15", "08:30");
    expect(start).toMatch(/^2026-09-15T/);
    expect(addMinutesToIso(start, 90)).toBe(new Date(new Date(start).getTime() + 90 * 60_000).toISOString());
    expect(localDateTimeToIso("not-a-date", "08:30")).toBe("");
  });
});
