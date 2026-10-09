export type ProgramCode = "FAP" | "HMP";
export type Determination = "ELIGIBLE" | "INELIGIBLE" | "REVIEW";

export interface RuleMember {
  age: number;
  disabled: boolean;
  earned: number;
  unearned: number;
}

export type WageVerification =
  | { status: "not-requested" }
  | { status: "no-record" }
  | { status: "verified"; monthlyWages: number };

export interface RuleInput {
  householdSize: number;
  /** The first member is the applicant. HMP is judged on that person's age. */
  members: RuleMember[];
  shelterCost: number;
  dependentCareCost: number;
  wages: WageVerification;
}

export type ReasonCode =
  | "FAP_CAT_GROSS_200"
  | "FAP_GROSS_OVER_200"
  | "FAP_SDV_GROSS_OVER_200"
  | "FAP_NET_INCOME_FIGURED"
  | "FAP_SDV_NET_UNDER_100"
  | "FAP_SDV_NET_OVER_100"
  | "FAP_WAGE_MISMATCH"
  | "HMP_INCOME_AT_OR_UNDER"
  | "HMP_INCOME_OVER"
  | "HMP_AGE_UNDER_19"
  | "HMP_AGE_65_PLUS";

export interface ReasonRef {
  code: ReasonCode;
  params: Record<string, string>;
}

export interface ProgramDetermination {
  program: ProgramCode;
  determination: Determination;
  reasons: ReasonRef[];
}
