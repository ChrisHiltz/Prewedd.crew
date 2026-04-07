import { describe, it, expect } from "vitest";
import {
  getNeededRoles,
  getUnfilledRoles,
  getStaffingStatus,
  skillRating,
  getWeekendWindow,
} from "../scheduling";

describe("getNeededRoles", () => {
  it("photo-only wedding with 1 photographer → [lead_photo]", () => {
    expect(
      getNeededRoles({ services: "photo", num_photographers: 1, num_videographers: 0, num_assistants: 0, assistant_roles: null, add_ons: null })
    ).toEqual(["lead_photo"]);
  });

  it("photo+video with 2 photographers → [lead_photo, second_photo, lead_video]", () => {
    expect(
      getNeededRoles({ services: "photo + video", num_photographers: 2, num_videographers: 1, num_assistants: 0, assistant_roles: null, add_ons: null })
    ).toEqual(["lead_photo", "second_photo", "lead_video"]);
  });

  it("services containing 'photobooth' does NOT trigger photo roles", () => {
    const roles = getNeededRoles({ services: "photobooth", num_photographers: 1, num_videographers: 0, num_assistants: 0, assistant_roles: null, add_ons: null });
    expect(roles).not.toContain("lead_photo");
  });

  it("num_assistants=2 + assistant_roles=['photobooth','assistant'] → both included", () => {
    expect(
      getNeededRoles({ services: null, num_photographers: 0, num_videographers: 0, num_assistants: 2, assistant_roles: ["photobooth", "assistant"], add_ons: null })
    ).toEqual(["photobooth", "assistant"]);
  });

  it("num_assistants=1 + assistant_roles=null → generic assistant", () => {
    expect(
      getNeededRoles({ services: null, num_photographers: 0, num_videographers: 0, num_assistants: 1, assistant_roles: null, add_ons: null })
    ).toEqual(["assistant"]);
  });

  it("num_assistants=1 + assistant_roles=[] → generic assistant fallback", () => {
    expect(
      getNeededRoles({ services: null, num_photographers: 0, num_videographers: 0, num_assistants: 1, assistant_roles: [], add_ons: null })
    ).toEqual(["assistant"]);
  });

  it("add_ons=['drone footage'] → includes drone", () => {
    expect(
      getNeededRoles({ services: "photo", num_photographers: 1, num_videographers: 0, num_assistants: 0, assistant_roles: null, add_ons: ["drone footage"] })
    ).toContain("drone");
  });

  it("num_photographers default 0 with photo service → no photo roles", () => {
    expect(
      getNeededRoles({ services: "photo", num_photographers: 0, num_videographers: 0, num_assistants: 0, assistant_roles: null, add_ons: null })
    ).toEqual([]);
  });
});

describe("getUnfilledRoles", () => {
  it("needed=[lead_photo, second_photo], assigned=[lead_photo] → [second_photo]", () => {
    expect(getUnfilledRoles(["lead_photo", "second_photo"], ["lead_photo"])).toEqual(["second_photo"]);
  });

  it("all filled → []", () => {
    expect(getUnfilledRoles(["lead_photo", "lead_video"], ["lead_photo", "lead_video"])).toEqual([]);
  });

  it("extra assignment beyond needed → []", () => {
    expect(getUnfilledRoles(["lead_photo"], ["lead_photo", "second_photo"])).toEqual([]);
  });

  it("needed=[], assigned=[] → []", () => {
    expect(getUnfilledRoles([], [])).toEqual([]);
  });

  it("duplicate needed roles handled correctly", () => {
    expect(getUnfilledRoles(["lead_photo", "lead_photo"], ["lead_photo"])).toEqual(["lead_photo"]);
  });
});

describe("getStaffingStatus", () => {
  const photoWedding = { services: "photo", num_photographers: 1, num_videographers: 0, num_assistants: 0, assistant_roles: null, add_ons: null };

  it("0 assignments → unstaffed", () => {
    expect(getStaffingStatus(photoWedding, [])).toBe("unstaffed");
  });

  it("1 of 3 roles filled → partial", () => {
    const wedding = { services: "photo + video", num_photographers: 2, num_videographers: 1, num_assistants: 0, assistant_roles: null, add_ons: null };
    const assignments = [{ role: "lead_photo", status: "assigned", brief_read: false, quiz_passed: false }];
    expect(getStaffingStatus(wedding, assignments)).toBe("partial");
  });

  it("all roles filled but not confirmed → staffed", () => {
    const assignments = [{ role: "lead_photo", status: "assigned", brief_read: false, quiz_passed: false }];
    expect(getStaffingStatus(photoWedding, assignments)).toBe("staffed");
  });

  it("all roles filled + all confirmed/brief-read/quiz-passed → confirmed", () => {
    const assignments = [{ role: "lead_photo", status: "confirmed", brief_read: true, quiz_passed: true }];
    expect(getStaffingStatus(photoWedding, assignments)).toBe("confirmed");
  });

  it("all roles filled, brief_read false → staffed not confirmed", () => {
    const assignments = [{ role: "lead_photo", status: "confirmed", brief_read: false, quiz_passed: true }];
    expect(getStaffingStatus(photoWedding, assignments)).toBe("staffed");
  });
});

describe("skillRating", () => {
  it("null input → 0", () => {
    expect(skillRating(null)).toBe(0);
  });

  it("undefined input → 0", () => {
    expect(skillRating(undefined)).toBe(0);
  });

  it("empty object → 0", () => {
    expect(skillRating({})).toBe(0);
  });

  it("{a:3, b:5} → 4", () => {
    expect(skillRating({ a: 3, b: 5 })).toBe(4);
  });

  it("single value → that value", () => {
    expect(skillRating({ x: 4 })).toBe(4);
  });
});

describe("getWeekendWindow", () => {
  it("Saturday → [Fri, Sat, Sun]", () => {
    const [a, b, c] = getWeekendWindow("2026-04-11");
    expect(new Date(a + "T12:00:00").getDay()).toBe(5);
    expect(b).toBe("2026-04-11");
    expect(new Date(c + "T12:00:00").getDay()).toBe(0);
  });

  it("Sunday → [Sat, Sun, Mon]", () => {
    const [a, b, c] = getWeekendWindow("2026-04-12");
    expect(new Date(a + "T12:00:00").getDay()).toBe(6);
    expect(b).toBe("2026-04-12");
    expect(new Date(c + "T12:00:00").getDay()).toBe(1);
  });

  it("Friday → [Thu, Fri, Sat]", () => {
    const [a, b, c] = getWeekendWindow("2026-04-10");
    expect(new Date(a + "T12:00:00").getDay()).toBe(4);
    expect(b).toBe("2026-04-10");
    expect(new Date(c + "T12:00:00").getDay()).toBe(6);
  });

  it("middle element is always the input date", () => {
    const date = "2026-06-15";
    const [, middle] = getWeekendWindow(date);
    expect(middle).toBe(date);
  });
});
