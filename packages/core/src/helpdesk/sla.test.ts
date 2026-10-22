import { describe, expect, it } from "vitest";
import {
  addBusinessMinutes,
  businessMinutesBetween,
  computeDueDates,
  formatMinutes,
  isBusinessTime,
  slaState,
  zonedTimeToUtc,
  type BusinessCalendar,
  type SlaTargets,
} from "./sla";

const london: BusinessCalendar = {
  timezone: "Europe/London",
  workDays: [1, 2, 3, 4, 5],
  startMinute: 9 * 60,
  endMinute: 17 * 60 + 30,
  holidays: [],
};
const iso = (s: string) => new Date(s);

describe("zonedTimeToUtc", () => {
  it("converts London winter and summer wall times", () => {
    expect(zonedTimeToUtc(2026, 1, 15, 9 * 60, "Europe/London").toISOString()).toBe("2026-01-15T09:00:00.000Z");
    expect(zonedTimeToUtc(2026, 7, 15, 9 * 60, "Europe/London").toISOString()).toBe("2026-07-15T08:00:00.000Z");
  });
  it("handles minute 1440 as next midnight", () => {
    expect(zonedTimeToUtc(2026, 1, 15, 1440, "UTC").toISOString()).toBe("2026-01-16T00:00:00.000Z");
  });
  it("shifts a time inside the spring-forward gap forward", () => {
    // London 2026-03-29 01:30 does not exist (01:00 -> 02:00).
    expect(zonedTimeToUtc(2026, 3, 29, 90, "Europe/London").toISOString()).toBe("2026-03-29T01:30:00.000Z");
  });
  it("picks the first occurrence of a repeated fall-back time", () => {
    // London 2026-10-25 01:30 happens twice: 00:30Z (BST) and 01:30Z (GMT).
    expect(zonedTimeToUtc(2026, 10, 25, 90, "Europe/London").toISOString()).toBe("2026-10-25T00:30:00.000Z");
  });
  it("works for a zone with a half-hour offset and no DST", () => {
    expect(zonedTimeToUtc(2026, 6, 1, 9 * 60, "Asia/Kolkata").toISOString()).toBe("2026-06-01T03:30:00.000Z");
  });
});

