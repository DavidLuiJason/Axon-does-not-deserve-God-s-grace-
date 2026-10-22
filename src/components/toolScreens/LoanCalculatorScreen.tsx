/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Loan Calculator Screen: See what a loan really costs.
 * Uses pure loan engine in src/tools/engines/finance/loan.ts.
 */

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  ErrorLine,
  NumberField,
  OptionsDisclosure,
  SegmentedChoice,
} from '../tools/ToolParts';
import {
  calculateLoan,
  scheduleToCsv,
  LOAN_LIMITS,
  type LoanResult,
  type LoanRow,
} from '../../tools/engines/finance/loan';
import { saveFile } from '../../services/saveFile';

export const toolScreen = { toolId: 'loan-calculator' };

export interface LoanCalculatorScreenProps {
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

export const LoanCalculatorScreen: React.FC<LoanCalculatorScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [amount, setAmount] = useState('10000');
  const [rate, setRate] = useState('6');
  const [term, setTerm] = useState('5');
  const [termUnit, setTermUnit] = useState<'years' | 'months'>('years');
  const [extraPayment, setExtraPayment] = useState('0');

  const [showSchedule, setShowSchedule] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const result: LoanResult | null = useMemo(() => {
    const numAmount = parseFloat(amount);
    const numRate = parseFloat(rate);
    const numTerm = parseInt(term, 10);
    const numExtra = extraPayment.trim() ? parseFloat(extraPayment) : 0;

    if (!amount.trim() || !rate.trim() || !term.trim()) {
      return null;
    }

    return calculateLoan({
      amount: numAmount,
      yearlyRate: numRate,
      term: numTerm,
      termUnit,
      extraPayment: Number.isNaN(numExtra) ? 0 : numExtra,
    });
  }, [amount, rate, term, termUnit, extraPayment]);

  const handleSaveCsv = async (rows: LoanRow[]) => {
    setSaveStatus(null);
    const csvData = scheduleToCsv(rows);
    const res = await saveFile('loan-schedule.csv', csvData, 'text/csv');
    if (res.success) {
      setSaveStatus(res.message || 'Saved loan-schedule.csv');
      setTimeout(() => setSaveStatus(null), 4000);
    } else {
      setSaveStatus(res.error || 'Failed to save CSV file.');
    }
  };

  const hasExtraPayment =
    extraPayment.trim() !== '' &&
    parseFloat(extraPayment) > 0 &&
    !Number.isNaN(parseFloat(extraPayment));

