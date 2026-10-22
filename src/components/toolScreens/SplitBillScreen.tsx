/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Split and Tip Screen: Share the bill fairly.
 * Uses pure splitTip engine in src/tools/engines/finance/splitTip.ts.
 */

import React, { useMemo, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  ErrorLine,
  NumberField,
  OptionsDisclosure,
  SwitchRow,
} from '../tools/ToolParts';
import {
  splitTip,
  SPLIT_TIP_LIMITS,
  type SplitTipResult,
} from '../../tools/engines/finance/splitTip';

export const toolScreen = { toolId: 'split-bill' };

export interface SplitBillScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

function formatMoney(cents: number): string {
  const value = cents / 100;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type TipChoice = '10' | '15' | '20' | 'other';

export const SplitBillScreen: React.FC<SplitBillScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [bill, setBill] = useState('120');
  const [tipChoice, setTipChoice] = useState<TipChoice>('15');
  const [otherTip, setOtherTip] = useState('18');
  const [people, setPeople] = useState(4);

  // Options
  const [roundUp, setRoundUp] = useState(false);
  const [useUnevenShares, setUseUnevenShares] = useState(false);
  const [partsInput, setPartsInput] = useState('');

  const tipPercent = useMemo(() => {
    if (tipChoice === 'other') {
      const parsed = parseFloat(otherTip);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    return parseFloat(tipChoice);
  }, [tipChoice, otherTip]);

  const result: SplitTipResult | null = useMemo(() => {
    if (!bill.trim()) return null;
    const numBill = parseFloat(bill);

    let parsedParts: number[] | undefined = undefined;
    if (useUnevenShares) {
      if (!partsInput.trim()) {
        parsedParts = [];
      } else {
        parsedParts = partsInput
          .split(/[,\s]+/)
          .filter(Boolean)
          .map((p) => {
            const n = Number(p);
            return Number.isInteger(n) ? n : -1;
          });
      }
    }

    return splitTip({
      bill: numBill,
      tipPercent,
      people,
      roundUp,
      parts: parsedParts,
    });
  }, [bill, tipPercent, people, roundUp, useUnevenShares, partsInput]);

  const handlePeopleChange = (delta: number) => {
    setPeople((prev) => {
      const next = prev + delta;
      return Math.max(1, Math.min(SPLIT_TIP_LIMITS.maxPeople, next));
    });
  };

  return (
    <ToolScreenShell
      toolName="Split and Tip"
      tagline="Share the bill fairly"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-5">
        {/* Bill Amount Field */}
        <NumberField
          id="split-bill-amount"
          label="Bill"
          value={bill}
          numeric="decimal"
          onChange={(val) => setBill(String(val))}
          placeholder="0.00"
          max={SPLIT_TIP_LIMITS.maxBill}
        />

        {/* Tip Choices */}
        <div className="space-y-1.5">
          <span className="block text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
            Tip
          </span>
          <div className="flex flex-wrap gap-2">
            {(['10', '15', '20', 'other'] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => setTipChoice(choice)}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer flex-1 min-w-[70px] flex items-center justify-center ${
                  tipChoice === choice
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'bg-[#1C1D21] text-[#9A9B9F] hover:text-white hover:bg-white/10 border border-white/10'
                }`}
              >
                {choice === 'other' ? 'Other' : `${choice}%`}
              </button>
            ))}
          </div>

          {tipChoice === 'other' && (
            <div className="pt-2">
              <NumberField
                id="split-tip-other"
                label="Custom tip percentage (%)"
                value={otherTip}
                numeric="decimal"
                onChange={(val) => setOtherTip(String(val))}
                placeholder="e.g. 18"
                min={0}
                max={SPLIT_TIP_LIMITS.maxTipPercent}
              />
            </div>
          )}
        </div>

        {/* People Stepper */}
        <div className="space-y-1.5">
          <span className="block text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
            People
          </span>
          <div className="flex items-center gap-3 bg-[#18191C] border border-white/10 rounded-2xl p-2.5">
            <button
              type="button"
              onClick={() => handlePeopleChange(-1)}
              disabled={people <= 1}
              aria-label="Fewer people"
              className="min-h-[44px] min-w-[48px] p-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Minus size={18} />
            </button>

            <div className="flex-1 text-center font-mono text-2xl font-semibold text-white select-none">
              {people}
            </div>

            <button
              type="button"
              onClick={() => handlePeopleChange(1)}
              disabled={people >= SPLIT_TIP_LIMITS.maxPeople}
              aria-label="More people"
              className="min-h-[44px] min-w-[48px] p-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* Options Row */}
        <OptionsDisclosure title="Options">
          <div className="space-y-4 pt-1">
            <SwitchRow
              label="Round each share up"
              description="Rounds every person's share up to the nearest whole unit."
              checked={roundUp}
              onChange={setRoundUp}
            />

            <div className="space-y-2 pt-2 border-t border-white/5">
              <SwitchRow
                label="Uneven shares"
                description={`Enter ratio or parts for each person (e.g. 2, 1 for 2 people).`}
                checked={useUnevenShares}
                onChange={setUseUnevenShares}
              />

              {useUnevenShares && (
                <div className="pt-1">
                  <label
                    htmlFor="split-parts"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#8E9094] mb-1"
                  >
                    Parts for each of the {people} people
                  </label>
                  <input
                    id="split-parts"
                    type="text"
                    value={partsInput}
                    onChange={(e) => setPartsInput(e.target.value)}
                    placeholder={`e.g. ${Array(people).fill(1).join(', ')}`}
                    className="w-full min-h-[44px] bg-[#1C1D21] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-[#E85A3C]"
                  />
                  <p className="text-[11px] text-[#8E9094] mt-1">
                    Enter {people} positive numbers separated by commas or spaces.
                  </p>
                </div>
              )}
            </div>
          </div>
        </OptionsDisclosure>

        {/* Results */}
        {result && result.ok && (
          <div className="space-y-4">
            {/* Primary Share in Very Large Type */}
            <div className="p-6 bg-[#18191C] border border-white/10 rounded-2xl flex flex-col items-center justify-center text-center space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
                {useUnevenShares && result.shares.length > 1
                  ? 'Individual shares'
                  : 'Each person pays'}
              </span>
              {!useUnevenShares || result.shares.every((s) => s === result.shares[0]) ? (
                <div className="font-mono text-4xl sm:text-5xl font-medium text-white tracking-tight">
                  {formatMoney(result.shares[0] ?? 0)}
                </div>
              ) : (
                <div className="w-full space-y-2 pt-2">
                  {result.shares.map((share, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-sm px-2 py-1 bg-white/[0.02] rounded-lg"
                    >
                      <span className="text-[#8E9094] font-medium">Person {idx + 1}</span>
                      <span className="font-mono font-semibold text-white text-base">
                        {formatMoney(share)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bill Details Rows */}
            <div className="bg-[#18191C] border border-white/10 rounded-2xl divide-y divide-white/5 overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-[#8E9094]">Bill</span>
                <span className="font-mono font-medium text-white">
                  {formatMoney(result.billCents)}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-[#8E9094]">Tip ({tipPercent}%)</span>
                <span className="font-mono font-medium text-white">
                  {formatMoney(result.tipCents)}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-[#8E9094] font-medium">Total</span>
                <span className="font-mono font-bold text-white text-base">
                  {formatMoney(result.totalCents)}
                </span>
              </div>
            </div>

            {/* Leftover Cents Line */}
            {result.remainderRecipients.length > 0 && !roundUp && (
              <p className="text-xs text-[#8E9094] text-center px-2 leading-relaxed">
                {result.remainderRecipients.length === 1
                  ? '1 leftover cent is paid by person 1.'
                  : `${result.remainderRecipients.length} leftover cents are paid by the first ${result.remainderRecipients.length} people.`}
              </p>
            )}

            {/* Round up notice */}
            {result.roundingExtraCents > 0 && (
              <p className="text-xs text-[#8E9094] text-center px-2 leading-relaxed">
                Rounding each share up added {formatMoney(result.roundingExtraCents)} extra to the total.
              </p>
            )}
          </div>
        )}

        {result && !result.ok && <ErrorLine message={result.message} />}

        {!result && (
          <div className="p-4 bg-[#18191C]/50 border border-white/5 rounded-2xl text-xs text-[#8E9094] italic text-center">
            Enter a bill amount above to calculate individual shares.
          </div>
        )}
      </div>
    </ToolScreenShell>
  );
};

export default SplitBillScreen;
