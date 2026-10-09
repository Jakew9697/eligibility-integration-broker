import { fapLimits, hmpMonthlyLimit } from "./limits";
import type { ProgramDetermination, RuleInput } from "./types";

const WAGE_TOLERANCE = 100;

const cents = (n: number) => Math.round(n * 100) / 100;
const str = (n: number) => String(cents(n));
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export function grossIncome(input: RuleInput): number {
  return cents(sum(input.members.map((m) => m.earned + m.unearned)));
}

/** A member who is 60 or older, or has a disability, puts the group in the SDV category. */
export function hasSdvMember(input: RuleInput): boolean {
  return input.members.some((m) => m.age >= 60 || m.disabled);
}

/**
 * BEM 556 net income, reduced to the steps this demo models: earned income counts at 80%,
 * dependent care comes out, then shelter above half of what is left comes out with no cap (SDV).
 * The standard deduction is deliberately not modeled, and no benefit amount is estimated.
 */
export function netIncome(input: RuleInput) {
  const earned = sum(input.members.map((m) => m.earned));
  const unearned = sum(input.members.map((m) => m.unearned));
  const counted = earned * 0.8 + unearned;
  const afterCare = Math.max(0, counted - input.dependentCareCost);
  const excessShelter = Math.max(0, input.shelterCost - afterCare / 2);
  return {
    counted: cents(counted),
    care: cents(counted - afterCare),
    afterCare: cents(afterCare),
    excessShelter: cents(excessShelter),
    net: cents(Math.max(0, afterCare - excessShelter)),
  };
}

function determineFap(input: RuleInput): ProgramDetermination {
  const limits = fapLimits(input.householdSize);
  const gross = grossIncome(input);
  const size = String(input.householdSize);

  if (input.wages.status === "verified") {
    const reported = cents(sum(input.members.map((m) => m.earned)));
    const verified = input.wages.monthlyWages;
    const difference = cents(Math.abs(reported - verified));
    if (difference > WAGE_TOLERANCE) {
      return {
        program: "FAP",
        determination: "REVIEW",
        reasons: [{ code: "FAP_WAGE_MISMATCH", params: { reported: str(reported), verified: str(verified), difference: str(difference) } }],
      };
    }
  }

  const limitParams = { gross: str(gross), limit: str(limits.categorical200), size };
  if (gross <= limits.categorical200) {
    return { program: "FAP", determination: "ELIGIBLE", reasons: [{ code: "FAP_CAT_GROSS_200", params: limitParams }] };
  }
  if (!hasSdvMember(input)) {
    return { program: "FAP", determination: "INELIGIBLE", reasons: [{ code: "FAP_GROSS_OVER_200", params: limitParams }] };
  }

  const net = netIncome(input);
  const eligible = net.net <= limits.net100;
  return {
    program: "FAP",
    determination: eligible ? "ELIGIBLE" : "INELIGIBLE",
    reasons: [
      { code: "FAP_SDV_GROSS_OVER_200", params: limitParams },
      {
        code: "FAP_NET_INCOME_FIGURED",
        params: { counted: str(net.counted), care: str(net.care), shelter: str(net.excessShelter), afterCare: str(net.afterCare), net: str(net.net) },
      },
      { code: eligible ? "FAP_SDV_NET_UNDER_100" : "FAP_SDV_NET_OVER_100", params: { net: str(net.net), limit: str(limits.net100), size } },
    ],
  };
}

function determineHmp(input: RuleInput): ProgramDetermination {
  const applicant = input.members[0];
  if (!applicant) throw new RangeError("At least one household member is required");
  const age = String(applicant.age);
  if (applicant.age < 19) return { program: "HMP", determination: "REVIEW", reasons: [{ code: "HMP_AGE_UNDER_19", params: { age } }] };
  if (applicant.age >= 65) return { program: "HMP", determination: "REVIEW", reasons: [{ code: "HMP_AGE_65_PLUS", params: { age } }] };

  const income = grossIncome(input);
  const limit = hmpMonthlyLimit(input.householdSize);
  const params = { income: str(income), limit: str(limit), size: String(input.householdSize) };
  return income <= limit
    ? { program: "HMP", determination: "ELIGIBLE", reasons: [{ code: "HMP_INCOME_AT_OR_UNDER", params }] }
    : { program: "HMP", determination: "INELIGIBLE", reasons: [{ code: "HMP_INCOME_OVER", params }] };
}

export function determine(input: RuleInput): ProgramDetermination[] {
  return [determineFap(input), determineHmp(input)];
}
