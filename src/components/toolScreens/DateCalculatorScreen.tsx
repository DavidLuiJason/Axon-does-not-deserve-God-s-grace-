/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Date Calculator Screen: Work with dates.
 * Uses the pure dateCalc engine in src/tools/engines/time/dateCalc.ts.
 */

import React, { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  copyToClipboard,
  ErrorLine,
  NumberField,
  SegmentedChoice,
  SingleLineField,
} from '../tools/ToolParts';
import {
  addDate,
  countWeekdays,
  dayOfYear,
  differenceDates,
  isoWeekNumber,
  isLeapYear,
  weekday,
  type DateUnit,
} from '../../tools/engines/time/dateCalc';

export const toolScreen = { toolId: 'date-calculator' };

export interface DateCalculatorScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

type DateOp = 'between' | 'add' | 'weekday';

const OP_CHOICES: { id: DateOp; label: string }[] = [
  { id: 'between', label: 'Days between two dates' },
  { id: 'add', label: 'Add or take away time' },
  { id: 'weekday', label: 'Day of the week' },
];

const UNIT_CHOICES: { id: DateUnit; label: string }[] = [
  { id: 'days', label: 'Days' },
  { id: 'months', label: 'Months' },
  { id: 'years', label: 'Years' },
];

const WEEKDAY_NAMES = [
  '',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export const DateCalculatorScreen: React.FC<DateCalculatorScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [op, setOp] = useState<DateOp>('between');

  // Today's date in YYYY-MM-DD
  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  // Form states
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [amount, setAmount] = useState('30');
  const [unit, setUnit] = useState<DateUnit>('days');
  const [targetDate, setTargetDate] = useState(todayStr);
  const [copied, setCopied] = useState(false);

  // Compute answers based on operation
  const betweenResult = useMemo(() => {
    if (op !== 'between' || !startDate || !endDate) return null;
    const diff = differenceDates(startDate, endDate);
    if (!diff.ok) return diff;
    const workdays = countWeekdays(startDate, endDate);
    return {
      ok: true as const,
      diff: diff.value,
      workdays: workdays.ok ? workdays.value : null,
    };
  }, [op, startDate, endDate]);

  const addResult = useMemo(() => {
    if (op !== 'add' || !targetDate || amount === '' || amount === '-') return null;
    const num = Number(amount);
    if (!Number.isSafeInteger(num)) return { ok: false as const, error: 'invalid-amount' };
    return addDate(targetDate, num, unit);
  }, [op, targetDate, amount, unit]);

  const weekdayResult = useMemo(() => {
    if (op !== 'weekday' || !targetDate) return null;
    const wd = weekday(targetDate);
    if (!wd.ok) return wd;
    const doy = dayOfYear(targetDate);
    const weekNum = isoWeekNumber(targetDate);
    const y = Number(targetDate.slice(0, 4));
    return {
      ok: true as const,
      weekday: wd.value,
      dayOfYear: doy.ok ? doy.value : null,
      weekNumber: weekNum.ok ? weekNum.value : null,
      isLeap: isLeapYear(y),
    };
  }, [op, targetDate]);

  // Plain-words answer
  const answerExplanation = useMemo(() => {
    if (op === 'between' && betweenResult && betweenResult.ok) {
      const { totalDays, years, months, days } = betweenResult.diff;
      const absDays = Math.abs(totalDays);
      const weeks = Math.floor(absDays / 7);
      const remDays = absDays % 7;

      let primary = `There are ${absDays.toLocaleString()} day${absDays === 1 ? '' : 's'} between these dates`;
      if (weeks > 0 || remDays > 0) {
        primary += ` (${weeks} week${weeks === 1 ? '' : 's'}${remDays > 0 ? ` and ${remDays} day${remDays === 1 ? '' : 's'}` : ''})`;
      }

      const extraParts: string[] = [];
      if (Math.abs(years) > 0 || Math.abs(months) > 0) {
        const yStr = Math.abs(years) > 0 ? `${Math.abs(years)} year${Math.abs(years) === 1 ? '' : 's'}` : '';
        const mStr = Math.abs(months) > 0 ? `${Math.abs(months)} month${Math.abs(months) === 1 ? '' : 's'}` : '';
        const dStr = Math.abs(days) > 0 ? `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}` : '';
        const breakdown = [yStr, mStr, dStr].filter(Boolean).join(', ');
        if (breakdown) extraParts.push(`or ${breakdown}`);
      }
      if (betweenResult.workdays !== null) {
        extraParts.push(`${Math.abs(betweenResult.workdays).toLocaleString()} business days`);
      }

      return {
        main: `${absDays.toLocaleString()} days`,
        sentence: primary + (extraParts.length ? ` · ${extraParts.join(' · ')}` : ''),
      };
    }

    if (op === 'add' && addResult && addResult.ok) {
      const nextDate = addResult.value;
      const wd = weekday(nextDate);
      const dayName = wd.ok ? WEEKDAY_NAMES[wd.value] : '';
      const num = Number(amount);
      const verb = num >= 0 ? 'Adding' : 'Subtracting';
      const absAmount = Math.abs(num);

      return {
        main: nextDate,
        sentence: `${verb} ${absAmount} ${unit} gives ${nextDate}${dayName ? ` (${dayName})` : ''}`,
      };
    }

    if (op === 'weekday' && weekdayResult && weekdayResult.ok) {
      const dayName = WEEKDAY_NAMES[weekdayResult.weekday];
      const details: string[] = [];
      if (weekdayResult.dayOfYear !== null) {
        details.push(`day ${weekdayResult.dayOfYear} of the year`);
      }
      if (weekdayResult.weekNumber !== null) {
        details.push(`ISO week ${weekdayResult.weekNumber}`);
      }
      if (weekdayResult.isLeap) {
        details.push('leap year');
      }

      return {
        main: dayName,
        sentence: `${targetDate} is a ${dayName} (${details.join(', ')})`,
      };
    }

    return null;
  }, [op, betweenResult, addResult, weekdayResult, amount, unit, targetDate]);

  const activeError = useMemo(() => {
    if (op === 'between' && betweenResult && !betweenResult.ok) {
      return betweenResult.error;
    }
    if (op === 'add' && addResult && !addResult.ok) {
      return addResult.error;
    }
    if (op === 'weekday' && weekdayResult && !weekdayResult.ok) {
      return weekdayResult.error;
    }
    return null;
  }, [op, betweenResult, addResult, weekdayResult]);

  const getErrorMessage = (error: string) => {
    switch (error) {
      case 'invalid-date':
        return 'Please enter a valid calendar date in YYYY-MM-DD format.';
      case 'invalid-amount':
        return 'Please enter a valid whole number for time amount.';
      case 'date-out-of-range':
        return 'Calculated date exceeds Gregorian calendar range (years 0001 to 9999).';
      default:
        return `Date error: ${error}`;
    }
  };

  const handleCopy = async () => {
    if (!answerExplanation) return;
    const ok = await copyToClipboard(answerExplanation.sentence);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <ToolScreenShell
      toolName="Date Calculator"
      tagline="Work with dates"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-4">
        {/* Choice row of operations */}
        <SegmentedChoice<DateOp>
          label="Operation"
          choices={OP_CHOICES}
          value={op}
          onChange={setOp}
        />

        {/* Inputs depending on operation */}
        {op === 'between' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SingleLineField
              id="date-start"
              type="date"
              label="Start date"
              value={startDate}
              onChange={setStartDate}
            />
            <SingleLineField
              id="date-end"
              type="date"
              label="End date"
              value={endDate}
              onChange={setEndDate}
            />
          </div>
        )}

        {op === 'add' && (
          <div className="space-y-3">
            <SingleLineField
              id="date-target"
              type="date"
              label="Base date"
              value={targetDate}
              onChange={setTargetDate}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NumberField
                id="date-amount"
                label="Amount (positive or negative)"
                value={amount}
                numeric="integer"
                allowNegativeToggle={true}
                onChange={(v) => setAmount(String(v))}
                placeholder="e.g. 30 or -7"
              />
              <SegmentedChoice<DateUnit>
                label="Unit"
                choices={UNIT_CHOICES}
                value={unit}
                onChange={setUnit}
              />
            </div>
          </div>
        )}

        {op === 'weekday' && (
          <SingleLineField
            id="date-weekday-input"
            type="date"
            label="Date"
            value={targetDate}
            onChange={setTargetDate}
          />
        )}

        {/* Error Line */}
        {activeError && <ErrorLine message={getErrorMessage(activeError)} />}

        {/* Answer in plain words */}
        {answerExplanation && (
          <div className="p-4 bg-[#18191C] border border-white/10 rounded-2xl space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
              Answer
            </span>
            <div className="font-mono text-3xl font-medium text-white tracking-tight break-all select-text">
              {answerExplanation.main}
            </div>
            <p className="text-sm text-[#ECECEC] leading-relaxed pt-1">
              {answerExplanation.sentence}
            </p>
          </div>
        )}

        {/* Copy Answer Button */}
        {answerExplanation && (
          <div className="pt-1">
            <button
              type="button"
              onClick={handleCopy}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-white text-black font-medium text-sm hover:bg-[#F0F0F0] transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
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
        )}
      </div>
    </ToolScreenShell>
  );
};

export default DateCalculatorScreen;