describe("addBusinessMinutes", () => {
  it("adds inside a single working day", () => {
    // Thursday 15 Jan 2026, 10:00 London (= 10:00Z) + 2h
    expect(addBusinessMinutes(iso("2026-01-15T10:00:00Z"), 120, london).toISOString()).toBe("2026-01-15T12:00:00.000Z");
  });
  it("lands exactly on the end of the day rather than rolling over", () => {
    expect(addBusinessMinutes(iso("2026-01-15T09:00:00Z"), 510, london).toISOString()).toBe("2026-01-15T17:30:00.000Z");
  });
  it("rolls over the end of the day into the next morning", () => {
    // 16:30 + 2h = 1h today, 1h tomorrow -> Fri 10:00
    expect(addBusinessMinutes(iso("2026-01-15T16:30:00Z"), 120, london).toISOString()).toBe("2026-01-16T10:00:00.000Z");
  });
  it("starts the clock at 09:00 for a request raised overnight", () => {
    // Raised Thu 23:45, 30 business minutes -> Fri 09:30
    expect(addBusinessMinutes(iso("2026-01-15T23:45:00Z"), 30, london).toISOString()).toBe("2026-01-16T09:30:00.000Z");
    // Raised Fri 03:00 (before opening) -> same day 09:30
    expect(addBusinessMinutes(iso("2026-01-16T03:00:00Z"), 30, london).toISOString()).toBe("2026-01-16T09:30:00.000Z");
  });
  it("skips the weekend", () => {
    // Fri 17:00 + 60 -> 30m Fri, 30m Mon -> Mon 19 Jan 09:30
    expect(addBusinessMinutes(iso("2026-01-16T17:00:00Z"), 60, london).toISOString()).toBe("2026-01-19T09:30:00.000Z");
    // Raised on Saturday
    expect(addBusinessMinutes(iso("2026-01-17T12:00:00Z"), 15, london).toISOString()).toBe("2026-01-19T09:15:00.000Z");
  });
  it("skips holidays, including a long weekend", () => {
    const cal = { ...london, holidays: ["2026-04-03", "2026-04-06"] }; // Good Friday, Easter Monday
    // Thu 2 Apr 17:00 BST (16:00Z) + 60 -> 30m Thu, then Tue 7 Apr 09:30 BST (08:30Z)
    expect(addBusinessMinutes(iso("2026-04-02T16:00:00Z"), 60, cal).toISOString()).toBe("2026-04-07T08:30:00.000Z");
  });
  it("spans multiple days for long targets", () => {
    // 3 full days of 510 min from Mon 09:00 -> Wed 17:30
    expect(addBusinessMinutes(iso("2026-01-19T09:00:00Z"), 1530, london).toISOString()).toBe("2026-01-21T17:30:00.000Z");
  });
  it("snaps zero minutes forward to the next working moment", () => {
    expect(addBusinessMinutes(iso("2026-01-17T12:00:00Z"), 0, london).toISOString()).toBe("2026-01-19T09:00:00.000Z");
    expect(addBusinessMinutes(iso("2026-01-15T11:00:00Z"), 0, london).toISOString()).toBe("2026-01-15T11:00:00.000Z");
  });
  it("uses local wall time across the spring DST change", () => {
    // Fri 27 Mar 2026 17:00 GMT + 60 -> 30m Fri, 30m Mon 30 Mar 09:30 BST = 08:30Z
    expect(addBusinessMinutes(iso("2026-03-27T17:00:00Z"), 60, london).toISOString()).toBe("2026-03-30T08:30:00.000Z");
  });
  it("uses local wall time across the autumn DST change", () => {
    // Fri 23 Oct 2026 17:00 BST (16:00Z) + 60 -> Mon 26 Oct 09:30 GMT = 09:30Z
    expect(addBusinessMinutes(iso("2026-10-23T16:00:00Z"), 60, london).toISOString()).toBe("2026-10-26T09:30:00.000Z");
  });
  it("counts the real minutes of a 24h shift on a DST day", () => {
    const allDay: BusinessCalendar = { timezone: "Europe/London", workDays: [1, 2, 3, 4, 5, 6, 7], startMinute: 0, endMinute: 1440, holidays: [] };
    // Spring-forward day is 23 hours long: from local midnight (00:00Z) + 23h lands on next local midnight.
    expect(addBusinessMinutes(iso("2026-03-29T00:00:00Z"), 23 * 60, allDay).toISOString()).toBe("2026-03-29T23:00:00.000Z");
  });
  it("respects the team timezone (New York team, request from London morning)", () => {
    const ny: BusinessCalendar = { ...london, timezone: "America/New_York", startMinute: 9 * 60, endMinute: 17 * 60 };
    // 10:00Z on Thu 15 Jan = 05:00 New York; opens 09:00 NY = 14:00Z; +60 -> 15:00Z
    expect(addBusinessMinutes(iso("2026-01-15T10:00:00Z"), 60, ny).toISOString()).toBe("2026-01-15T15:00:00.000Z");
  });
  it("uses the team's own weekend (Sunday to Thursday week)", () => {
    const dubai: BusinessCalendar = { timezone: "Asia/Dubai", workDays: [7, 1, 2, 3, 4], startMinute: 8 * 60, endMinute: 16 * 60, holidays: [] };
    // Thu 15 Jan 15:30 Dubai (11:30Z) + 60 -> 30m Thu, then Sun 18 Jan 08:30 Dubai (04:30Z)
    expect(addBusinessMinutes(iso("2026-01-15T11:30:00Z"), 60, dubai).toISOString()).toBe("2026-01-18T04:30:00.000Z");
  });
  it("supports overnight shifts that cross midnight", () => {
    const nights: BusinessCalendar = { timezone: "UTC", workDays: [1, 2, 3, 4, 5], startMinute: 22 * 60, endMinute: 6 * 60, holidays: [] };
    // Thu 15 Jan 23:00 (inside Thu night shift) + 2h -> Fri 01:00
    expect(addBusinessMinutes(iso("2026-01-15T23:00:00Z"), 120, nights).toISOString()).toBe("2026-01-16T01:00:00.000Z");
    // Fri 03:00 is still Thursday's shift: + 4h -> 3h left until 06:00, then Fri night 22:00 + 1h = 23:00
    expect(addBusinessMinutes(iso("2026-01-16T03:00:00Z"), 240, nights).toISOString()).toBe("2026-01-16T23:00:00.000Z");
    // Saturday night shift does not exist: Fri shift ends Sat 06:00 then next is Mon 22:00
    expect(addBusinessMinutes(iso("2026-01-17T05:00:00Z"), 120, nights).toISOString()).toBe("2026-01-19T23:00:00.000Z");
  });
  it("falls back to wall-clock minutes for a calendar with no working time", () => {
    const none = { ...london, workDays: [] };
    expect(addBusinessMinutes(iso("2026-01-15T10:00:00Z"), 90, none).toISOString()).toBe("2026-01-15T11:30:00.000Z");
  });
  it("rejects an unknown timezone", () => {
    expect(() => addBusinessMinutes(new Date(), 10, { ...london, timezone: "Mars/Olympus" })).toThrow(RangeError);
  });
});

