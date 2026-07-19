"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import type { DashboardTool } from "@/src/lib/dashboard";

export function CalculatorShell({ tool, children }: { tool: DashboardTool; children: ReactNode }) {
  return (
    <main className="app-shell">
      <section className="calc-workspace">
        <div className="calc-header">
          <div>
            <p className="eyebrow">{tool.subtitle}</p>
            <h1>{tool.title}</h1>
            <p className="lead">{tool.description}</p>
          </div>
        </div>
        {children}
      </section>
    </main>
  );
}

export function NumberInput(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  const [draft, setDraft] = useState(() => String(props.value));
  const focused = useRef(false);
  const isEmpty = draft.trim() === "";

  useEffect(() => {
    if (!focused.current) setDraft(String(props.value));
  }, [props.value]);

  return (
    <label className="calc-field">
      <span>
        {props.label} <b className="required-mark" aria-hidden="true">*</b>
      </span>
      <div className={`calc-control input-with-unit${isEmpty ? " invalid" : ""}`}>
        <input
          type="number"
          value={draft}
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          required
          aria-invalid={isEmpty}
          onFocus={() => { focused.current = true; }}
          onBlur={() => { focused.current = false; }}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            props.onChange(next === "" ? 0 : Number(next));
          }}
        />
        {props.unit ? <small className="calc-unit">{props.unit}</small> : null}
      </div>
      {isEmpty ? <small className="field-error">این فیلد نمی‌تواند خالی باشد.</small> : null}
    </label>
  );
}

export function RequiredNumberInput({
  value,
  onValueChange,
  ...inputProps
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: number;
  onValueChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(() => String(value));
  const focused = useRef(false);
  const isEmpty = draft.trim() === "";

  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  return (
    <>
      <input
        {...inputProps}
        type="number"
        value={draft}
        required
        aria-invalid={isEmpty}
        onFocus={(event) => {
          focused.current = true;
          inputProps.onFocus?.(event);
        }}
        onBlur={(event) => {
          focused.current = false;
          inputProps.onBlur?.(event);
        }}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          onValueChange(next === "" ? 0 : Number(next));
        }}
      />
      {isEmpty ? <small className="field-error">این فیلد نمی‌تواند خالی باشد.</small> : null}
    </>
  );
}

export function SelectInput<T extends string | number>(props: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
}) {
  return (
    <label className="calc-field">
      <span>{props.label}</span>
      <div className="calc-control select-control">
        <select value={props.value} onChange={(event) => props.onChange(event.target.value as T)}>
        {props.options.map((option) => (
          <option key={`${option.label}-${String(option.value)}`} value={option.value}>
            {option.label}
          </option>
        ))}
        </select>
      </div>
    </label>
  );
}

export function ResultGrid({ results }: { results: { label: string; value: string; unit?: string }[] }) {
  return (
    <div className="calc-results">
      {results.map((result) => (
        <article className="calc-result" key={`${result.label}-${result.unit ?? "value"}`}>
          <span>{result.label}</span>
          <strong>{result.value}</strong>
          {result.unit ? <small>{result.unit}</small> : null}
        </article>
      ))}
    </div>
  );
}

export function formatNumber(value: number, decimals = 0) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals
  }).format(value);
}
