import React from "react";

interface Props {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  maxLength?: number;
  validate?: (v: string) => boolean;
  error?: string | null;
  type?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
  multiline?: boolean;
  rows?: number;
  onKeyDown?: React.KeyboardEventHandler<
    HTMLInputElement | HTMLTextAreaElement
  >;
}

const ValidatedInput: React.FC<Props> = ({
  id,
  value,
  onChange,
  placeholder,
  className,
  maxLength,
  validate,
  error,
  type = "text",
  readOnly = false,
  autoFocus = false,
  multiline = false,
  rows = 3,
  onKeyDown,
}) => {
  const handleChange = (v: string) => {
    let out = v;
    if (typeof maxLength === "number") out = out.slice(0, maxLength);
    onChange(out);
  };

  const inputClass =
    className ||
    "bg-bgSurface border-borderMuted text-textMain w-full min-w-0 rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none";

  return (
    <div>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          readOnly={readOnly}
          autoFocus={autoFocus}
          maxLength={maxLength}
          onKeyDown={onKeyDown}
          className={inputClass}
        />
      ) : (
        <input
          id={id}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          type={type}
          readOnly={readOnly}
          autoFocus={autoFocus}
          maxLength={maxLength}
          onKeyDown={onKeyDown}
          className={inputClass}
        />
      )}
      {error ? (
        <p className="mt-1 text-xs text-red-400">{error}</p>
      ) : validate && !validate(value) && value.length > 0 ? (
        <p className="mt-1 text-xs text-red-400">Invalid input</p>
      ) : null}
    </div>
  );
};

export default ValidatedInput;
