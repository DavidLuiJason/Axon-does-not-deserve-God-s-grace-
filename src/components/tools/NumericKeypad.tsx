/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NumericKeypad: Reusable on-screen calculator keypad with basic and scientific panels.
 * Provides touch-friendly keys (>= 48dp, >= 16px text), pressed states,
 * collapsible drawer with an arrow button, and caret-safe non-blurring interactions.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Delete } from 'lucide-react';

export interface NumericKeypadProps {
  onInsert: (text: string) => void;
  onDelete: () => void;
  onClear: () => void;
  onAns: () => void;
  onEquals: () => void;
  onSmartParen?: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  // Scientific & memory features
  angleUnit?: 'deg' | 'rad';
  onToggleAngle?: () => void;
  memory?: number;
  onMemoryClear?: () => void;
  onMemoryRecall?: () => void;
  onMemoryAdd?: () => void;
  onMemorySubtract?: () => void;
  className?: string;
}

export const NumericKeypad: React.FC<NumericKeypadProps> = ({
  onInsert,
  onDelete,
  onClear,
  onAns,
  onEquals,
  onSmartParen,
  isOpen,
  onToggleOpen,
  angleUnit = 'rad',
  onToggleAngle,
  memory = 0,
  onMemoryClear,
  onMemoryRecall,
  onMemoryAdd,
  onMemorySubtract,
  className = '',
}) => {
  const [showScientific, setShowScientific] = useState(false);

  // Avoid stealing focus from input so the caret remains visible
  const preventBlur = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
  };

  const handleKeyClick = (action: () => void) => {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      action();
    };
  };

  const defaultSmartParen = () => {
    if (onSmartParen) {
      onSmartParen();
    } else {
      onInsert('(');
    }
  };

  return (
    <div
      className={`bg-[#18191C] border border-white/10 rounded-2xl overflow-hidden transition-all duration-200 select-none ${className}`}
    >
      {/* Header bar: Open/Close toggle, Scientific toggle, Angle badge, and Memory badge */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-[#141517]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onMouseDown={preventBlur}
            onClick={onToggleOpen}
            aria-label={isOpen ? 'Close keypad' : 'Open keypad'}
            className="min-h-[44px] min-w-[44px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#D0D2D6] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            {isOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            <span className="text-[13px]">{isOpen ? 'Keypad' : 'Open Keypad'}</span>
          </button>

          {isOpen && (
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={() => setShowScientific(!showScientific)}
              aria-label={showScientific ? 'Hide scientific panel' : 'Show scientific panel'}
              className={`min-h-[40px] px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                showScientific
                  ? 'bg-[#E85A3C] text-white shadow-sm'
                  : 'bg-white/10 text-[#D0D2D6] hover:bg-white/15'
              }`}
            >
              More
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isOpen && memory !== 0 && (
            <span className="font-mono text-[12px] px-2 py-0.5 rounded bg-white/5 text-[#E85A3C] border border-[#E85A3C]/20">
              M: {memory}
            </span>
          )}
          {isOpen && onToggleAngle && (
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={onToggleAngle}
              aria-label={`Angle unit: ${angleUnit.toUpperCase()}. Tap to toggle.`}
              className="min-h-[36px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[12px] font-mono font-medium text-[#A0A2A7] hover:text-white transition-colors cursor-pointer"
            >
              {angleUnit.toUpperCase()}
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="p-2 space-y-2">
          {/* Scientific Panel (revealed behind 'More') */}
          {showScientific && (
            <div className="p-2 bg-[#121315] border border-white/5 rounded-xl space-y-1.5 animate-in fade-in duration-150">
              {/* Memory Row */}
              <div className="flex items-center justify-between gap-1 pb-1 border-b border-white/5">
                <div className="text-[12px] font-mono text-[#8E9094] px-1 truncate">
                  Mem: {memory}
                </div>
                <div className="grid grid-cols-4 gap-1.5 flex-1 max-w-[260px]">
                  <button
                    type="button"
                    onMouseDown={preventBlur}
                    onClick={handleKeyClick(() => onMemoryClear?.())}
                    className="min-h-[48px] h-12 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.96] active:bg-white/20 text-[#A0A2A7] hover:text-white font-mono text-[16px] font-medium transition-all cursor-pointer flex items-center justify-center"
                  >
                    MC
                  </button>
                  <button
                    type="button"
                    onMouseDown={preventBlur}
                    onClick={handleKeyClick(() => onMemoryRecall?.())}
                    className="min-h-[48px] h-12 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.96] active:bg-white/20 text-[#A0A2A7] hover:text-white font-mono text-[16px] font-medium transition-all cursor-pointer flex items-center justify-center"
                  >
                    MR
                  </button>
                  <button
                    type="button"
                    onMouseDown={preventBlur}
                    onClick={handleKeyClick(() => onMemoryAdd?.())}
                    className="min-h-[48px] h-12 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.96] active:bg-white/20 text-[#A0A2A7] hover:text-white font-mono text-[16px] font-medium transition-all cursor-pointer flex items-center justify-center"
                  >
                    M+
                  </button>
                  <button
                    type="button"
                    onMouseDown={preventBlur}
                    onClick={handleKeyClick(() => onMemorySubtract?.())}
                    className="min-h-[48px] h-12 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.96] active:bg-white/20 text-[#A0A2A7] hover:text-white font-mono text-[16px] font-medium transition-all cursor-pointer flex items-center justify-center"
                  >
                    M−
                  </button>
                </div>
              </div>

              {/* Scientific Functions (4 columns, >= 48dp height, >= 16px text) */}
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={handleKeyClick(() => onInsert('sin('))}
                  className="min-h-[48px] h-12 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.96] text-white font-mono text-[16px] transition-all cursor-pointer flex items-center justify-center"
                >
                  sin
                </button>
                <button
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={handleKeyClick(() => onInsert('cos('))}
                  className="min-h-[48px] h-12 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.96] text-white font-mono text-[16px] transition-all cursor-pointer flex items-center justify-center"
                >
                  cos
                </button>
                <button
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={handleKeyClick(() => onInsert('tan('))}
                  className="min-h-[48px] h-12 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.96] text-white font-mono text-[16px] transition-all cursor-pointer flex items-center justify-center"
                >
                  tan
                </button>
                {onToggleAngle ? (
                  <button
                    type="button"
                    onMouseDown={preventBlur}
                    onClick={handleKeyClick(onToggleAngle)}
                    className="min-h-[48px] h-12 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.96] text-[#E85A3C] font-mono text-[16px] font-semibold transition-all cursor-pointer flex items-center justify-center"
                  >
                    {angleUnit.toUpperCase()}
                  </button>
                ) : (
                  <div className="min-h-[48px] h-12" />
                )}

                <button
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={handleKeyClick(() => onInsert('asin('))}
                  className="min-h-[48px] h-12 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.96] text-white font-mono text-[16px] transition-all cursor-pointer flex items-center justify-center"
                >
                  asin
                </button>
                <button
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={handleKeyClick(() => onInsert('acos('))}
                  className="min-h-[48px] h-12 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.96] text-white font-mono text-[16px] transition-all cursor-pointer flex items-center justify-center"
                >
                  acos
                </button>
                <button
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={handleKeyClick(() => onInsert('atan('))}
                  className="min-h-[48px] h-12 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.96] text-white font-mono text-[16px] transition-all cursor-pointer flex items-center justify-center"
                >
                  atan
                </button>
                <button
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={handleKeyClick(() => onInsert('pi'))}
                  className="min-h-[48px] h-12 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.96] text-white font-serif text-[18px] transition-all cursor-pointer flex items-center justify-center"
                >
                  π
                </button>

                <button
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={handleKeyClick(() => onInsert('ln('))}
                  className="min-h-[48px] h-12 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.96] text-white font-mono text-[16px] transition-all cursor-pointer flex items-center justify-center"
                >
                  ln
                </button>
                <button
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={handleKeyClick(() => onInsert('log('))}
                  className="min-h-[48px] h-12 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.96] text-white font-mono text-[16px] transition-all cursor-pointer flex items-center justify-center"
                >
                  log
                </button>
                <button
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={handleKeyClick(() => onInsert('sqrt('))}
                  className="min-h-[48px] h-12 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.96] text-white font-mono text-[16px] transition-all cursor-pointer flex items-center justify-center"
                >
                  √
                </button>
                <button
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={handleKeyClick(() => onInsert('^2'))}
                  className="min-h-[48px] h-12 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.96] text-white font-mono text-[16px] transition-all cursor-pointer flex items-center justify-center"
                >
                  x²
                </button>

                <button
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={handleKeyClick(() => onInsert('^'))}
                  className="min-h-[48px] h-12 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.96] text-white font-mono text-[16px] transition-all cursor-pointer flex items-center justify-center"
                >
                  xʸ
                </button>
                <button
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={handleKeyClick(() => onInsert('!'))}
                  className="min-h-[48px] h-12 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.96] text-white font-mono text-[16px] transition-all cursor-pointer flex items-center justify-center"
                >
                  x!
                </button>
                <button
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={handleKeyClick(() => onInsert('1/('))}
                  className="min-h-[48px] h-12 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.96] text-white font-mono text-[16px] transition-all cursor-pointer flex items-center justify-center"
                >
                  1/x
                </button>
                <button
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={handleKeyClick(() => onInsert('e'))}
                  className="min-h-[48px] h-12 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.96] text-white font-serif text-[18px] transition-all cursor-pointer flex items-center justify-center"
                >
                  e
                </button>

                <button
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={handleKeyClick(() => onInsert('ncr('))}
                  className="min-h-[48px] h-12 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.96] text-white font-mono text-[16px] transition-all cursor-pointer flex items-center justify-center"
                >
                  ncr
                </button>
                <button
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={handleKeyClick(() => onInsert('npr('))}
                  className="min-h-[48px] h-12 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.96] text-white font-mono text-[16px] transition-all cursor-pointer flex items-center justify-center"
                >
                  npr
                </button>
                <button
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={handleKeyClick(() => onInsert(','))}
                  className="min-h-[48px] h-12 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.96] text-white font-mono text-[18px] font-semibold transition-all cursor-pointer flex items-center justify-center"
                >
                  ,
                </button>
                <button
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={handleKeyClick(defaultSmartParen)}
                  className="min-h-[48px] h-12 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.96] text-white font-mono text-[16px] transition-all cursor-pointer flex items-center justify-center"
                >
                  ( )
                </button>
              </div>
            </div>
          )}

          {/* Basic Keypad Grid (4 columns, >= 48dp height, >= 16px text) */}
          <div className="grid grid-cols-4 gap-1.5">
            {/* Row 1 */}
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={handleKeyClick(onClear)}
              aria-label="Clear all"
              className="min-h-[48px] h-12 rounded-xl bg-[#2A2B30] hover:bg-[#32343A] active:scale-[0.96] active:bg-white/20 text-[#E85A3C] font-mono text-[18px] font-semibold transition-all cursor-pointer flex items-center justify-center"
            >
              C
            </button>
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={handleKeyClick(defaultSmartParen)}
              aria-label="Parentheses"
              className="min-h-[48px] h-12 rounded-xl bg-[#202126] hover:bg-[#28292E] active:scale-[0.96] active:bg-white/20 text-[#D0D2D6] font-mono text-[18px] font-medium transition-all cursor-pointer flex items-center justify-center"
            >
              ( )
            </button>
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={handleKeyClick(onDelete)}
              aria-label="Delete before caret"
              className="min-h-[48px] h-12 rounded-xl bg-[#202126] hover:bg-[#28292E] active:scale-[0.96] active:bg-white/20 text-[#D0D2D6] font-mono text-[18px] transition-all cursor-pointer flex items-center justify-center"
            >
              <Delete size={20} />
            </button>
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={handleKeyClick(() => onInsert(' / '))}
              aria-label="Divide"
              className="min-h-[48px] h-12 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.96] active:bg-white/25 text-[#E85A3C] font-mono text-[20px] font-medium transition-all cursor-pointer flex items-center justify-center"
            >
              ÷
            </button>

            {/* Row 2 */}
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={handleKeyClick(() => onInsert('7'))}
              className="min-h-[48px] h-12 rounded-xl bg-[#24252A] hover:bg-[#2C2E34] active:scale-[0.96] active:bg-white/20 text-white font-mono text-[20px] font-medium transition-all cursor-pointer flex items-center justify-center"
            >
              7
            </button>
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={handleKeyClick(() => onInsert('8'))}
              className="min-h-[48px] h-12 rounded-xl bg-[#24252A] hover:bg-[#2C2E34] active:scale-[0.96] active:bg-white/20 text-white font-mono text-[20px] font-medium transition-all cursor-pointer flex items-center justify-center"
            >
              8
            </button>
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={handleKeyClick(() => onInsert('9'))}
              className="min-h-[48px] h-12 rounded-xl bg-[#24252A] hover:bg-[#2C2E34] active:scale-[0.96] active:bg-white/20 text-white font-mono text-[20px] font-medium transition-all cursor-pointer flex items-center justify-center"
            >
              9
            </button>
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={handleKeyClick(() => onInsert(' * '))}
              aria-label="Multiply"
              className="min-h-[48px] h-12 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.96] active:bg-white/25 text-[#E85A3C] font-mono text-[20px] font-medium transition-all cursor-pointer flex items-center justify-center"
            >
              ×
            </button>

            {/* Row 3 */}
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={handleKeyClick(() => onInsert('4'))}
              className="min-h-[48px] h-12 rounded-xl bg-[#24252A] hover:bg-[#2C2E34] active:scale-[0.96] active:bg-white/20 text-white font-mono text-[20px] font-medium transition-all cursor-pointer flex items-center justify-center"
            >
              4
            </button>
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={handleKeyClick(() => onInsert('5'))}
              className="min-h-[48px] h-12 rounded-xl bg-[#24252A] hover:bg-[#2C2E34] active:scale-[0.96] active:bg-white/20 text-white font-mono text-[20px] font-medium transition-all cursor-pointer flex items-center justify-center"
            >
              5
            </button>
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={handleKeyClick(() => onInsert('6'))}
              className="min-h-[48px] h-12 rounded-xl bg-[#24252A] hover:bg-[#2C2E34] active:scale-[0.96] active:bg-white/20 text-white font-mono text-[20px] font-medium transition-all cursor-pointer flex items-center justify-center"
            >
              6
            </button>
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={handleKeyClick(() => onInsert(' - '))}
              aria-label="Minus"
              className="min-h-[48px] h-12 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.96] active:bg-white/25 text-[#E85A3C] font-mono text-[20px] font-medium transition-all cursor-pointer flex items-center justify-center"
            >
              −
            </button>

            {/* Row 4 */}
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={handleKeyClick(() => onInsert('1'))}
              className="min-h-[48px] h-12 rounded-xl bg-[#24252A] hover:bg-[#2C2E34] active:scale-[0.96] active:bg-white/20 text-white font-mono text-[20px] font-medium transition-all cursor-pointer flex items-center justify-center"
            >
              1
            </button>
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={handleKeyClick(() => onInsert('2'))}
              className="min-h-[48px] h-12 rounded-xl bg-[#24252A] hover:bg-[#2C2E34] active:scale-[0.96] active:bg-white/20 text-white font-mono text-[20px] font-medium transition-all cursor-pointer flex items-center justify-center"
            >
              2
            </button>
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={handleKeyClick(() => onInsert('3'))}
              className="min-h-[48px] h-12 rounded-xl bg-[#24252A] hover:bg-[#2C2E34] active:scale-[0.96] active:bg-white/20 text-white font-mono text-[20px] font-medium transition-all cursor-pointer flex items-center justify-center"
            >
              3
            </button>
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={handleKeyClick(() => onInsert(' + '))}
              aria-label="Plus"
              className="min-h-[48px] h-12 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.96] active:bg-white/25 text-[#E85A3C] font-mono text-[20px] font-medium transition-all cursor-pointer flex items-center justify-center"
            >
              +
            </button>

            {/* Row 5 */}
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={handleKeyClick(() => onInsert('%'))}
              aria-label="Percent"
              className="min-h-[48px] h-12 rounded-xl bg-[#202126] hover:bg-[#28292E] active:scale-[0.96] active:bg-white/20 text-[#D0D2D6] font-mono text-[18px] font-medium transition-all cursor-pointer flex items-center justify-center"
            >
              %
            </button>
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={handleKeyClick(() => onInsert('0'))}
              className="min-h-[48px] h-12 rounded-xl bg-[#24252A] hover:bg-[#2C2E34] active:scale-[0.96] active:bg-white/20 text-white font-mono text-[20px] font-medium transition-all cursor-pointer flex items-center justify-center"
            >
              0
            </button>
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={handleKeyClick(() => onInsert('.'))}
              className="min-h-[48px] h-12 rounded-xl bg-[#202126] hover:bg-[#28292E] active:scale-[0.96] active:bg-white/20 text-white font-mono text-[20px] font-bold transition-all cursor-pointer flex items-center justify-center"
            >
              .
            </button>
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={handleKeyClick(onAns)}
              aria-label="Previous answer"
              className="min-h-[48px] h-12 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.96] active:bg-white/25 text-[#D0D2D6] font-mono text-[16px] font-medium transition-all cursor-pointer flex items-center justify-center"
            >
              Ans
            </button>

            {/* Row 6: Equals Key spanning all 4 columns for clean reach */}
            <button
              type="button"
              onMouseDown={preventBlur}
              onClick={handleKeyClick(onEquals)}
              aria-label="Calculate equals"
              className="col-span-4 min-h-[48px] h-12 rounded-xl bg-white text-black hover:bg-[#F0F0F0] active:scale-[0.98] font-mono text-[22px] font-semibold transition-all shadow-sm cursor-pointer flex items-center justify-center"
            >
              =
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NumericKeypad;