describe("businessMinutesBetween", () => {
  it("is the inverse of addBusinessMinutes", () => {
    const start = iso("2026-01-15T16:00:00Z");
    for (const mins of [0, 15, 90, 510, 1000, 5000]) {
      const end = addBusinessMinutes(start, mins, london);
      expect(businessMinutesBetween(start, end, london)).toBe(mins);
    }
  });
  it("ignores nights, weekends and holidays", () => {
    const cal = { ...london, holidays: ["2026-01-19"] };
    // Fri 17:00 -> Tue 09:30 = 30m Fri + 0 Mon(holiday) + 30m Tue
    expect(businessMinutesBetween(iso("2026-01-16T17:00:00Z"), iso("2026-01-20T09:30:00Z"), cal)).toBe(60);
  });
  it("returns 0 when the end is before the start", () => {
    expect(businessMinutesBetween(iso("2026-01-16T17:00:00Z"), iso("2026-01-16T10:00:00Z"), london)).toBe(0);
  });
});

describe("isBusinessTime", () => {
  it("knows opening hours, weekends and overnight shifts", () => {
    expect(isBusinessTime(iso("2026-01-15T10:00:00Z"), london)).toBe(true);
    expect(isBusinessTime(iso("2026-01-15T17:30:00Z"), london)).toBe(false);
    expect(isBusinessTime(iso("2026-01-17T10:00:00Z"), london)).toBe(false);
    const nights: BusinessCalendar = { timezone: "UTC", workDays: [4], startMinute: 22 * 60, endMinute: 6 * 60, holidays: [] };
    expect(isBusinessTime(iso("2026-01-16T03:00:00Z"), nights)).toBe(true); // Thursday's shift, on Friday morning
  });
});

describe("computeDueDates and slaState", () => {
  const targets: SlaTargets = {
    urgent: { firstResponse: 30, resolution: 240 },
    high: { firstResponse: 60, resolution: 480 },
    normal: { firstResponse: 240, resolution: 1530 },
    low: { firstResponse: 510, resolution: 2550 },
  };
  it("computes both clocks per priority with the calendar", () => {
    const due = computeDueDates(iso("2026-01-15T16:00:00Z"), "high", targets, london)!;
    expect(due.firstResponseDueAt.toISOString()).toBe("2026-01-15T17:00:00.000Z");
    expect(due.resolutionDueAt.toISOString()).toBe("2026-01-16T15:30:00.000Z");
  });
  it("uses wall-clock minutes without a calendar", () => {
    const due = computeDueDates(iso("2026-01-17T16:00:00Z"), "urgent", targets, null)!;
    expect(due.firstResponseDueAt.toISOString()).toBe("2026-01-17T16:30:00.000Z");
  });
  it("reports met, ok, soon and breached", () => {
    const due = iso("2026-01-15T12:00:00Z");
    expect(slaState(due, iso("2026-01-15T11:00:00Z"))).toBe("met");
    expect(slaState(due, iso("2026-01-15T12:30:00Z"))).toBe("breached");
    expect(slaState(due, null, iso("2026-01-15T08:00:00Z"))).toBe("ok");
    expect(slaState(due, null, iso("2026-01-15T11:00:00Z"))).toBe("soon");
    expect(slaState(due, null, iso("2026-01-15T12:00:00Z"))).toBe("breached");
    expect(slaState(null, null)).toBe("none");
  });
  it("formats durations compactly", () => {
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(135)).toBe("2h 15m");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(1440 * 3 + 240)).toBe("3d 4h");
  });
});
