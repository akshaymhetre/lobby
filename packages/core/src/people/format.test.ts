import { describe, expect, it } from "vitest";
import { daysUntil, formatWorkingHours, isNewJoiner, isWorkingNow, localTime, normaliseSkills, parseWorkingHours, startLabel } from "./format";

const today = new Date("2026-10-15T09:00:00Z");

describe("start dates", () => {
  it("counts calendar days", () => {
    expect(daysUntil("2026-10-16", today)).toBe(1);
    expect(daysUntil("2026-10-15", today)).toBe(0);
    expect(daysUntil("2026-09-15", today)).toBe(-30);
  });

  it("labels starters and joiners", () => {
    expect(startLabel("2026-10-16", today)).toBe("Starts tomorrow");
    expect(startLabel("2026-10-19", today)).toBe("Starts in 4 days");
    expect(startLabel("2026-10-29", today)).toBe("Starts on Thursday 29 October");
    expect(startLabel("2026-10-15", today)).toBe("Joined today");
    expect(startLabel("2026-10-08", today)).toBe("Joined 7 days ago");
    expect(startLabel("2024-03-04", today)).toBe("Joined March 2024");
    expect(startLabel(null, today)).toBeNull();
  });

  it("flags people who joined in the last 30 days", () => {
    expect(isNewJoiner("2026-10-01", today)).toBe(true);
    expect(isNewJoiner("2026-10-15", today)).toBe(true);
    expect(isNewJoiner("2026-09-10", today)).toBe(false);
    expect(isNewJoiner("2026-10-16", today)).toBe(false);
  });
});

describe("time zones", () => {
  it("formats local time", () => {
    expect(localTime("Asia/Kolkata", new Date("2026-10-15T10:42:00Z"))).toBe("4:12 pm");
    expect(localTime("Not/AZone")).toBeNull();
    expect(localTime(null)).toBeNull();
  });

  it("knows working hours", () => {
    expect(parseWorkingHours("09:00-17:30")).toEqual({ start: 540, end: 1050 });
    expect(parseWorkingHours("nine to five")).toBeNull();
    expect(formatWorkingHours("09:00-17:30")).toBe("9:00 am to 5:30 pm");
    // Thursday 10:00 in London (BST) is inside 09:00-17:30
    expect(isWorkingNow("Europe/London", "09:00-17:30", new Date("2026-10-15T09:00:00Z"))).toBe(true);
    expect(isWorkingNow("Europe/London", "09:00-17:30", new Date("2026-10-15T20:00:00Z"))).toBe(false);
    // Saturday
    expect(isWorkingNow("Europe/London", "09:00-17:30", new Date("2026-10-17T11:00:00Z"))).toBe(false);
  });
});

describe("normaliseSkills", () => {
  it("trims and de-duplicates", () => {
    expect(normaliseSkills("Postgres, postgres ,  Go,,Kubernetes")).toEqual(["Postgres", "Go", "Kubernetes"]);
  });
});
