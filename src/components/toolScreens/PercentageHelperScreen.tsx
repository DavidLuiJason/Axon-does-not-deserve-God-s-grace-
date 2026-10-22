/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Percentage Helper Screen: Percentages without the head-scratching.
 * Uses the pure percentage engine in src/tools/engines/numbers/percentage.ts.
 */

import React, { useMemo, useState } from 'react';
import { Check, Copy, RotateCcw } from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  copyToClipboard,
  ErrorLine,
  NumberField,
  SegmentedChoice,
} from '../tools/ToolParts';
import {
  percentage,
  type PercentageMode,
} from '../../tools/engines/numbers/percentage';

export const toolScreen = { toolId: 'percentage-helper' };

export interface PercentageHelperScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

const QUESTION_CHOICES: { id: PercentageMode; label: string }[] = [
  { id: 'percent-of', label: 'X% of Y' },
  { id: 'what-percent', label: 'X is what % of Y' },
  { id: 'change', label: 'Change from X to Y' },
  { id: 'adjust', label: 'Add or take off X%' },
  { id: 'percent-of-what', label: 'X is Y% of what' },
];

export const PercentageHelperScreen: React.FC<PercentageHelperScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [mode, setMode] = useState<PercentageMode>('percent-of');

  // Input fields
  const [val1, setVal1] = useState('15');
  const [val2, setVal2] = useState('80');
  const [copied, setCopied] = useState(false);

  // Compute live percentage
  const result = useMemo(() => {
    if (val1 === '' || val2 === '') return null;
    if (val1 === '-' || val2 === '-') return null;

    let payload: Record<string, string> = {};
    if (mode === 'percent-of') {
      payload = { x: val1, y: val2 };
    } else if (mode === 'what-percent') {
      payload = { x: val1, y: val2 };
    } else if (mode === 'change') {
      payload = { a: val1, b: val2 };
    } else if (mode === 'adjust') {
      payload = { x: val1, y: val2 };
    } else if (mode === 'percent-of-what') {
      payload = { x: val2, y: val1 };
    }

    return percentage(mode, payload);
  }, [mode, val1, val2]);

  // Spell-out explanatory sentence
  const explanationSentence = useMemo(() => {
    if (!result || !result.ok || val1 === '' || val2 === '') return null;
    const res = result.formatted;

    switch (mode) {
      case 'percent-of':
        return `${val1}% of ${val2} is ${res}`;
      case 'what-percent':
        return `${val1} is ${res}% of ${val2}`;
      case 'change': {
        const num = Number(res);
        if (num > 0) return `${res}% increase from ${val1} to ${val2}`;
        if (num < 0) return `${Math.abs(num)}% decrease from ${val1} to ${val2}`;
        return `0% change from ${val1} to ${val2}`;
      }
      case 'adjust':
        return `${val2} adjusted by ${val1}% is ${res}`;
      case 'percent-of-what':
        return `${val1} is ${val2}% of ${res}`;
      default:
        return `${res}`;
    }
  }, [result, mode, val1, val2]);

  const handleCopy = async () => {
    if (!result || !result.ok) return;
    const textToCopy = explanationSentence ?? result.formatted;
    const ok = await copyToClipboard(textToCopy);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClear = () => {
    setVal1('');
    setVal2('');
  };

  const getErrorMessage = (error: string) => {
    switch (error) {
      case 'division-by-zero':
        return 'Cannot divide by zero.';
      case 'invalid-value':
        return 'Please enter valid numeric values.';
      case 'invalid-mode':
        return 'Invalid calculation mode.';
      default:
        return `Calculation error: ${error}`;
    }
  };

  // Field labels and hints based on the selected question
  const fieldConfig = useMemo(() => {
    switch (mode) {
      case 'percent-of':
        return {
          label1: 'Percentage (X %)',
          placeholder1: 'e.g. 15',
          label2: 'Of Total (Y)',
          placeholder2: 'e.g. 80',
        };
      case 'what-percent':
        return {
          label1: 'Part (X)',
          placeholder1: 'e.g. 20',
          label2: 'Total (Y)',
          placeholder2: 'e.g. 80',
        };
      case 'change':
        return {
          label1: 'Initial value (X)',
          placeholder1: 'e.g. 80',
          label2: 'Final value (Y)',
          placeholder2: 'e.g. 100',
        };
      case 'adjust':
        return {
          label1: 'Percentage to add or subtract (X %)',
          placeholder1: 'e.g. 10 (or -10)',
          label2: 'Base amount (Y)',
          placeholder2: 'e.g. 50',
        };
      case 'percent-of-what':
        return {
          label1: 'Result value (X)',
          placeholder1: 'e.g. 12',
          label2: 'Percentage it represents (Y %)',
          placeholder2: 'e.g. 15',
        };
    }
  }, [mode]);

  return (
    <ToolScreenShell
      toolName="Percentage Helper"
      tagline="Percentages without the head-scratching"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-4">
        {/* Choice row of question modes */}
        <SegmentedChoice<PercentageMode>
          label="Question"
          choices={QUESTION_CHOICES}
          value={mode}
          onChange={setMode}
        />

        {/* Number inputs for the chosen question */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NumberField
            id="percentage-val1"
            label={fieldConfig.label1}
            value={val1}
            numeric="decimal"
            onChange={(v) => setVal1(String(v))}
            placeholder={fieldConfig.placeholder1}
          />
          <NumberField
            id="percentage-val2"
            label={fieldConfig.label2}
            value={val2}
            numeric="decimal"
            onChange={(v) => setVal2(String(v))}
            placeholder={fieldConfig.placeholder2}
          />
        </div>

        {/* Error Line */}
        {result && !result.ok && (
          <ErrorLine message={getErrorMessage(result.error)} />
        )}

        {/* Answer in large type with explanatory sentence */}
        {result && result.ok && (
          <div className="p-4 bg-[#18191C] border border-white/10 rounded-2xl space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
              Answer
            </span>
            <div className="font-mono text-3xl font-medium text-white tracking-tight break-all select-text">
              {mode === 'what-percent' || mode === 'change'
                ? `${result.formatted}%`
                : result.formatted}
            </div>
            {explanationSentence && (
              <p className="text-sm text-[#ECECEC] leading-relaxed pt-1">
                {explanationSentence}
              </p>
            )}
          </div>
        )}

        {!result && (
          <div className="p-4 bg-[#18191C]/50 border border-white/5 rounded-2xl text-xs text-[#8E9094] italic">
            Enter numbers above to calculate the percentage.
          </div>
        )}

        {/* Buttons: Clear, Copy answer */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleClear}
            disabled={!val1 && !val2}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/10 text-[#D0D2D6] text-sm hover:bg-white/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
          >
            <RotateCcw size={15} />
            <span>Clear</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            disabled={!result || !result.ok}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-white text-black font-medium text-sm hover:bg-[#F0F0F0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2 shadow-sm"
          >
            {copied ? (
              <>
                <Check size={16} className="text-emerald-600" />
                <span className="text-emerald-700">Copied</span>
              </>
            ) : (
              <>
                <Copy size={15} />
                <span>Copy answer</span>
              </>
            )}
          </button>
        </div>
      </div>
    </ToolScreenShell>
  );
};

export default PercentageHelperScreen;
