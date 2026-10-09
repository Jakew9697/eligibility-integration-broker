import type { Policy, ProgramStatus } from "../contracts";
import { BEM_137, BEM_213, BEM_556, RFT_250 } from "./policy";
import type { Determination, ProgramCode, ReasonCode } from "./types";

type Params = Record<string, string>;
interface Parts {
  found: string;
  why: string;
  action: string;
}
interface CatalogEntry {
  policy: Policy;
  parts: (p: Params) => Parts;
}

export function money(value: string | number | undefined): string {
  const n = Number(value);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: Number.isInteger(n) ? 0 : 2 });
}

const people = (size: string | undefined) => (size === "1" ? "1 person" : `${size} people`);

const APPLY_NOTE = "A worker checks proof before any decision.";

/** Reason catalog: every code the rules can return, with plain-language text and its policy cite. */
export const REASON_CATALOG: Record<ReasonCode, CatalogEntry> = {
  FAP_CAT_GROSS_200: {
    policy: BEM_213,
    parts: (p) => ({
      found: `Your household reported ${money(p.gross)} a month before deductions. The limit for ${people(p.size)} is ${money(p.limit)}.`,
      why: "Food Assistance uses a limit of 200% of the federal poverty line for most households. Your income is at or under it, so the household passes the income test.",
      action: `You can apply. ${APPLY_NOTE}`,
    }),
  },
  FAP_GROSS_OVER_200: {
    policy: RFT_250,
    parts: (p) => ({
      found: `Your household reported ${money(p.gross)} a month before deductions. The limit for ${people(p.size)} is ${money(p.limit)}.`,
      why: "Income over the limit means the household does not pass the income test. Nobody in the household is 60 or older or has a disability, so no second test applies.",
      action: "If your income changes or someone joins the household, run this again. You can still apply, and only a worker can make a decision.",
    }),
  },
  FAP_SDV_GROSS_OVER_200: {
    policy: BEM_213,
    parts: (p) => ({
      found: `Your household reported ${money(p.gross)} a month before deductions. That is over the ${money(p.limit)} limit for ${people(p.size)}.`,
      why: "A household with someone who is 60 or older, or who has a disability, gets a second look. Income is checked again after allowed costs, against a lower limit.",
      action: "See the next two notes for how that second check came out.",
    }),
  },
  FAP_NET_INCOME_FIGURED: {
    policy: BEM_556,
    parts: (p) => ({
      found: `Counting 80% of earnings plus other income gives ${money(p.counted)}. After ${money(p.care)} of dependent care, ${money(p.afterCare)} is left. Rent and utilities above half of that amount, ${money(p.shelter)}, are taken out. That leaves ${money(p.net)}.`,
      why: "The food assistance budget counts only part of earnings and takes out care and housing costs. This demo does not use the standard deduction and does not estimate a benefit amount.",
      action: "Keep rent, utility and care bills handy. A worker will ask to see them.",
    }),
  },
  FAP_SDV_NET_UNDER_100: {
    policy: BEM_213,
    parts: (p) => ({
      found: `Income after allowed costs is ${money(p.net)}. The limit for ${people(p.size)} is ${money(p.limit)}.`,
      why: "Households over the 200% limit that have an older or disabled member can still pass if income after costs is at or under 100% of the poverty line. Yours is.",
      action: `You can apply. ${APPLY_NOTE}`,
    }),
  },
  FAP_SDV_NET_OVER_100: {
    policy: BEM_213,
    parts: (p) => ({
      found: `Income after allowed costs is ${money(p.net)}. The limit for ${people(p.size)} is ${money(p.limit)}.`,
      why: "Income after costs is still over 100% of the poverty line, so the household does not pass the second test.",
      action: "If rent, care costs or income change, run this again. Only a worker can make a decision.",
    }),
  },
  FAP_WAGE_MISMATCH: {
    policy: BEM_213,
    parts: (p) => ({
      found: `You reported ${money(p.reported)} a month in earnings. The wage record shows about ${money(p.verified)} a month. The difference is ${money(p.difference)}.`,
      why: "When the two numbers are more than $100 apart, the answer depends on which one is right. A worker has to look at proof.",
      action: "A worker would send a verification checklist asking for recent pay stubs. You would have 10 calendar days to turn them in.",
    }),
  },
  HMP_INCOME_AT_OR_UNDER: {
    policy: BEM_137,
    parts: (p) => ({
      found: `Your household reported ${money(p.income)} a month. The limit for ${people(p.size)} is ${money(p.limit)}.`,
      why: "Healthy Michigan Plan covers adults 19 to 64 with income up to 133% of the poverty line. Income rules also ignore 5% of the poverty line, so this demo compares against 138%.",
      action: `You can apply. Other rules, such as citizenship and not having Medicare, are checked by a worker.`,
    }),
  },
  HMP_INCOME_OVER: {
    policy: BEM_137,
    parts: (p) => ({
      found: `Your household reported ${money(p.income)} a month. The limit for ${people(p.size)} is ${money(p.limit)}.`,
      why: "Healthy Michigan Plan covers adults 19 to 64 with income up to 133% of the poverty line, plus a 5% disregard. Income here is over that.",
      action: "Other health coverage programs may still fit. A worker can check which ones.",
    }),
  },
  HMP_AGE_UNDER_19: {
    policy: BEM_137,
    parts: (p) => ({
      found: `The applicant is ${p.age} years old.`,
      why: "Healthy Michigan Plan is for adults 19 to 64. Children and teens are covered under other Medicaid categories.",
      action: "This is not a denial. A worker would look at the other Medicaid categories.",
    }),
  },
  HMP_AGE_65_PLUS: {
    policy: BEM_137,
    parts: (p) => ({
      found: `The applicant is ${p.age} years old.`,
      why: "Healthy Michigan Plan is for adults 19 to 64. People 65 and older are usually covered under other Medicaid categories.",
      action: "This is not a denial. A worker would look at the other Medicaid categories.",
    }),
  },
};

export const PROGRAM_NAMES: Record<ProgramCode, string> = {
  FAP: "Food Assistance (FAP)",
  HMP: "Healthy Michigan Plan (HMP)",
};

export const STATUS_BY_DETERMINATION: Record<Determination, ProgramStatus> = {
  ELIGIBLE: "likely-eligible",
  INELIGIBLE: "likely-ineligible",
  REVIEW: "needs-review",
};

const SHORT_NAMES: Record<ProgramCode, string> = { FAP: "Food Assistance", HMP: "Healthy Michigan Plan" };

export function headline(program: ProgramCode, status: ProgramStatus): string {
  const name = SHORT_NAMES[program];
  if (status === "likely-eligible") return `Likely eligible for ${name}`;
  if (status === "likely-ineligible") return `Likely not eligible for ${name}`;
  return `${name}: a worker needs to review this`;
}
