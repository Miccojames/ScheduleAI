"use client";

import { useRef } from "react";
import { cn } from "cn";

const LENGTH = 6;

interface CodeInputProps {
  /** The digits typed so far (0–6 characters). */
  value: string;
  onChange: (next: string) => void;
  /** Fires as soon as the sixth digit lands — the caller may auto-submit. */
  onComplete?: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  invalid?: boolean;
  /** Stable id prefix so callers can re-focus the first box (e.g. after an error). */
  idPrefix?: string;
}

/**
 * Six single-digit boxes for OTP entry: auto-advance, backspace steps back,
 * pasting the whole code fills every box, and the first box advertises
 * `one-time-code` so iOS/Android SMS+email autofill can fill it in one tap.
 * The value stays a plain digits string — the parent owns it.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus,
  invalid,
  idPrefix = "code",
}: CodeInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const focusBox = (i: number) => refs.current[i]?.focus();

  const handleChange = (i: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 0) {
      // A delete/select cleared this box — drop its digit (later ones shift up).
      onChange(value.slice(0, i) + value.slice(i + 1));
      return;
    }

    // Paste lands as multi-character input in one box: overwrite from this
    // position onward. Clicking a box past the end appends instead.
    const start = Math.min(i, value.length);
    const next = (value.slice(0, start) + digits + value.slice(start + digits.length)).slice(0, LENGTH);
    onChange(next);

    if (next.length === LENGTH) {
      focusBox(LENGTH - 1);
      onComplete?.(next);
    } else if (digits.length > 1 || i >= value.length) {
      focusBox(Math.min(next.length, LENGTH - 1)); // advanced (paste / appended)
    }
    // Single digit overwriting an existing box: keep focus where it is.
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (value[i] !== undefined) {
        onChange(value.slice(0, i) + value.slice(i + 1));
      } else if (i > 0) {
        onChange(value.slice(0, i - 1) + value.slice(i));
        focusBox(i - 1);
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      focusBox(i - 1);
    } else if (e.key === "ArrowRight" && i < LENGTH - 1) {
      e.preventDefault();
      focusBox(i + 1);
    } else if (e.key === "Enter" && value.length === LENGTH) {
      e.preventDefault();
      onComplete?.(value);
    }
  };

  return (
    <div className="flex justify-center gap-2" role="group" aria-label="Verification code">
      {Array.from({ length: LENGTH }, (_, i) => (
        <input
          key={i}
          id={`${idPrefix}-${i}`}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={LENGTH}
          value={value[i] ?? ""}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1} of ${LENGTH}`}
          aria-invalid={invalid || undefined}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className={cn(
            "h-12 w-11 rounded-lg border border-input bg-transparent text-center text-lg font-semibold tabular-nums text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30",
            invalid && "border-destructive ring-3 ring-destructive/20",
          )}
        />
      ))}
    </div>
  );
}
