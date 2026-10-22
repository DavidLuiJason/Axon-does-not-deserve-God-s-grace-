/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Calculator Screen: Type a sum, get the answer.
 * Features:
 * - On-screen NumericKeypad with basic keys and scientific panel (behind "More")
 * - Angle unit toggle (Deg/Rad) moved to scientific panel, with badge in main line
 * - Session memory (MC, MR, M+, M-) with memory display
 * - Live preview without premature syntax errors during typing
 * - "Read as: ..." line showing engine's interpreted structure
 * - History of last 20 calculations with tap-to-reuse and copy
 * - Caret insertion/deletion and inputMode="none" / phone keyboard toggle
 * - Powered by pure calculator engine (src/tools/engines/numbers/calculator.ts)
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  History,
  Keyboard,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  copyToClipboard,
  ErrorLine,
  SingleLineField,
} from '../tools/ToolParts';
import { NumericKeypad } from '../tools/NumericKeypad';
import { evaluate } from '../../tools/engines/numbers/calculator';

export const toolScreen = { toolId: 'calculator' };

export interface CalculatorScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

export interface CalculationHistoryItem {
  id: string;
  expression: string;
  formatted: string;
  interpreted: string;
  timestamp: number;
}

export const CalculatorScreen: React.FC<CalculatorScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [expression, setExpression] = useState('');
  const [angleUnit, setAngleUnit] = useState<'rad' | 'deg'>('rad');
  const [copied, setCopied] = useState(false);
  const [copiedHistoryId, setCopiedHistoryId] = useState<string | null>(null);

  // Keypad & Keyboard visibility
  const [keypadOpen, setKeypadOpen] = useState(true);
  const [useNativeKeyboard, setUseNativeKeyboard] = useState(false);

  // Caret and input reference
  const inputRef = useRef<HTMLInputElement>(null);
  const [caretPos, setCaretPos] = useState<number | null>(null);

  // Session Memory & Answer state
  const [memory, setMemory] = useState<number>(0);
  const [lastAnswer, setLastAnswer] = useState<number | undefined>(undefined);
  const [equalsPressed, setEqualsPressed] = useState(false);

  // History (last 20)
  const [history, setHistory] = useState<CalculationHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Evaluate live as the user types
  const result = useMemo(() => {
    const trimmed = expression.trim();
    if (!trimmed) return null;
    return evaluate(trimmed, { angle: angleUnit, ans: lastAnswer });
  }, [expression, angleUnit, lastAnswer]);

  // Check if expression is currently incomplete while typing
  const isIncomplete = useMemo(() => {
    const trimmed = expression.trim();
    if (!trimmed) return true;
    if (/[+\-*/^%,(]$/i.test(trimmed)) return true;
    if (
      /(?:times|plus|minus|over|mod|of|divided|by|sqrt|sin|cos|tan|asin|acos|atan|ln|log|ncr|npr)$/i.test(
        trimmed
      )
    ) {
      return true;
    }
    let open = 0;
    for (const ch of trimmed) {
      if (ch === '(') open++;
      else if (ch === ')') open--;
    }
    return open > 0;
  }, [expression]);

  // Caret insertion helper
  const handleInsert = (textToInsert: string) => {
    setEqualsPressed(false);
    const input = inputRef.current;
    const currentVal = expression;
    let start = currentVal.length;
    let end = currentVal.length;

    if (input) {
      start = input.selectionStart ?? caretPos ?? currentVal.length;
      end = input.selectionEnd ?? caretPos ?? currentVal.length;
    } else if (caretPos !== null) {
      start = caretPos;
      end = caretPos;
    }

    const nextVal = currentVal.slice(0, start) + textToInsert + currentVal.slice(end);
    setExpression(nextVal);
    const newPos = start + textToInsert.length;
    setCaretPos(newPos);

    requestAnimationFrame(() => {
      if (input) {
        input.focus();
        input.setSelectionRange(newPos, newPos);
      }
    });
  };

  // Caret deletion helper
  const handleDelete = () => {
    setEqualsPressed(false);
    const input = inputRef.current;
    const currentVal = expression;
    let start = currentVal.length;
    let end = currentVal.length;

    if (input) {
      start = input.selectionStart ?? caretPos ?? currentVal.length;
      end = input.selectionEnd ?? caretPos ?? currentVal.length;
    } else if (caretPos !== null) {
      start = caretPos;
      end = caretPos;
    }

    if (start !== end) {
      const nextVal = currentVal.slice(0, start) + currentVal.slice(end);
      setExpression(nextVal);
      setCaretPos(start);
      requestAnimationFrame(() => {
        if (input) {
          input.focus();
          input.setSelectionRange(start, start);
        }
      });
    } else if (start > 0) {
      const nextVal = currentVal.slice(0, start - 1) + currentVal.slice(start);
      setExpression(nextVal);
      const newPos = start - 1;
      setCaretPos(newPos);
      requestAnimationFrame(() => {
        if (input) {
          input.focus();
          input.setSelectionRange(newPos, newPos);
        }
      });
    }
  };

  const handleClear = () => {
    setExpression('');
    setCaretPos(0);
    setEqualsPressed(false);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  // Smart Parenthesis Handler
  const handleSmartParen = () => {
    const currentVal = expression;
    const input = inputRef.current;
    const pos = input?.selectionStart ?? caretPos ?? currentVal.length;
    const before = currentVal.slice(0, pos);
    let openCount = 0;
    for (const ch of before) {
      if (ch === '(') openCount++;
      else if (ch === ')') openCount--;
    }
    const lastChar = before.trim().slice(-1);
    if (openCount > 0 && lastChar && !/[+\-*/^(,]/.test(lastChar)) {
      handleInsert(')');
    } else {
      handleInsert('(');
    }
  };

  const handleAns = () => {
    handleInsert('ans');
  };

  const handleEquals = () => {
    setEqualsPressed(true);
    const trimmed = expression.trim();
    if (!trimmed) return;
    const res = evaluate(trimmed, { angle: angleUnit, ans: lastAnswer });
    if (res.ok) {
      setLastAnswer(res.value);
      const newHistoryItem: CalculationHistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        expression: trimmed,
        formatted: res.formatted,
        interpreted: res.interpreted,
        timestamp: Date.now(),
      };
      setHistory((prev) => [newHistoryItem, ...prev.slice(0, 19)]);
    }
  };

  // Memory keys
  const handleMemoryClear = () => setMemory(0);
  const handleMemoryRecall = () => handleInsert(memory.toString());
  const handleMemoryAdd = () => {
    if (result && result.ok) {
      setMemory((m) => m + result.value);
    }
  };
  const handleMemorySubtract = () => {
    if (result && result.ok) {
      setMemory((m) => m - result.value);
    }
  };

  const handleCopy = async (text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyHistory = async (id: string, text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedHistoryId(id);
      setTimeout(() => setCopiedHistoryId(null), 2000);
    }
  };

  return (
    <ToolScreenShell
      toolName="Calculator"
      tagline="Type a sum, get the answer"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-3.5">
        {/* Main Line with Angle Badge, Keyboard Toggle, and Calculation Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold uppercase tracking-wider text-[#8E9094]">
                Calculation
              </span>
              <span className="font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded bg-white/10 text-[#D0D2D6] tracking-wider uppercase">
                {angleUnit}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Keyboard switch button */}
              <button
                type="button"
                onClick={() => setUseNativeKeyboard(!useNativeKeyboard)}
                title={
                  useNativeKeyboard
                    ? 'Switch to on-screen keypad'
                    : 'Switch to phone keyboard'
                }
                aria-label={
                  useNativeKeyboard
                    ? 'Switch to on-screen keypad'
                    : 'Switch to phone keyboard'
                }
                className={`min-h-[36px] px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  useNativeKeyboard
                    ? 'bg-white/15 text-white'
                    : 'bg-white/5 text-[#8E9094] hover:text-white hover:bg-white/10'
                }`}
              >
                <Keyboard size={15} />
                <span>{useNativeKeyboard ? 'Phone' : 'Keypad'}</span>
              </button>

              {/* History Toggle Button */}
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  aria-label="Toggle calculation history"
                  className={`min-h-[36px] px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                    showHistory
                      ? 'bg-white/15 text-white'
                      : 'bg-white/5 text-[#8E9094] hover:text-white hover:bg-white/10'
                  }`}
                >
                  <History size={14} />
                  <span>{history.length}</span>
                </button>
              )}
            </div>
          </div>

          <SingleLineField
            id="calculator-expression"
            inputRef={inputRef}
            value={expression}
            onChange={(val) => {
              setExpression(val);
              setEqualsPressed(false);
            }}
            placeholder="e.g. 50% of 100 times 10"
            maxLength={512}
            onClear={handleClear}
            inputMode={keypadOpen && !useNativeKeyboard ? 'none' : 'text'}
            onSelect={(e) => {
              const el = e.currentTarget;
              setCaretPos(el.selectionStart);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleEquals();
              }
            }}
          />
        </div>

        {/* Live Answer or Error display */}
        {result && result.ok && (
          <div className="p-3.5 bg-[#18191C] border border-white/10 rounded-2xl space-y-1.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8E9094]">
                Answer
              </span>
              <button
                type="button"
                onClick={() => handleCopy(result.formatted)}
                aria-label="Copy answer"
                className="text-[#8E9094] hover:text-white transition-colors cursor-pointer p-1 rounded hover:bg-white/5 flex items-center gap-1 text-xs"
              >
                {copied ? (
                  <>
                    <Check size={14} className="text-emerald-500" />
                    <span className="text-emerald-500 font-medium">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="font-mono text-3xl font-medium text-white tracking-tight break-all select-text">
              {result.formatted}
            </div>

            {/* Read As: line using interpreted representation */}
            {result.interpreted && (
              <div className="pt-1.5 border-t border-white/5 text-xs font-mono text-[#8E9094] truncate">
                <span className="text-[#6E7075] not-italic">Read as: </span>
                <span className="text-[#D0D2D6] font-medium">{result.interpreted}</span>
              </div>
            )}
          </div>
        )}

        {/* Show real error only when not incomplete or when user pressed equals */}
        {result && !result.ok && (!isIncomplete || equalsPressed) && (
          <div className="space-y-1 animate-in fade-in duration-150">
            <ErrorLine
              message={result.hint || 'Check operators, numbers, and parentheses.'}
            />
            {result.interpreted && result.interpreted !== expression && (
              <div className="text-[11px] font-mono text-[#8E9094] pl-1">
                <span className="text-[#6E7075]">Read as: </span>
                <span className="text-[#D0D2D6]">{result.interpreted}</span>
              </div>
            )}
          </div>
        )}

        {/* Empty state when no calculation typed */}
        {!result && (
          <div className="p-3.5 bg-[#18191C]/50 border border-white/5 rounded-2xl text-xs text-[#8E9094] italic">
            Enter a calculation with numbers, operators (+, −, ×, ÷, %), or words like 'of'.
          </div>
        )}

        {/* On-screen Keypad component */}
        <NumericKeypad
          onInsert={handleInsert}
          onDelete={handleDelete}
          onClear={handleClear}
          onAns={handleAns}
          onEquals={handleEquals}
          onSmartParen={handleSmartParen}
          isOpen={keypadOpen}
          onToggleOpen={() => setKeypadOpen(!keypadOpen)}
          angleUnit={angleUnit}
          onToggleAngle={() =>
            setAngleUnit((a) => (a === 'rad' ? 'deg' : 'rad'))
          }
          memory={memory}
          onMemoryClear={handleMemoryClear}
          onMemoryRecall={handleMemoryRecall}
          onMemoryAdd={handleMemoryAdd}
          onMemorySubtract={handleMemorySubtract}
        />

        {/* History drawer (when opened) */}
        {showHistory && history.length > 0 && (
          <div className="p-3 bg-[#18191C] border border-white/10 rounded-2xl space-y-2.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-1 border-b border-white/5">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
                Calculation History (Last {history.length})
              </span>
              <button
                type="button"
                onClick={() => setHistory([])}
                aria-label="Clear calculation history"
                className="text-xs text-[#E85A3C] hover:text-[#ff6e50] flex items-center gap-1 cursor-pointer transition-colors p-1"
              >
                <Trash2 size={13} />
                <span>Clear</span>
              </button>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 divide-y divide-white/5">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="pt-1.5 first:pt-0 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => {
                        setExpression(item.expression);
                        setEqualsPressed(false);
                      }}
                      title="Tap to load expression"
                      className="text-left font-mono text-[#A0A2A7] hover:text-white truncate block cursor-pointer transition-colors max-w-full"
                    >
                      {item.expression}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsert(item.formatted)}
                      title="Tap to insert answer into current expression"
                      className="text-left font-mono font-semibold text-white hover:text-[#E85A3C] truncate block cursor-pointer transition-colors"
                    >
                      = {item.formatted}
                    </button>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopyHistory(item.id, item.formatted)}
                      aria-label="Copy history answer"
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#8E9094] hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedHistoryId === item.id ? (
                        <Check size={13} className="text-emerald-500" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ToolScreenShell>
  );
};

export default CalculatorScreen;