  return (
    <ToolScreenShell
      toolName="Loan Calculator"
      tagline="See what a loan really costs"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-5">
        {/* Input Fields */}
        <div className="space-y-4">
          <NumberField
            id="loan-amount"
            label="Amount"
            value={amount}
            numeric="decimal"
            onChange={(val) => setAmount(String(val))}
            placeholder="e.g. 10000"
            max={LOAN_LIMITS.maxAmount}
          />

          <NumberField
            id="loan-rate"
            label="Yearly interest (%)"
            value={rate}
            numeric="decimal"
            onChange={(val) => setRate(String(val))}
            placeholder="e.g. 5.5"
            min={0}
            max={LOAN_LIMITS.maxRate}
          />

          <div className="space-y-1.5">
            <span className="block text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
              Term
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                id="loan-term"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="e.g. 5"
                className="w-full min-h-[44px] bg-[#1C1D21] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-[#E85A3C]"
              />
              <SegmentedChoice<'years' | 'months'>
                choices={[
                  { id: 'years', label: 'Years' },
                  { id: 'months', label: 'Months' },
                ]}
                value={termUnit}
                onChange={setTermUnit}
              />
            </div>
          </div>
        </div>

        {/* Options Row (Extra payment) */}
        <OptionsDisclosure title="Options">
          <NumberField
            id="loan-extra"
            label="Extra payment each month"
            value={extraPayment}
            numeric="decimal"
            onChange={(val) => setExtraPayment(String(val))}
            placeholder="0"
            min={0}
          />
        </OptionsDisclosure>

        {/* Results */}
        {result && result.ok && (
          <div className="space-y-4">
            {/* Monthly Payment (Very Large Type) */}
            <div className="p-6 bg-[#18191C] border border-white/10 rounded-2xl flex flex-col items-center justify-center text-center space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
                Monthly payment
              </span>
              <div className="font-mono text-4xl sm:text-5xl font-medium text-white tracking-tight">
                {formatMoney(result.monthlyPayment)}
              </div>
            </div>

            {/* Total interest & Total paid rows */}
            <div className="bg-[#18191C] border border-white/10 rounded-2xl divide-y divide-white/5 overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-[#8E9094]">Total interest</span>
                <span className="font-mono font-medium text-white">
                  {formatMoney(result.totalInterest)}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-[#8E9094]">Total paid</span>
                <span className="font-mono font-medium text-white">
                  {formatMoney(result.totalPaid)}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-[#8E9094]">Number of payments</span>
                <span className="font-mono text-white">
                  {result.numberOfPayments}
                </span>
              </div>

              {/* Extra payment savings */}
              {hasExtraPayment && (
                <>
                  <div className="px-4 py-3 flex items-center justify-between text-sm bg-emerald-500/5">
                    <span className="text-emerald-400 font-medium">Months saved</span>
                    <span className="font-mono font-semibold text-emerald-400">
                      {result.monthsSaved}
                    </span>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between text-sm bg-emerald-500/5">
                    <span className="text-emerald-400 font-medium">Interest saved</span>
                    <span className="font-mono font-semibold text-emerald-400">
                      {formatMoney(result.interestSaved)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Payment Schedule */}
            <div className="border border-white/10 bg-[#18191C] rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowSchedule(!showSchedule)}
                className="w-full min-h-[44px] px-4 py-3 flex items-center justify-between text-left hover:bg-white/5 transition-colors cursor-pointer"
                aria-expanded={showSchedule}
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A9B9F]">
                  Payment schedule ({result.schedule.length} payments)
                </span>
                <div className="text-[#9A9B9F]">
                  {showSchedule ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
              </button>

              {showSchedule && (
                <div className="p-4 border-t border-white/5 space-y-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono text-left">
                      <thead>
                        <tr className="border-b border-white/10 text-[#8E9094]">
                          <th className="pb-2 font-semibold">#</th>
                          <th className="pb-2 font-semibold text-right">Payment</th>
                          <th className="pb-2 font-semibold text-right">Principal</th>
                          <th className="pb-2 font-semibold text-right">Interest</th>
                          <th className="pb-2 font-semibold text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-white">
                        {(showAllRows
                          ? result.schedule
                          : result.schedule.slice(0, 12)
                        ).map((row) => (
                          <tr key={row.number} className="hover:bg-white/[0.02]">
                            <td className="py-2 text-[#8E9094]">{row.number}</td>
                            <td className="py-2 text-right">{formatMoney(row.payment)}</td>
                            <td className="py-2 text-right text-[#D0D2D6]">
                              {formatMoney(row.principal)}
                            </td>
                            <td className="py-2 text-right text-[#8E9094]">
                              {formatMoney(row.interest)}
                            </td>
                            <td className="py-2 text-right font-medium">
                              {formatMoney(row.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {result.schedule.length > 12 && (
                    <div className="pt-2 flex items-center justify-between gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setShowAllRows(!showAllRows)}
                        className="text-xs text-[#E85A3C] hover:underline cursor-pointer font-medium"
                      >
                        {showAllRows
                          ? 'Show first 12 payments'
                          : `Show all (${result.schedule.length} payments)`}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSaveCsv(result.schedule)}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <Download size={14} />
                        <span>Save schedule as CSV</span>
                      </button>
                    </div>
                  )}

                  {result.schedule.length <= 12 && (
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleSaveCsv(result.schedule)}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <Download size={14} />
                        <span>Save schedule as CSV</span>
                      </button>
                    </div>
                  )}

                  {saveStatus && (
                    <p className="text-xs text-emerald-400 pt-1 text-right">
                      {saveStatus}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {result && !result.ok && <ErrorLine message={result.message} />}

        {!result && (
          <div className="p-4 bg-[#18191C]/50 border border-white/5 rounded-2xl text-xs text-[#8E9094] italic text-center">
            Enter amount, rate, and term above to see your loan calculation.
          </div>
        )}
      </div>
    </ToolScreenShell>
  );
};

export default LoanCalculatorScreen;
