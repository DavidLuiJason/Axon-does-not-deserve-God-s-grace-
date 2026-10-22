/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ToolParts: Small shared UI parts for all AXON tool screens.
 * Includes text areas, single-line fields, segmented choices, switches,
 * number fields, primary buttons, result boxes with safe clipboard copy,
 * error lines, and progressive disclosure options rows.
 */

import React, { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy, X } from 'lucide-react';

/**
 * Android WebView and browser-safe clipboard copy with fallback.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof text !== 'string') return false;
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    el.style.top = '0';
    el.setAttribute('readonly', '');
    document.body.appendChild(el);
    el.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(el);
    return successful;
  } catch {
    return false;
  }
}

/**
 * 1. Labelled multi-line text field.
 * Features: label, clear button, character count, honours maxLength.
 */
export interface LabelledTextAreaProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  onClear?: () => void;
  className?: string;
}

export const LabelledTextArea: React.FC<LabelledTextAreaProps> = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
  maxLength,
  onClear,
  className = '',
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let next = e.target.value;
    if (maxLength !== undefined && next.length > maxLength) {
      next = next.slice(0, maxLength);
    }
    onChange(next);
  };

  const handleClear = () => {
    if (onClear) onClear();
    else onChange('');
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <label
          htmlFor={id}
          className="font-semibold uppercase tracking-wider text-[#8E9094]"
        >
          {label}
        </label>
        <div className="flex items-center gap-2">
          {maxLength !== undefined && (
            <span
              className={`font-mono text-[11px] ${
                value.length >= maxLength ? 'text-[#E85A3C]' : 'text-[#8E9094]'
              }`}
            >
              {value.length.toLocaleString()} / {maxLength.toLocaleString()}
            </span>
          )}
          {maxLength === undefined && value.length > 0 && (
            <span className="font-mono text-[11px] text-[#8E9094]">
              {value.length.toLocaleString()} chars
            </span>
          )}
          {value.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              aria-label={`Clear ${label}`}
              className="text-[#8E9094] hover:text-white transition-colors cursor-pointer p-0.5"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      <textarea
        id={id}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className="w-full bg-[#1C1D21] border border-white/10 rounded-xl px-3.5 py-3 text-sm text-white placeholder-[#686A70] focus:outline-none focus:border-[#E85A3C] transition-colors resize-y font-sans leading-relaxed"
      />
    </div>
  );
};

/**
 * 2. Single-line field.
 * Features: optional label, hint, clear button, max length.
 */
export interface SingleLineFieldProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  onClear?: () => void;
  className?: string;
  type?: string;
  numeric?: 'decimal' | 'integer';
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  pattern?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSelect?: (e: React.SyntheticEvent<HTMLInputElement>) => void;
  rightAction?: React.ReactNode;
}

