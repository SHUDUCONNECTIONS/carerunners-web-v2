import { describe, expect, it } from "vitest";
import { brandNewNothingToDisclose, conditionLabel, itemKind, type ItemCondition } from "./marketplace";

describe("itemKind", () => {
  it("keeps brand-new items apart from every kind of used item", () => {
    expect(itemKind("new")).toBe("new");
    for (const c of ["used_excellent", "used_good", "used_fair", "for_parts", "used"]) expect(itemKind(c)).toBe("used");
  });

  it("labels new items as brand new", () => {
    expect(conditionLabel("new")).toBe("Brand new");
  });
});

describe("brandNewNothingToDisclose", () => {
  const item = { condition: "new" as ItemCondition, defects: "None", knownIssues: [] as string[] };

  it("is true for a brand-new item with no defects", () => {
    expect(brandNewNothingToDisclose(item)).toBe(true);
    expect(brandNewNothingToDisclose({ ...item, defects: "  none. " })).toBe(true);
    expect(brandNewNothingToDisclose({ ...item, defects: "" })).toBe(true);
  });

  it("keeps the warning when something was disclosed, or the item is used", () => {
    expect(brandNewNothingToDisclose({ ...item, defects: "Box is dented" })).toBe(false);
    expect(brandNewNothingToDisclose({ ...item, knownIssues: ["Missing accessories"] })).toBe(false);
    expect(brandNewNothingToDisclose({ ...item, condition: "used_good" as ItemCondition })).toBe(false);
  });
});
