import { z } from "zod";

/** Request and response contracts for the gateway. The Contracts view renders these as JSON Schema. */

const money = (label: string) =>
  z
    .number({ error: `${label}: enter a dollar amount.` })
    .min(0, `${label}: enter 0 or more.`)
    .max(1_000_000, `${label}: enter an amount under $1,000,000.`);

export const HouseholdMember = z.object({
  age: z
    .int({ error: "Age: enter a whole number from 0 to 120." })
    .min(0, "Age: enter a whole number from 0 to 120.")
    .max(120, "Age: enter a whole number from 0 to 120."),
  disabled: z.boolean({ error: "Has a disability: choose yes or no." }),
  earnedIncome: money("Pay per month").default(0).describe("Reported monthly wages before taxes, in dollars."),
  unearnedIncome: money("Other income per month").default(0).describe("Reported monthly income that is not wages, in dollars."),
});

export const ScreeningRequest = z
  .object({
    householdSize: z
      .int({ error: "Household size: enter a whole number from 1 to 12." })
      .min(1, "Household size: enter a whole number from 1 to 12.")
      .max(12, "Household size: enter a whole number from 1 to 12."),
    members: z
      .array(HouseholdMember, { error: "Members: list each person in the household." })
      .min(1, "Members: list at least one person.")
      .max(12, "Members: no more than 12 people."),
    shelterCost: money("Rent or mortgage plus utilities").describe("Monthly rent or mortgage plus utilities, in dollars."),
    dependentCareCost: money("Child or adult care costs").describe("Monthly cost of care that lets someone work or study, in dollars."),
    applicantRef: z
      .string()
      .regex(/^[A-Z0-9-]{1,20}$/, "Wage record reference: use capital letters, numbers and dashes, up to 20 characters.")
      .optional()
      .describe("Key the income service uses to find a wage record, such as SAMPLE-A."),
  })
  .refine((r) => r.members.length === r.householdSize, {
    path: ["members"],
    error: "Members: the number of people listed must match the household size.",
  });
export type ScreeningRequest = z.infer<typeof ScreeningRequest>;

export const Policy = z.object({
  manual: z.enum(["BEM", "RFT"]),
  item: z.string(),
  title: z.string(),
  effective: z.string().describe("ISO date the version of the item took effect."),
  url: z.url(),
});
export type Policy = z.infer<typeof Policy>;

export const ProgramStatus = z.enum(["likely-eligible", "likely-ineligible", "needs-review"]);
export type ProgramStatus = z.infer<typeof ProgramStatus>;

export const Reason = z.object({
  code: z.string(),
  text: z.string().describe("The three parts below joined into one string."),
  parts: z.object({ found: z.string(), why: z.string(), action: z.string() }),
  policy: Policy,
});
export type Reason = z.infer<typeof Reason>;

export const ProgramResult = z.object({
  program: z.enum(["FAP", "HMP"]),
  programName: z.string(),
  status: ProgramStatus,
  headline: z.string(),
  reasons: z.array(Reason),
});
export type ProgramResult = z.infer<typeof ProgramResult>;

export const TraceStep = z.object({
  step: z.string(),
  method: z.string(),
  path: z.string(),
  status: z.number(),
  ms: z.number(),
});
export type TraceStep = z.infer<typeof TraceStep>;

export const ScreeningResponse = z.object({
  correlationId: z.string(),
  results: z.array(ProgramResult),
  trace: z.array(TraceStep).describe("The gateway's own view of its downstream calls."),
});
export type ScreeningResponse = z.infer<typeof ScreeningResponse>;

export const FieldError = z.object({ path: z.string(), message: z.string() });
export const ErrorBody = z.object({
  error: z.string(),
  message: z.string(),
  correlationId: z.string(),
  fieldErrors: z.array(FieldError).optional(),
});
export type ErrorBody = z.infer<typeof ErrorBody>;

export const IncomeVerificationRequest = z.object({ applicantRef: z.string() });
export const IncomeVerificationResponse = z.object({
  applicantRef: z.string(),
  status: z.enum(["verified", "no-record"]),
  monthlyWages: z.number().nullable(),
  quarter: z.string().nullable(),
  source: z.string(),
});
export type IncomeVerificationResponse = z.infer<typeof IncomeVerificationResponse>;
