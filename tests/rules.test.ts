import { describe, expect, it } from "vitest";
import { annualGuideline, fapLimits, hmpMonthlyLimit } from "../src/broker/rules/limits";
import { determine, netIncome } from "../src/broker/rules";
import { REASON_CATALOG } from "../src/broker/rules/catalog";
import { member, ruleInput } from "./helpers";

const fap = (input: ReturnType<typeof ruleInput>) => determine(input)[0]!;
const hmp = (input: ReturnType<typeof ruleInput>) => determine(input)[1]!;
const cites = (d: ReturnType<typeof fap>) => d.reasons.map((r) => `${REASON_CATALOG[r.code].policy.manual} ${REASON_CATALOG[r.code].policy.item}`);

describe("T1 FAP limits match RFT 250 effective 10-1-2026", () => {
  it("uses the 2026 HHS guideline", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(annualGuideline)).toEqual([15960, 21640, 27320, 33000, 38680, 44360, 50040, 55720]);
    expect(annualGuideline(9)).toBe(55720 + 5680);
  });

  it("household of 1 and of 4", () => {
    expect(fapLimits(1)).toEqual({ gross130: 1729, net100: 1330, categorical200: 2660 });
    expect(fapLimits(4)).toEqual({ gross130: 3575, net100: 2750, categorical200: 5500 });
  });

  it("reproduces every published row from 1 to 8", () => {
    const published = [
      [1729, 1330, 2660],
      [2345, 1804, 3608],
      [2960, 2277, 4554],
      [3575, 2750, 5500],
      [4191, 3224, 6448],
      [4806, 3697, 7394],
      [5421, 4170, 8340],
      [6037, 4644, 9288],
    ];
    published.forEach(([g, n, c], i) => {
      expect(fapLimits(i + 1), `size ${i + 1}`).toEqual({ gross130: g, net100: n, categorical200: c });
    });
  });

  it("adds 616, 474 and 948 for each additional person", () => {
    const eight = fapLimits(8);
    const nine = fapLimits(9);
    expect(nine.gross130 - eight.gross130).toBe(616);
    expect(nine.net100 - eight.net100).toBe(474);
    expect(nine.categorical200 - eight.categorical200).toBe(948);
    expect(fapLimits(12).categorical200 - eight.categorical200).toBe(4 * 948);
  });
});

describe("T2 categorical eligibility at 200%", () => {
  it("at the limit is likely eligible, one dollar over is not", () => {
    const limit = fapLimits(1).categorical200;
    const at = fap(ruleInput({ members: [member(40, limit)] }));
    expect(at.determination).toBe("ELIGIBLE");
    expect(cites(at)).toContain("BEM 213");
    const over = fap(ruleInput({ members: [member(40, limit + 1)] }));
    expect(over.determination).toBe("INELIGIBLE");
  });

  it("counts income from every member", () => {
    const input = ruleInput({ householdSize: 2, members: [member(30, 2000), member(30, 1608)] });
    expect(fap(input).determination).toBe("ELIGIBLE");
    expect(fap({ ...input, members: [member(30, 2000), member(30, 1609)] }).determination).toBe("INELIGIBLE");
  });
});

describe("T3 senior or disabled household over 200% uses the net income test", () => {
  const couple = (shelter: number) =>
    ruleInput({ householdSize: 2, members: [member(67, 0, 2400), member(64, 0, 1300, true)], shelterCost: shelter, dependentCareCost: 800 });

  it("computes net income per BEM 556 steps", () => {
    expect(netIncome(couple(2650))).toMatchObject({ counted: 3700, afterCare: 2900, excessShelter: 1200, net: 1700 });
  });

  it("is eligible when net is at or under 100% and cites BEM 213", () => {
    const d = fap(couple(2650));
    expect(d.determination).toBe("ELIGIBLE");
    expect(d.reasons.map((r) => r.code)).toEqual(["FAP_SDV_NET_UNDER_100", "FAP_NET_INCOME_FIGURED", "FAP_SDV_GROSS_OVER_200"]);
    expect(cites(d)).toContain("BEM 213");
    expect(cites(d)).toContain("BEM 556");
  });

  it("is ineligible when net stays over 100%", () => {
    const d = fap(couple(1500));
    expect(d.determination).toBe("INELIGIBLE");
    expect(d.reasons[0]?.code).toBe("FAP_SDV_NET_OVER_100");
  });

  it("a household with nobody 60+ or disabled over 200% is simply over the limit", () => {
    const d = fap(ruleInput({ members: [member(40, 2661)], shelterCost: 5000 }));
    expect(d.determination).toBe("INELIGIBLE");
  });

  it("a disabled adult under 60 also gets the net test", () => {
    const d = fap(ruleInput({ members: [member(45, 0, 2800, true)], shelterCost: 2800 }));
    expect(d.reasons.at(-1)?.code).toBe("FAP_SDV_GROSS_OVER_200");
  });
});

describe("T4 Healthy Michigan Plan", () => {
  it("uses 138% of the 2026 guideline", () => {
    expect(hmpMonthlyLimit(1)).toBe(1836);
    expect(hmpMonthlyLimit(4)).toBe(3795);
  });

  it("adult 19 to 64 at the limit is likely eligible and cites BEM 137", () => {
    const d = hmp(ruleInput({ members: [member(30, 1836)] }));
    expect(d.determination).toBe("ELIGIBLE");
    expect(cites(d)).toEqual(["BEM 137"]);
    expect(hmp(ruleInput({ members: [member(30, 1837)] })).determination).toBe("INELIGIBLE");
  });

  it("covers the age edges 19 and 64", () => {
    expect(hmp(ruleInput({ members: [member(19, 500)] })).determination).toBe("ELIGIBLE");
    expect(hmp(ruleInput({ members: [member(64, 500)] })).determination).toBe("ELIGIBLE");
  });

  it("65 and older is needs review for other Medicaid categories, not a denial", () => {
    const d = hmp(ruleInput({ members: [member(65, 100)] }));
    expect(d.determination).toBe("REVIEW");
    expect(d.reasons[0]?.code).toBe("HMP_AGE_65_PLUS");
    expect(REASON_CATALOG.HMP_AGE_65_PLUS.parts({ age: "65" }).action).toMatch(/not a denial/);
    expect(hmp(ruleInput({ members: [member(18, 100)] })).determination).toBe("REVIEW");
  });
});

describe("T8 wage mismatch (rules)", () => {
  const wages = (monthlyWages: number) => ({ status: "verified" as const, monthlyWages });
  it("more than $100 apart is needs review and mentions pay stubs and 10 days", () => {
    const d = fap(ruleInput({ members: [member(29, 1900)], wages: wages(1100) }));
    expect(d.determination).toBe("REVIEW");
    const text = REASON_CATALOG.FAP_WAGE_MISMATCH.parts(d.reasons[0]!.params).action;
    expect(text).toMatch(/pay stubs/);
    expect(text).toMatch(/10 calendar days/);
  });
  it("exactly $100 apart is not a mismatch, and no record is not a mismatch", () => {
    expect(fap(ruleInput({ members: [member(29, 1200)], wages: wages(1100) })).determination).toBe("ELIGIBLE");
    expect(fap(ruleInput({ members: [member(29, 1900)], wages: { status: "no-record" } })).determination).toBe("ELIGIBLE");
  });
});
