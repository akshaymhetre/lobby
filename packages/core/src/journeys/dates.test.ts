import { describe, expect, it } from "vitest";
import {
  addDays, daysBetween, daysOverdue, describeOffset, dueDateFor, isIsoDate, isoWeekday, journeyDayLabel,
  offsetToParts, partsToOffset, phaseFor, todayIn,
} from "./dates";

describe("calendar maths", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });
  it("is not thrown off by daylight saving changes", () => {
    // Europe/London moves clocks on 2026-10-25; calendar maths must not drift.
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
  });
  it("counts days between dates in both directions", () => {
    expect(daysBetween("2026-10-15", "2026-10-16")).toBe(1);
    expect(daysBetween("2026-10-16", "2026-10-15")).toBe(-1);
  });
  it("knows ISO weekdays", () => {
    expect(isoWeekday("2026-10-12")).toBe(1); // Monday
    expect(isoWeekday("2026-10-18")).toBe(7); // Sunday
  });
  it("validates ISO dates", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("26-2-3")).toBe(false);
  });
  it("reads today in the company's time zone", () => {
    const lateUtc = new Date("2026-10-15T23:30:00Z");
    expect(todayIn("UTC", lateUtc)).toBe("2026-10-15");
    expect(todayIn("Asia/Kolkata", lateUtc)).toBe("2026-10-16");
    expect(todayIn("Not/AZone", lateUtc)).toBe("2026-10-15");
  });
});

describe("dueDateFor", () => {
  const monday = "2026-10-19";
  it("puts day 1 on the anchor even on a weekend", () => {
    expect(dueDateFor("2026-10-18", 0)).toBe("2026-10-18");
  });
  it("adds offsets in calendar days", () => {
    expect(dueDateFor(monday, 1)).toBe("2026-10-20");
    expect(dueDateFor(monday, 7)).toBe("2026-10-26");
    expect(dueDateFor(monday, -3)).toBe("2026-10-16"); // Friday
  });
  it("moves later steps forward off a weekend", () => {
    expect(dueDateFor(monday, 5)).toBe("2026-10-26"); // Saturday -> Monday
    expect(dueDateFor(monday, 6)).toBe("2026-10-26"); // Sunday -> Monday
  });
  it("moves preparation steps back off a weekend so they are never late by design", () => {
    expect(dueDateFor(monday, -1)).toBe("2026-10-16"); // Sunday -> Friday
    expect(dueDateFor(monday, -2)).toBe("2026-10-16"); // Saturday -> Friday
  });
  it("respects a custom working week and an empty one", () => {
    const sunToThu = [7, 1, 2, 3, 4];
    expect(dueDateFor(monday, 4, sunToThu)).toBe("2026-10-25"); // Friday -> Sunday
    expect(dueDateFor(monday, 5, [])).toBe("2026-10-24");
  });
});

describe("phases and labels", () => {
  it("groups onboarding offsets into day markers", () => {
    expect(phaseFor(-7).label).toBe("Before day 1");
    expect(phaseFor(0).label).toBe("Day 1");
    expect(phaseFor(1).label).toBe("Week 1");
    expect(phaseFor(6).label).toBe("Week 1");
    expect(phaseFor(7).label).toBe("Week 2");
    expect(phaseFor(13).label).toBe("Week 2");
    expect(phaseFor(29).label).toBe("Month 1");
    expect(phaseFor(30).label).toBe("Month 2");
    expect(phaseFor(120).label).toBe("Later");
  });
  it("orders phases chronologically", () => {
    const orders = [-3, 0, 2, 9, 20, 45, 70, 100].map((d) => phaseFor(d).order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });
  it("groups offboarding offsets", () => {
    expect(phaseFor(-10, "offboarding").label).toBe("Before the last week");
    expect(phaseFor(-2, "offboarding").label).toBe("Last week");
    expect(phaseFor(0, "offboarding").label).toBe("Last day");
    expect(phaseFor(1, "offboarding").label).toBe("After leaving");
  });
  it("describes offsets the way a person would", () => {
    expect(describeOffset(0)).toBe("On day 1");
    expect(describeOffset(-3)).toBe("3 days before start");
    expect(describeOffset(-1)).toBe("1 day before start");
    expect(describeOffset(-7)).toBe("1 week before start");
    expect(describeOffset(2)).toBe("Day 3");
    expect(describeOffset(7)).toBe("Start of week 2");
    expect(describeOffset(0, "offboarding")).toBe("On the last day");
    expect(describeOffset(-5, "offboarding")).toBe("5 days before the last day");
    expect(describeOffset(2, "offboarding")).toBe("2 days after leaving");
  });
  it("round-trips the builder's offset input", () => {
    for (const n of [-14, -3, 0, 1, 7, 13, 29]) expect(partsToOffset(offsetToParts(n))).toBe(n);
    expect(offsetToParts(-14)).toEqual({ amount: 2, unit: "weeks", direction: "before" });
    expect(partsToOffset({ amount: 2, unit: "weeks", direction: "after" })).toBe(14);
    expect(partsToOffset({ amount: 5, unit: "days", direction: "on" })).toBe(0);
    expect(partsToOffset({ amount: -4, unit: "days", direction: "after" })).toBe(0);
  });
  it("frames where a new hire is in their first month", () => {
    expect(journeyDayLabel("2026-10-16", "2026-10-15")).toBe("You start tomorrow");
    expect(journeyDayLabel("2026-10-29", "2026-10-15")).toBe("14 days until your first day");
    expect(journeyDayLabel("2026-10-15", "2026-10-15")).toBe("Day 1 of your first month");
    expect(journeyDayLabel("2026-10-13", "2026-10-15")).toBe("Day 3 of your first month");
    expect(journeyDayLabel("2026-09-01", "2026-10-15")).toBe("Day 45, your second month");
    expect(journeyDayLabel("2026-06-01", "2026-10-15")).toBe("Week 20");
    expect(journeyDayLabel("2026-10-20", "2026-10-15", "offboarding")).toBe("5 days until your last day");
  });
  it("counts overdue days", () => {
    expect(daysOverdue("2026-10-10", "2026-10-15")).toBe(5);
    expect(daysOverdue("2026-10-20", "2026-10-15")).toBe(0);
  });
});

import { dueLabel, formatDay, relativeDay, runTimingLabel } from "./dates";
describe("list labels", () => {
  it("describes a run's timing in the third person", () => {
    expect(runTimingLabel("2026-10-16", "2026-10-15")).toBe("Starts tomorrow");
    expect(runTimingLabel("2026-10-29", "2026-10-15")).toBe("Starts in 14 days");
    expect(runTimingLabel("2026-10-15", "2026-10-15")).toBe("Day 1 today");
    expect(runTimingLabel("2026-10-08", "2026-10-15")).toBe("Day 8");
    expect(runTimingLabel("2026-10-20", "2026-10-15", "offboarding")).toBe("Leaves in 5 days");
  });
  it("formats due dates", () => {
    expect(formatDay("2026-10-16")).toBe("Fri 16 Oct");
    expect(relativeDay("2026-10-16", "2026-10-15")).toBe("Tomorrow");
    expect(dueLabel("2026-10-13", "2026-10-15")).toBe("Overdue by 2 days");
    expect(dueLabel("2026-10-15", "2026-10-15")).toBe("Due today");
    expect(dueLabel("2026-10-20", "2026-10-15")).toBe("Due Tue 20 Oct");
  });
});
