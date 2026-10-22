"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Check, CheckCircle2, Download, FileSpreadsheet, RotateCcw, Upload } from "lucide-react";
import type { ColumnMapping, ImportResult } from "@lobby/core/people/csv";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { CountUp } from "@/components/ui/motion";
import { BorderBeam } from "@/components/ui/effects/border-beam";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Table, TBody, TD, TH, THead, TRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import styles from "./day-track.module.css";
import { previewImportAction, runImportAction, type ImportPreview } from "@/app/(app)/admin/people/_actions";

type Field = { key: keyof ColumnMapping; label: string; required: boolean };
type Step = "upload" | "map" | "review" | "done";

const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "map", label: "Match columns" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
];

export function ImportWizard({ fields }: { fields: Field[] }) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("upload");
  const [fileName, setFileName] = React.useState("");
  const [text, setText] = React.useState("");
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [mapping, setMapping] = React.useState<ColumnMapping | null>(null);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [rowFilter, setRowFilter] = React.useState<"all" | "problems">("all");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const load = (file: File) => {
    setError(null);
    if (!/\.(csv|txt|tsv)$/i.test(file.name) && file.type && !file.type.includes("csv") && !file.type.startsWith("text/")) {
      setError("That does not look like a CSV file. Export your spreadsheet as CSV and try again.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("That file is over 2 MB. Split it into smaller files.");
      return;
    }
    file.text().then((t) =>
      start(async () => {
        const res = await previewImportAction(t);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setFileName(file.name);
        setText(t);
        setPreview(res.data);
        setMapping(res.data.mapping);
        setStep("map");
      }),
    );
  };

  const revalidate = (next: ColumnMapping, goTo: Step) =>
    start(async () => {
      const res = await previewImportAction(text, next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPreview(res.data);
      setMapping(res.data.mapping);
      setStep(goTo);
    });

  const runImport = () =>
    start(async () => {
      if (!mapping) return;
      const res = await runImportAction(text, mapping);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResult(res.data);
      setStep("done");
      router.refresh();
    });

  const reset = () => {
    setStep("upload");
    setText("");
    setFileName("");
    setPreview(null);
    setMapping(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const rows = preview?.rows ?? [];
  const errorRows = rows.filter((r) => r.errors.length).length;
  const warnRows = rows.filter((r) => !r.errors.length && r.warnings.length).length;
  const existing = new Set(preview?.existing ?? []);
  const updates = rows.filter((r) => !r.errors.length && existing.has(r.email)).length;
  const creates = rows.length - errorRows - updates;
  const sample = (col: number) => (col >= 0 ? sampleValue(text, col) : "");

  return (
    <div className="flex flex-col gap-6">
      {/* The steps as a track of pills: the current one is the raised accent pill, done ones carry a tick. */}
      <ol className="flex flex-wrap items-center gap-1 text-small" aria-label="Import steps">
        {STEPS.map((s, i) => {
          const idx = STEPS.findIndex((x) => x.key === step);
          const state = i < idx ? "done" : i === idx ? "current" : "todo";
          return (
            <li key={s.key} className="flex items-center gap-1" aria-current={state === "current" ? "step" : undefined}>
              <span
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-full pl-1.5 pr-3 transition-[background-color,color,box-shadow] duration-160",
                  state === "current" && "bg-accent font-medium text-accent-fg shadow-cell",
                  state === "done" && "text-fg",
                  state === "todo" && "text-muted",
                )}
              >
                <span
                  className={cn(
                    "tabular inline-flex size-5 items-center justify-center rounded-full text-caption font-medium",
                    state === "current" && "bg-raised/20 text-accent-fg",
                    state === "done" && "bg-success-soft text-success-text",
                    state === "todo" && "bg-sunken text-muted",
                  )}
                >
                  {state === "done" ? <Check className="size-3 stroke-[2.5]" aria-hidden /> : i + 1}
                </span>
                {/* On a phone only the current step names itself, so the track stays on one line. */}
                <span className={state === "current" ? undefined : "sr-only sm:not-sr-only"}>{s.label}</span>
              </span>
              {i < STEPS.length - 1 ? <span className="mx-1 hidden h-px w-4 bg-border-strong sm:block" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>

      {step === "upload" ? (
        <div className="flex flex-col gap-4">
          <label
            htmlFor="csv-file"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) load(f);
            }}
            className={cn(
              "panel relative isolate flex cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-panel px-6 pb-12 pt-10 text-center transition-[background-color,box-shadow] duration-160",
              "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-accent-ring",
              dragging ? "bg-accent-soft" : "hover:shadow-cell-hover",
            )}
          >
            {/* While a file hovers over the zone, a light runs round its edge until it is dropped. */}
            <BorderBeam tone="accent" loops="infinite" duration={1.8} active={dragging || pending} settle="none" />
            {/* The sheet we expect, drawn as one: the columns we read, the required one in colour. */}
            <span className="mb-3 flex w-full max-w-[640px] flex-col gap-1.5 [mask-image:linear-gradient(to_right,black_75%,transparent)]" aria-hidden>
              <span className="flex gap-1.5 overflow-hidden">
                {fields.map((f) => (
                  <span
                    key={f.key}
                    className={cn(
                      "flex h-8 min-w-[92px] flex-1 items-center justify-center truncate rounded-[8px] px-2 text-caption font-medium",
                      f.required ? "cat-blue" : "bg-raised text-muted shadow-cell",
                    )}
                  >
                    {f.label}
                  </span>
                ))}
              </span>
              {[0, 1].map((r) => (
                <span key={r} className="flex gap-1.5 overflow-hidden" style={{ opacity: 0.7 - r * 0.3 }}>
                  {fields.map((f) => (
                    <span key={f.key} className="h-6 min-w-[92px] flex-1 rounded-[7px] bg-raised/70" />
                  ))}
                </span>
              ))}
            </span>
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-raised text-accent-text shadow-cell" aria-hidden>
              <FileSpreadsheet className="size-5 stroke-[1.5]" />
            </span>
            <span className="text-h4 font-medium text-fg">{pending ? "Reading your file" : "Drop a CSV here, or choose a file"}</span>
            <span className="max-w-[440px] text-body text-muted">
              One person per row with a work email. Names, titles, teams, locations, managers, start dates and groups are optional.
            </span>
            <span className={buttonVariants({ variant: "primary", size: "md", className: cn("mt-1", pending && "opacity-60") })}>
              <Upload aria-hidden />
              Choose file
            </span>
            <input
              ref={inputRef}
              id="csv-file"
              type="file"
              accept=".csv,.tsv,.txt,text/csv"
              className="sr-only"
              disabled={pending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) load(f);
              }}
            />
          </label>
          {error ? (
            <p role="alert" className="flex items-start gap-2 rounded-cell bg-danger-soft px-3 py-2.5 text-body text-danger-text">
              <AlertCircle className="mt-0.5 size-4 shrink-0 stroke-[1.5]" aria-hidden />
              {error}
            </p>
          ) : null}
          <div className="cell flex flex-col gap-3 rounded-card p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-body font-medium text-fg">Start from our template</span>
              <span className="text-small text-muted">
                Groups can be separated with semicolons. Dates work as 2026-03-14 or 14/03/2026. Managers are matched by email.
              </span>
            </div>
            <Button asChild variant="secondary" size="sm">
              <a href="/admin/people/import/template" download>
                <Download aria-hidden />
                Download template
              </a>
            </Button>
          </div>
        </div>
      ) : null}

      {step === "map" && preview && mapping ? (
        <div className="flex flex-col gap-4">
          <div className="panel rounded-panel">
            <div className="flex flex-col gap-0.5 border-b border-border px-5 py-4">
              <h2 className="text-h4 font-medium text-fg">Match your columns</h2>
              <p className="text-small text-muted">
                We guessed from the headers in <span className="font-medium text-fg">{fileName}</span> ({preview.totalRows} rows). Change anything that looks wrong.
              </p>
            </div>
            <ul className="divide-y divide-border">
              {fields.map((f) => (
                <li key={f.key} className="grid grid-cols-1 items-center gap-2 px-5 py-3 sm:grid-cols-[200px_minmax(0,1fr)_minmax(0,1fr)] sm:gap-4">
                  <label htmlFor={`map-${f.key}`} className="text-body font-medium text-fg">
                    {f.label}
                    {f.required ? <span className="ml-0.5 text-danger-text" aria-hidden>*</span> : null}
                  </label>
                  <Select value={String(mapping[f.key])} onValueChange={(v) => setMapping({ ...mapping, [f.key]: Number(v) })}>
                    <SelectTrigger id={`map-${f.key}`} aria-invalid={f.required && mapping[f.key] < 0 ? true : undefined}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-1">{f.required ? "Pick a column" : "Do not import"}</SelectItem>
                      {preview.headers.map((h, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {h || `Column ${i + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="truncate text-small text-muted">
                    {mapping[f.key] >= 0 ? (
                      <>
                        <span className="text-subtle">For example </span>
                        {sample(mapping[f.key]) || <span className="text-subtle">(empty)</span>}
                      </>
                    ) : (
                      <span className="text-subtle">Not imported</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={reset}>
              <ArrowLeft aria-hidden />
              Choose another file
            </Button>
            <Button
              loading={pending}
              disabled={mapping.email < 0}
              onClick={() => revalidate(mapping, "review")}
            >
              {mapping.email < 0 ? "Pick the email column first" : "Review rows"}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "review" && preview ? (
        <div className="flex flex-col gap-4">
          {/* The review's lead: the file as one bar of outcomes, sized by rows, wiping in and counting up. */}
          <Outcomes
            items={[
              { label: "New people", value: creates, fill: "cat-green", dot: "bg-cat-green" },
              { label: "Updates", value: updates, hint: "Matched by email", fill: "cat-blue", dot: "bg-cat-blue" },
              { label: "Warnings", value: warnRows, fill: "cat-amber", dot: "bg-cat-amber" },
              { label: "Will be skipped", value: errorRows, fill: "bg-danger-soft text-danger-text", dot: "bg-danger" },
            ]}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-body font-medium text-fg">
              {rows.length} {rows.length === 1 ? "row" : "rows"}
              {preview.totalRows > rows.length ? <span className="font-normal text-muted"> (the first {rows.length} of {preview.totalRows})</span> : null}
            </h2>
            <SegmentedControl
              aria-label="Rows to show"
              size="sm"
              value={rowFilter}
              onValueChange={(v) => setRowFilter(v as typeof rowFilter)}
              options={[
                { value: "all", label: "All rows" },
                { value: "problems", label: `Problems ${errorRows + warnRows}` },
              ]}
            />
          </div>
          <Table wrapperClassName="max-h-[520px] overflow-y-auto">
            <THead className="sticky top-0 z-10 bg-sunken dark:bg-raised">
              <tr>
                <TH className="w-14" align="right">Line</TH>
                <TH>Person</TH>
                <TH className="hidden md:table-cell">Title and team</TH>
                <TH className="hidden lg:table-cell">Manager</TH>
                <TH>Result</TH>
              </tr>
            </THead>
            <TBody>
              {rows
                .filter((r) => rowFilter === "all" || r.errors.length || r.warnings.length)
                .map((r) => (
                  <TRow key={r.line} className={r.errors.length ? "bg-danger-soft/40" : undefined}>
                    <TD numeric className="text-muted">
                      {r.line}
                    </TD>
                    <TD className="max-w-[260px]">
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-fg">{r.displayName || <span className="text-subtle">No name</span>}</span>
                        <span className="truncate text-small text-muted">{r.email || "No email"}</span>
                      </div>
                    </TD>
                    <TD className="hidden max-w-[240px] md:table-cell">
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{r.title ?? <span className="text-subtle">No title</span>}</span>
                        <span className="truncate text-small text-muted">{[r.department, r.location].filter(Boolean).join(", ")}</span>
                      </div>
                    </TD>
                    <TD className="hidden max-w-[200px] truncate text-small text-muted lg:table-cell">{r.managerEmail ?? ""}</TD>
                    <TD className="min-w-[180px] py-2">
                      {r.errors.length ? (
                        <div className="flex flex-col gap-1">
                          <Badge tone="danger" dot size="sm" className="self-start">
                            Skipped
                          </Badge>
                          {r.errors.map((e) => (
                            <span key={e} className="text-small text-danger-text">
                              {e}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <Badge tone={existing.has(r.email) ? "info" : "success"} dot size="sm" className="self-start">
                            {existing.has(r.email) ? "Update" : "New"}
                          </Badge>
                          {r.warnings.map((w) => (
                            <span key={w} className="text-small text-warning-text">
                              {w}
                            </span>
                          ))}
                        </div>
                      )}
                    </TD>
                  </TRow>
                ))}
            </TBody>
          </Table>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={() => setStep("map")} disabled={pending}>
              <ArrowLeft aria-hidden />
              Back to columns
            </Button>
            <Button loading={pending} disabled={creates + updates === 0} onClick={runImport}>
              {creates + updates === 0 ? "Nothing to import" : `Import ${creates + updates} ${creates + updates === 1 ? "person" : "people"}`}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "done" && result ? (
        <div className="panel relative isolate flex flex-col items-center gap-4 rounded-panel px-6 py-14 text-center">
          <BorderBeam tone="green" loops={1} delay={0.2} />
          <span className="cat-green inline-flex size-14 items-center justify-center rounded-full shadow-cell" aria-hidden>
            <CheckCircle2 className="size-7 stroke-[1.5]" />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-h3 font-medium text-fg">Import finished</h2>
            <p className="max-w-[480px] text-body text-muted">
              {[
                `${result.created} added`,
                `${result.updated} updated`,
                result.skipped ? `${result.skipped} skipped` : null,
                plural(result.managersSet, "reporting line", "reporting lines") + " set",
                result.groupsCreated ? plural(result.groupsCreated, "new group", "new groups") : null,
                result.membershipsAdded ? plural(result.membershipsAdded, "group membership", "group memberships") + " added" : null,
              ]
                .filter(Boolean)
                .join(", ")}
              .
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild variant="secondary">
              <Link href="/admin/people">See everyone</Link>
            </Button>
            <Button variant="ghost" onClick={reset}>
              <RotateCcw aria-hidden />
              Import another file
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * What the import will do, as one bar: each outcome a segment sized by its rows (empty ones drop
 * out of the bar but keep their place in the legend, so "0 warnings" still reads).
 */
function Outcomes({ items }: { items: { label: string; value: number; hint?: string; fill: string; dot: string }[] }) {
  const total = items.reduce((a, i) => a + i.value, 0) || 1;
  return (
    <section className="panel flex flex-col gap-4 rounded-panel p-4 sm:p-5" aria-label="Import summary">
      <div className="flex h-14 w-full gap-1" aria-hidden>
        {items
          .filter((i) => i.value > 0)
          .map((i, n) => (
            <span
              key={i.label}
              className={cn(styles.band, "flex min-w-11 items-center gap-2 overflow-hidden rounded-cell px-3 shadow-cell", i.fill)}
              style={{ flexGrow: i.value / total, flexBasis: 0, ["--d" as string]: `${100 + n * 110}ms` }}
            >
              <CountUp value={i.value} duration={0.7} delay={0.2 + n * 0.11} className="text-h4 font-medium" />
              {i.value / total > 0.18 ? <span className="truncate text-small">{i.label}</span> : null}
            </span>
          ))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-small text-muted">
        {items.map((i) => (
          <li key={i.label} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 shrink-0 rounded-full", i.dot)} aria-hidden />
            {i.label}
            {/* The bar already shows the non-zero counts; the legend only spells out a zero. */}
            {i.value === 0 ? <span className="font-medium text-fg">0</span> : null}
            {i.hint && i.value ? <span className="text-muted">({i.hint.toLowerCase()})</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** First non-empty value in a column, read client-side for the mapping preview. */
function sampleValue(text: string, col: number): string {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).slice(1, 20);
  const delim = (text.split(/\r?\n/, 1)[0] ?? "").split(";").length > (text.split(/\r?\n/, 1)[0] ?? "").split(",").length ? ";" : ",";
  for (const line of lines) {
    const cells = splitLine(line, delim);
    const v = cells[col]?.trim();
    if (v) return v;
  }
  return "";
}

function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
