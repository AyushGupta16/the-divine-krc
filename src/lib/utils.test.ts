import { describe, expect, it } from "vitest";

import { initialsOf } from "@/lib/utils";

describe("initialsOf", () => {
  // Fixtures of its own. The only test of this used to live in settings.test.ts
  // keyed off a seeded member's name, so renaming a mock staff member turned
  // the badge logic red — the function was fine, the seed had moved.
  it("takes the first letter of the first two words", () => {
    expect(initialsOf("Shivam Gupta")).toBe("SG");
    expect(initialsOf("Sneha Pillai")).toBe("SP");
  });

  it("uppercases, however the name was typed", () => {
    expect(initialsOf("shivam gupta")).toBe("SG");
  });

  it("stops at two, however many names someone has", () => {
    expect(initialsOf("Ayush Kumar Gupta Menon")).toBe("AK");
  });

  it("gives a single name a single letter rather than padding it", () => {
    expect(initialsOf("Vinod")).toBe("V");
  });

  it("survives the whitespace a form will eventually hand it", () => {
    expect(initialsOf("  Rahul   Menon  ")).toBe("RM");
    expect(initialsOf("")).toBe("");
  });
});
