import type { FormState } from "./form";

export interface Sample {
  key: "A" | "B" | "C" | "D";
  title: string;
  summary: string;
  form: FormState;
}

const m = (age: number, earned = 0, unearned = 0, disabled = false) => ({ age: String(age), disabled, earned: String(earned), unearned: String(unearned) });

export const SAMPLES: Sample[] = [
  {
    key: "A",
    title: "Sample A: one adult, part-time work",
    summary: "Alex is 34, lives alone and works part time. Pay is $1,100 a month and housing costs $700. Both programs come back likely eligible.",
    form: { householdSize: "1", members: [m(34, 1100)], shelterCost: "700", dependentCareCost: "0", applicantRef: "SAMPLE-A" },
  },
  {
    key: "B",
    title: "Sample B: family of four",
    summary: "Priya is 36 and has three children. She earns $4,200 a month, between the 130% and 200% lines. Food Assistance is likely eligible through categorical eligibility.",
    form: {
      householdSize: "4",
      members: [m(36, 4200), m(12), m(9), m(4)],
      shelterCost: "1400",
      dependentCareCost: "300",
      applicantRef: "SAMPLE-B",
    },
  },
  {
    key: "C",
    title: "Sample C: older couple, high housing cost",
    summary: "Walter is 67. His wife Ruth is 64 and has a disability. They get $3,700 a month, which is over the 200% line, but housing is $2,650 and Ruth's adult day care is $800. Food Assistance passes on the net income test. Healthy Michigan Plan needs a review because of Walter's age.",
    form: {
      householdSize: "2",
      members: [m(67, 0, 2400), m(64, 0, 1300, true)],
      shelterCost: "2650",
      dependentCareCost: "800",
      applicantRef: "SAMPLE-C",
    },
  },
  {
    key: "D",
    title: "Sample D: pay does not match the record",
    summary: "Jordan is 29 and lives with a 5-year-old. Jordan reports $1,900 a month in pay, but the made-up wage record shows about $1,100. Food Assistance needs a worker to review it.",
    form: {
      householdSize: "2",
      members: [m(29, 1900), m(5)],
      shelterCost: "950",
      dependentCareCost: "400",
      applicantRef: "SAMPLE-D",
    },
  },
];
