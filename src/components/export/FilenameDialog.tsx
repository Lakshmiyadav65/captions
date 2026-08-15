"use client";

import { useEffect, useId, useRef } from "react";

export function FilenameDialog({
  value,
  error,
  disabled,
  onChange,
  onCancel,
  onSubmit,
}: {
  value: string;
  error: string | null;
  disabled?: boolean;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const inputId = useId();
  const errorId = useId();
  const helpId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <form
      className="ed-export-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled) onSubmit();
      }}
    >
      <p className="ed-export-lead">Give your video a name before exporting.</p>

      <label className="ed-export-label" htmlFor={inputId}>
        File name
      </label>
      <div className="ed-export-field">
        <input
          ref={inputRef}
          id={inputId}
          className="ed-export-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={`${helpId}${error ? ` ${errorId}` : ""}`}
        />
        <span className="ed-export-suffix" aria-hidden>
          .mp4
        </span>
      </div>
      <p className="ed-export-help" id={helpId}>
        This name will be used for your downloaded video.
      </p>
      {error ? (
        <p className="ed-export-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}

      <div className="ed-export-actions">
        <button type="button" className="tc-btn tc-btn--ghost" onClick={onCancel} disabled={disabled}>
          Cancel
        </button>
        <button type="submit" className="tc-btn tc-btn--primary" disabled={disabled}>
          Rename &amp; Export
        </button>
      </div>
    </form>
  );
}