export const SingleLineField: React.FC<SingleLineFieldProps> = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  maxLength,
  onClear,
  className = '',
  type = 'text',
  numeric,
  inputMode,
  pattern,
  inputRef,
  onKeyDown,
  onSelect,
  rightAction,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let next = e.target.value;
    if (maxLength !== undefined && next.length > maxLength) {
      next = next.slice(0, maxLength);
    }
    onChange(next);
  };

  const handleClear = () => {
    if (onClear) onClear();
    else onChange('');
  };

  const computedInputMode =
    inputMode ??
    (numeric === 'decimal' ? 'decimal' : numeric === 'integer' ? 'numeric' : undefined);

  const computedPattern =
    pattern ??
    (numeric === 'integer'
      ? '[0-9]*'
      : numeric === 'decimal'
      ? '[0-9]*[.,]?[0-9]*'
      : undefined);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between text-xs">
          <label
            htmlFor={id}
            className="font-semibold uppercase tracking-wider text-[#8E9094]"
          >
            {label}
          </label>
          <div className="flex items-center gap-1.5">
            {rightAction}
            {value.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                aria-label={`Clear ${label}`}
                className="text-[#8E9094] hover:text-white transition-colors cursor-pointer p-0.5"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={id}
          type={type}
          inputMode={computedInputMode}
          pattern={computedPattern}
          value={value}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          onSelect={onSelect}
          placeholder={placeholder}
          maxLength={maxLength}
          className="w-full min-h-[44px] bg-[#1C1D21] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#686A70] focus:outline-none focus:border-[#E85A3C] transition-colors font-sans"
        />
        {!label && (
          <div className="absolute right-2 flex items-center gap-1">
            {rightAction}
            {value.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear field"
                className="text-[#8E9094] hover:text-white transition-colors cursor-pointer p-1"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}
      </div>
      {hint && (
        <p className="text-[12px] text-[#8E9094] leading-normal pl-0.5">{hint}</p>
      )}
    </div>
  );
};

/**
 * 3. Segmented choice row.
 * Displays choices cleanly with wrapping or horizontal flex.
 */
export interface ChoiceOption<T extends string = string> {
  id: T;
  label: string;
}

export interface SegmentedChoiceProps<T extends string = string> {
  label?: string;
  choices: readonly (ChoiceOption<T> | T)[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedChoice<T extends string = string>({
  label,
  choices,
  value,
  onChange,
  className = '',
}: SegmentedChoiceProps<T>) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <span className="block text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
          {label}
        </span>
      )}
      <div className="flex flex-wrap gap-1.5 p-1 bg-[#18191C] rounded-xl border border-white/5">
        {choices.map((choice) => {
          const id = typeof choice === 'string' ? choice : choice.id;
          const labelText = typeof choice === 'string' ? choice : choice.label;
          const isSelected = value === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center ${
                isSelected
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-[#9A9B9F] hover:text-white hover:bg-white/5'
              }`}
            >
              {labelText}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 4. Switch row.
 * Simple toggling row with sentence case label and optional description.
 */
export interface SwitchRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export const SwitchRow: React.FC<SwitchRowProps> = ({
  label,
  description,
  checked,
  onChange,
  className = '',
}) => {
  return (
    <label
      className={`min-h-[44px] flex items-center justify-between gap-4 py-2 px-1 cursor-pointer select-none group ${className}`}
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium text-white group-hover:text-white transition-colors">
          {label}
        </span>
        {description && (
          <span className="text-xs text-[#8E9094] leading-normal">
            {description}
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(e) => {
          e.preventDefault();
          onChange(!checked);
        }}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out cursor-pointer ${
          checked ? 'bg-[#E85A3C]' : 'bg-[#2A2B30]'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  );
};

/**
 * 5. Number field that accepts only valid numbers.
 */
export interface NumberFieldProps {
  id?: string;
  label?: string;
  value: number | string;
  onChange: (value: any) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  numeric?: 'decimal' | 'integer';
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  pattern?: string;
  allowNegativeToggle?: boolean;
}

export const NumberField: React.FC<NumberFieldProps> = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  min,
  max,
  step,
  className = '',
  numeric = 'decimal',
  inputMode,
  pattern,
  allowNegativeToggle = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (numeric === 'integer') {
      if (raw === '' || raw === '-' || /^-?\d*$/.test(raw)) {
        onChange(raw);
      }
    } else {
      // Allow empty string or negative sign or valid numeric pattern
      if (raw === '' || raw === '-' || /^-?\d*\.?\d*$/.test(raw)) {
        onChange(raw);
      }
    }
  };

  const toggleNegative = () => {
    const str = String(value ?? '');
    if (str.startsWith('-')) {
      onChange(str.slice(1));
    } else if (str === '') {
      onChange('-');
    } else {
      onChange('-' + str);
    }
  };

  const computedInputMode =
    inputMode ??
    (numeric === 'integer' ? 'numeric' : 'decimal');

  const computedPattern =
    pattern ??
    (numeric === 'integer' ? '[0-9]*' : '[0-9]*[.,]?[0-9]*');

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between text-xs">
          <label
            htmlFor={id}
            className="block font-semibold uppercase tracking-wider text-[#8E9094]"
          >
            {label}
          </label>
          {allowNegativeToggle && (
            <button
              type="button"
              onClick={toggleNegative}
              aria-label="Toggle positive / negative sign"
              className="text-[#8E9094] hover:text-white px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[11px] font-mono cursor-pointer transition-colors"
            >
              ±
            </button>
          )}
        </div>
      )}
      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          inputMode={computedInputMode}
          pattern={computedPattern}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          className="w-full min-h-[44px] bg-[#1C1D21] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#686A70] focus:outline-none focus:border-[#E85A3C] transition-colors font-mono"
        />
        {!label && allowNegativeToggle && (
          <button
            type="button"
            onClick={toggleNegative}
            aria-label="Toggle positive / negative sign"
            className="absolute right-3 text-[#8E9094] hover:text-white px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[11px] font-mono cursor-pointer transition-colors"
          >
            ±
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * 6. Primary button.
 * Short verbs on buttons, minimum 44px tap target.
 */
export interface PrimaryButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
  icon?: React.ReactNode;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  onClick,
  disabled = false,
  children,
  variant = 'primary',
  className = '',
  icon,
}) => {
  let styleClasses = 'bg-white text-black hover:bg-[#F0F0F0]';
  if (variant === 'secondary') {
    styleClasses = 'bg-white/10 text-white hover:bg-white/15';
  } else if (variant === 'danger') {
    styleClasses = 'bg-[#E85A3C]/20 text-[#E85A3C] hover:bg-[#E85A3C]/30';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[44px] px-5 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${styleClasses} ${className}`}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
};

/**
 * 7. Result box with a Copy button.
 * Includes quiet "Copied" confirmation and Android WebView fallback.
 */
export interface ResultBoxProps {
  title?: string;
  text: string;
  copyText?: string;
  onClear?: () => void;
  className?: string;
  emptyNotice?: string;
}

export const ResultBox: React.FC<ResultBoxProps> = ({
  title = 'Result',
  text,
  copyText,
  onClear,
  className = '',
  emptyNotice,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const toCopy = copyText !== undefined ? copyText : text;
    if (!toCopy) return;
    const ok = await copyToClipboard(toCopy);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const hasContent = text.trim() !== '';

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wider text-[#8E9094]">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {hasContent && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-[#9A9B9F] hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              title="Copy to clipboard"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
          {hasContent && onClear && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear result"
              className="text-[#8E9094] hover:text-white transition-colors cursor-pointer p-1"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="min-h-[56px] w-full bg-[#18191C] border border-white/10 rounded-xl p-3.5 text-sm text-white font-sans break-words whitespace-pre-wrap leading-relaxed select-text">
        {hasContent ? (
          text
        ) : (
          <span className="text-[#686A70] italic">
            {emptyNotice ?? 'Result will appear here...'}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * 8. Error line.
 * Plain, honest error statement with subtle styling.
 */
export interface ErrorLineProps {
  message?: string | null;
  className?: string;
}

export const ErrorLine: React.FC<ErrorLineProps> = ({ message, className = '' }) => {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={`p-3 rounded-xl bg-[#231A19] border border-[#E85A3C]/30 text-xs text-[#E0B4A8] leading-relaxed flex items-start gap-2 ${className}`}
    >
      <span className="font-semibold shrink-0 text-[#E85A3C]">!</span>
      <span>{message}</span>
    </div>
  );
};

/**
 * 9. ONE "Options" disclosure row that hides its children until tapped.
 * Progressive disclosure following AXON design philosophy.
 */
export interface OptionsDisclosureProps {
  title?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const OptionsDisclosure: React.FC<OptionsDisclosureProps> = ({
  title = 'Options',
  defaultOpen = false,
  children,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`border border-white/5 bg-[#161719] rounded-xl overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-h-[44px] px-4 py-2.5 flex items-center justify-between text-left hover:bg-white/5 transition-colors cursor-pointer"
        aria-expanded={isOpen}
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-[#9A9B9F]">
          {title}
        </span>
        <div className="text-[#9A9B9F]">
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pt-1 pb-4 border-t border-white/5 space-y-3.5">
          {children}
        </div>
      )}
    </div>
  );
};
