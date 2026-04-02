"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface EditableCellProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "textarea" | "select" | "number";
  options?: { value: string; label: string }[];
  className?: string;
  displayClassName?: string;
  rows?: number;
}

export function EditableCell({
  value,
  onChange,
  placeholder = "Click to edit...",
  type = "text",
  options,
  className,
  displayClassName,
  rows = 2,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement || inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.select();
      }
    }
  }, [editing]);

  function handleBlur() {
    setEditing(false);
    if (localValue !== value) {
      onChange(localValue);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && type !== "textarea") {
      handleBlur();
    }
    if (e.key === "Escape") {
      setLocalValue(value);
      setEditing(false);
    }
  }

  if (editing) {
    if (type === "select" && options) {
      return (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={localValue}
          onChange={(e) => {
            setLocalValue(e.target.value);
            onChange(e.target.value);
            setEditing(false);
          }}
          onBlur={handleBlur}
          className={cn(
            "h-7 rounded border border-primary bg-background px-2 text-sm text-foreground focus:outline-none",
            className
          )}
        >
          <option value="">Select...</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }

    if (type === "textarea") {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          rows={rows}
          className={cn(
            "w-full resize-none rounded border border-primary bg-background px-2 py-1 text-sm text-foreground focus:outline-none",
            className
          )}
        />
      );
    }

    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={type === "number" ? "number" : "text"}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cn(
          "h-7 w-full rounded border border-primary bg-background px-2 text-sm text-foreground focus:outline-none",
          className
        )}
      />
    );
  }

  return (
    <span
      onDoubleClick={() => setEditing(true)}
      className={cn(
        "cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-muted",
        !value && "text-muted-foreground/50 italic",
        displayClassName
      )}
      title="Double-click to edit"
    >
      {type === "select" && options
        ? options.find((o) => o.value === value)?.label || value || placeholder
        : value || placeholder}
    </span>
  );
}
