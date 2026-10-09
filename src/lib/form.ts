/** Form state is kept as strings so a half-typed value never turns into NaN while editing. */
export interface MemberForm {
  age: string;
  disabled: boolean;
  earned: string;
  unearned: string;
}

export interface FormState {
  householdSize: string;
  members: MemberForm[];
  shelterCost: string;
  dependentCareCost: string;
  applicantRef: string;
}

export const emptyMember = (): MemberForm => ({ age: "", disabled: false, earned: "0", unearned: "0" });

export const emptyForm = (): FormState => ({
  householdSize: "1",
  members: [emptyMember()],
  shelterCost: "0",
  dependentCareCost: "0",
  applicantRef: "",
});

export function resizeMembers(form: FormState, size: string): FormState {
  const n = Number(size);
  const members = form.members.slice(0, n);
  while (members.length < n) members.push(emptyMember());
  return { ...form, householdSize: size, members };
}

/** Blank becomes undefined so the gateway reports it as missing. Anything else becomes a number, possibly NaN. */
function num(text: string): number | undefined {
  const cleaned = text.replace(/[$,\s]/g, "");
  return cleaned === "" ? undefined : Number(cleaned);
}

export function toRequest(form: FormState): unknown {
  return {
    householdSize: num(form.householdSize),
    members: form.members.map((m) => ({
      age: num(m.age),
      disabled: m.disabled,
      earnedIncome: num(m.earned),
      unearnedIncome: num(m.unearned),
    })),
    shelterCost: num(form.shelterCost),
    dependentCareCost: num(form.dependentCareCost),
    applicantRef: form.applicantRef.trim() === "" ? undefined : form.applicantRef.trim().toUpperCase(),
  };
}

/** Maps a gateway error path such as members.0.age to the id of the control to focus. */
export function fieldId(path: string): string {
  if (path === "" || path === "members") return "field-householdSize";
  return `field-${path.replace(/\./g, "-")}`;
}
