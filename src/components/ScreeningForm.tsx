"use client";

import type { RefObject } from "react";
import { fieldId, resizeMembers, type FormState, type MemberForm } from "@/lib/form";

export interface FieldIssue {
  path: string;
  message: string;
}

interface Props {
  form: FormState;
  onChange: (next: FormState) => void;
  issues: FieldIssue[];
  summaryRef: RefObject<HTMLDivElement | null>;
  wrongClient: boolean;
  onWrongClient: (value: boolean) => void;
  ready: boolean;
  running: boolean;
  onSubmit: () => void;
  onReset: () => void;
}

function focusField(id: string) {
  const el = document.getElementById(id);
  el?.scrollIntoView({ block: "center" });
  el?.focus();
}

function ErrorSummary({ issues, summaryRef }: { issues: FieldIssue[]; summaryRef: RefObject<HTMLDivElement | null> }) {
  if (!issues.length) return null;
  return (
    <div ref={summaryRef} tabIndex={-1} role="alert" className="error-summary mb-5" aria-labelledby="error-summary-title">
      <h3 id="error-summary-title" className="text-base font-bold" style={{ color: "var(--no-ink)" }}>
        {issues.length === 1 ? "There is 1 problem to fix" : `There are ${issues.length} problems to fix`}
      </h3>
      <ul className="mt-2 list-disc pl-5">
        {issues.map((issue, i) => {
          const id = fieldId(issue.path);
          return (
            <li key={`${issue.path}-${i}`}>
              <a
                href={`#${id}`}
                onClick={(e) => {
                  e.preventDefault();
                  focusField(id);
                }}
              >
                {issue.message}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function errorFor(issues: FieldIssue[], path: string) {
  return issues.find((i) => i.path === path)?.message;
}

function TextField(props: {
  path: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  issues: FieldIssue[];
  hint?: string;
  inputMode?: "numeric" | "decimal" | "text";
  prefix?: string;
  placeholder?: string;
  maxLength?: number;
}) {
  const id = fieldId(props.path);
  const error = errorFor(props.issues, props.path);
  const describedBy = [props.hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      <div className="relative">
        {props.prefix ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-soft)" }} aria-hidden="true">
            {props.prefix}
          </span>
        ) : null}
        <input
          id={id}
          className="input num"
          style={props.prefix ? { paddingLeft: "1.75rem" } : undefined}
          type="text"
          inputMode={props.inputMode ?? "decimal"}
          autoComplete="off"
          value={props.value}
          placeholder={props.placeholder}
          maxLength={props.maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => props.onChange(e.target.value)}
        />
      </div>
      {props.hint ? (
        <p id={`${id}-hint`} className="hint">
          {props.hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ScreeningForm(props: Props) {
  const { form, onChange, issues } = props;

  const setMember = (index: number, patch: Partial<MemberForm>) =>
    onChange({ ...form, members: form.members.map((m, i) => (i === index ? { ...m, ...patch } : m)) });
  const sizeError = errorFor(issues, "householdSize") ?? errorFor(issues, "members");

  return (
    <form
      noValidate
      aria-label="Screening request"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit();
      }}
    >
      <ErrorSummary issues={issues} summaryRef={props.summaryRef} />

      <fieldset className="grid gap-5">
        <legend className="mb-3 text-lg">Household</legend>

        <div className="field">
          <label htmlFor="field-householdSize">Household size</label>
          <select
            id="field-householdSize"
            className="input num"
            value={form.householdSize}
            aria-invalid={sizeError ? true : undefined}
            aria-describedby={sizeError ? "field-householdSize-error" : undefined}
            onChange={(e) => onChange(resizeMembers(form, e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
          {sizeError ? (
            <p id="field-householdSize-error" className="field-error">
              {sizeError}
            </p>
          ) : null}
        </div>

        {form.members.map((m, i) => (
          <fieldset key={i} className="member-box grid gap-3">
            <legend className="px-0.5">{i === 0 ? "Person 1 (the applicant)" : `Person ${i + 1}`}</legend>
            <div className="grid gap-3 min-[420px]:grid-cols-2">
              <TextField path={`members.${i}.age`} label="Age" value={m.age} inputMode="numeric" maxLength={3} issues={issues} onChange={(v) => setMember(i, { age: v })} />
              <div className="field justify-end">
                <label className="check" htmlFor={`field-members-${i}-disabled`}>
                  <input id={`field-members-${i}-disabled`} type="checkbox" checked={m.disabled} onChange={(e) => setMember(i, { disabled: e.target.checked })} />
                  Has a disability
                </label>
              </div>
              <TextField path={`members.${i}.earnedIncome`} label="Pay per month" prefix="$" value={m.earned} issues={issues} onChange={(v) => setMember(i, { earned: v })} />
              <TextField path={`members.${i}.unearnedIncome`} label="Other income per month" prefix="$" value={m.unearned} issues={issues} onChange={(v) => setMember(i, { unearned: v })} />
            </div>
          </fieldset>
        ))}
      </fieldset>

      <fieldset className="mt-6 grid gap-4">
        <legend className="mb-1 text-lg">Costs and records</legend>
        <TextField
          path="shelterCost"
          label="Rent or mortgage plus utilities, per month"
          prefix="$"
          value={form.shelterCost}
          issues={issues}
          onChange={(v) => onChange({ ...form, shelterCost: v })}
        />
        <TextField
          path="dependentCareCost"
          label="Child or adult care costs, per month"
          prefix="$"
          value={form.dependentCareCost}
          hint="Care that lets someone work or study, or care for a disabled adult."
          issues={issues}
          onChange={(v) => onChange({ ...form, dependentCareCost: v })}
        />
        <TextField
          path="applicantRef"
          label="Wage record reference (optional)"
          inputMode="text"
          maxLength={20}
          placeholder="SAMPLE-A"
          value={form.applicantRef}
          hint="The income service looks this up. Known made-up records: SAMPLE-A, SAMPLE-B, SAMPLE-D. Any other reference returns no record."
          issues={issues}
          onChange={(v) => onChange({ ...form, applicantRef: v })}
        />
      </fieldset>

      <div className="mt-6 grid gap-3">
        <label className="check" htmlFor="wrong-client">
          <input id="wrong-client" type="checkbox" checked={props.wrongClient} onChange={(e) => props.onWrongClient(e.target.checked)} />
          <span>
            Try with the wrong client
            <span className="hint block font-normal">Uses the reporting-tool client, which cannot write screenings. The gateway should answer 403.</span>
          </span>
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn btn-primary" disabled={!props.ready || props.running}>
            {props.running ? "Running..." : "Run screening"}
          </button>
          <button type="button" className="btn btn-quiet" onClick={props.onReset}>
            Clear the form
          </button>
        </div>
        {!props.ready ? (
          <p className="hint" role="status">
            Starting the demo broker and generating this session&apos;s credentials...
          </p>
        ) : null}
      </div>
    </form>
  );
}
