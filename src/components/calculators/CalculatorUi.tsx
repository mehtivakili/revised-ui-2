"use client";

import type { ReactNode } from "react";
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
  return (
    <label className="calc-field">
      <span>{props.label}</span>
      <div className="calc-control input-with-unit">
        <input
          type="number"
          value={props.value}
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          onChange={(event) => props.onChange(Number(event.target.value))}
        />
        {props.unit ? <small className="calc-unit">{props.unit}</small> : null}
      </div>
    </label>
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
