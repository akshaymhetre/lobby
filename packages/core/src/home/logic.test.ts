import { describe, expect, it } from "vitest";
import {
  cleanMessage, daysUntil, greetingFor, hourIn, linkParts, newJoinerWindow, nextPayday, shouldShowAnnouncement,
  startPhrase, todaySentence,
} from "./logic";

const now = new Date(Date.UTC(2026, 9, 15, 10)); // Thu 15 Oct 2026

describe("todaySentence", () => {
  it("reads naturally for any mix of counts", () => {
    expect(todaySentence({ tasks: 3, approvals: 1, tickets: 0 })).toBe("You have 3 things to do and 1 approval waiting.");
    expect(todaySentence({ tasks: 1, approvals: 0, tickets: 0 })).toBe("You have 1 thing to do.");
    expect(todaySentence({ tasks: 2, approvals: 2, tickets: 1 })).toBe(
      "You have 2 things to do, 2 approvals waiting and 1 open request.",
    );
    expect(todaySentence({ tasks: 0, approvals: 0, tickets: 0 })).toBe("Nothing needs you right now.");
  });
});

describe("greeting", () => {
  it("follows the time of day", () => {
    expect(greetingFor(6)).toBe("Good morning");
    expect(greetingFor(13)).toBe("Good afternoon");
    expect(greetingFor(22)).toBe("Good evening");
    expect(greetingFor(2)).toBe("Good evening");
  });
  it("reads the hour in the person's timezone", () => {
    expect(hourIn("Europe/Berlin", now)).toBe(12);
    expect(hourIn("Asia/Kolkata", now)).toBe(15);
    expect(hourIn("Not/AZone", now)).toBe(10);
  });
});

describe("shouldShowAnnouncement", () => {
  const base = { startsAt: new Date(Date.UTC(2026, 9, 1)), endsAt: null, mustAcknowledge: false, audienceGroupIds: [] };
  it("respects the date window", () => {
    expect(shouldShowAnnouncement(base, [], null, now)).toBe(true);
    expect(shouldShowAnnouncement({ ...base, startsAt: new Date(Date.UTC(2026, 9, 20)) }, [], null, now)).toBe(false);
    expect(shouldShowAnnouncement({ ...base, endsAt: new Date(Date.UTC(2026, 9, 14)) }, [], null, now)).toBe(false);
  });
  it("respects the audience", () => {
    expect(shouldShowAnnouncement({ ...base, audienceGroupIds: ["eng"] }, ["eng"], null, now)).toBe(true);
    expect(shouldShowAnnouncement({ ...base, audienceGroupIds: ["eng"] }, ["sales"], null, now)).toBe(false);
  });
  it("hides dismissed ones, but keeps must-acknowledge ones until acknowledged", () => {
    const dismissed = { acknowledgedAt: null, dismissedAt: now };
    expect(shouldShowAnnouncement(base, [], dismissed, now)).toBe(false);
    expect(shouldShowAnnouncement({ ...base, mustAcknowledge: true }, [], dismissed, now)).toBe(true);
    expect(
      shouldShowAnnouncement({ ...base, mustAcknowledge: true }, [], { acknowledgedAt: now, dismissedAt: null }, now),
    ).toBe(false);
  });
});

describe("new joiners", () => {
  it("covers the last 30 days and the next 14", () => {
    expect(newJoinerWindow(now)).toEqual({ from: "2026-09-15", to: "2026-10-29" });
  });
  it("phrases start dates", () => {
    expect(daysUntil("2026-10-16", now)).toBe(1);
    expect(startPhrase("2026-10-15", now)).toBe("Starts today");
    expect(startPhrase("2026-10-16", now)).toBe("Starts tomorrow");
    expect(startPhrase("2026-10-29", now)).toBe("Starts in 14 days");
    expect(startPhrase("2026-10-14", now)).toBe("Started yesterday");
    expect(startPhrase("2026-10-08", now)).toBe("Started a week ago");
    expect(startPhrase("2026-10-01", now)).toBe("Started 2 weeks ago");
  });
});

describe("nextPayday", () => {
  it("is the last working day of the month", () => {
    expect(nextPayday(now).toISOString().slice(0, 10)).toBe("2026-10-30");
  });
  it("rolls to next month once this month's payday has passed", () => {
    // 31 Oct 2026 is a Saturday; payday was Fri 30 Oct.
    expect(nextPayday(new Date(Date.UTC(2026, 9, 31))).toISOString().slice(0, 10)).toBe("2026-11-30");
  });
  it("is today on payday", () => {
    expect(nextPayday(new Date(Date.UTC(2026, 9, 30, 18))).toISOString().slice(0, 10)).toBe("2026-10-30");
  });
});

describe("linkParts", () => {
  it("links internal paths and https only", () => {
    expect(linkParts("Read the [security policy](/knowledge/it/security-policy) today.")).toEqual([
      { text: "Read the " },
      { text: "security policy", href: "/knowledge/it/security-policy" },
      { text: " today." },
    ]);
    expect(linkParts("[x](javascript:alert(1))")[0]).not.toHaveProperty("href");
    expect(linkParts("[x](//evil.example)")[0]).not.toHaveProperty("href");
  });
});

describe("cleanMessage", () => {
  it("trims and refuses empty or long messages", () => {
    expect(cleanMessage("  hi  ")).toBe("hi");
    expect(() => cleanMessage("   ")).toThrow();
    expect(() => cleanMessage("x".repeat(11), 10)).toThrow();
  });
});
