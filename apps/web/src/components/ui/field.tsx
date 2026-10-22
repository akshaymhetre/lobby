"use client";

import * as React from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { Label } from "./label";

export interface FieldProps {
  label: React.ReactNode;
  /** Shown under the control in muted text. */
  help?: React.ReactNode;
  /** Replaces help and marks the control invalid. */
  error?: React.ReactNode;
  required?: boolean;
  /** Optional element aligned to the right of the label, e.g. a "Forgot?" link. */
  aside?: React.ReactNode;
  className?: string;
  /**
   * Set when the child is a composite (e.g. <Select>) whose focusable element is nested:
   * pass the same id to the inner trigger yourself. Field then labels it without cloning.
   */
  controlId?: string;
  /** A single control. Field wires id, aria-describedby and aria-invalid onto it. */
  children: React.ReactElement<Record<string, unknown>>;
}

export function Field({ label, help, error, required, aside, className, controlId, children }: FieldProps) {
  const autoId = React.useId();
  const childProps = children.props as { id?: string; "aria-describedby"?: string };
  const id = controlId ?? childProps.id ?? `field-${autoId}`;
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy =
    [childProps["aria-describedby"], error ? errorId : help ? helpId : null].filter(Boolean).join(" ") || undefined;

  const control = controlId
    ? children
    : React.cloneElement(children, {
    id,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
    "aria-required": required || undefined,
  });

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>
          {label}
          {required ? (
            <span className="ml-0.5 text-danger-text" aria-hidden>
              *
            </span>
          ) : null}
        </Label>
        {aside ? <div className="text-small text-muted">{aside}</div> : null}
      </div>
      {control}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-small text-danger-text">
          <CircleAlert className="mt-px size-3.5 shrink-0 stroke-[1.5]" aria-hidden />
          <span>{error}</span>
        </p>
      ) : help ? (
        <p id={helpId} className="max-w-lg text-small text-muted">
          {help}
        </p>
      ) : null}
    </div>
  );
}
