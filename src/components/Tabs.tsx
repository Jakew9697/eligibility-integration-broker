"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface TabSpec {
  id: string;
  label: string;
  content: ReactNode;
}

/** Tabs with automatic activation: arrow keys move focus and select, Home and End jump to the ends. */
export function Tabs({ tabs, active, onChange, label }: { tabs: TabSpec[]; active: string; onChange: (id: string) => void; label: string }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(e: KeyboardEvent, index: number) {
    const last = tabs.length - 1;
    const next = e.key === "ArrowRight" ? (index + 1) % tabs.length : e.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (next === null) return;
    e.preventDefault();
    const target = tabs[next];
    if (target) {
      onChange(target.id);
      refs.current[target.id]?.focus();
    }
  }

  return (
    <div>
      <div role="tablist" aria-label={label} className="tablist">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            role="tab"
            type="button"
            id={`tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            className="tab"
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={active !== t.id} className="mt-4">
          {active === t.id ? t.content : null}
        </div>
      ))}
    </div>
  );
}
