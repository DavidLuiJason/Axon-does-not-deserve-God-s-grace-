/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Random Picker Screen: Let chance decide.
 * Uses the pure randomPicker engine in src/tools/engines/create/randomPicker.ts.
 */

import React, { useState } from 'react';
import { Dices, Sparkles } from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  ErrorLine,
  LabelledTextArea,
  NumberField,
  OptionsDisclosure,
  PrimaryButton,
  ResultBox,
  SegmentedChoice,
  SingleLineField,
  SwitchRow,
} from '../tools/ToolParts';
import {
  coinFlip,
  pickRandom,
  randomInteger,
  rollDice,
} from '../../tools/engines/create/randomPicker';

export const toolScreen = { toolId: 'random-picker' };

export interface RandomPickerScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

type PickerMode = 'list' | 'range' | 'coin' | 'dice';

const MODE_CHOICES: { id: PickerMode; label: string }[] = [
  { id: 'list', label: 'List' },
  { id: 'range', label: 'Range' },
  { id: 'coin', label: 'Coin' },
  { id: 'dice', label: 'Dice' },
];

export const RandomPickerScreen: React.FC<RandomPickerScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [mode, setMode] = useState<PickerMode>('list');

  // List mode state
  const [listText, setListText] = useState('Apple\nBanana\nCherry\nDate\nElderberry');
  const [pickCount, setPickCount] = useState('1');
  const [allowRepeats, setAllowRepeats] = useState(false);

  // Range mode state
  const [minVal, setMinVal] = useState('1');
  const [maxVal, setMaxVal] = useState('100');

  // Dice mode state
  const [diceNotation, setDiceNotation] = useState('1d6');

  // Result state
  const [resultDisplay, setResultDisplay] = useState<string | null>(null);
  const [resultSub, setResultSub] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePick = () => {
    setErrorMsg(null);

    if (mode === 'list') {
      const items = listText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      if (items.length === 0) {
        setErrorMsg('Please enter at least one item in the list.');
        setResultDisplay(null);
        return;
      }

      const count = Number(pickCount);
      if (!Number.isInteger(count) || count < 1) {
        setErrorMsg('Pick count must be a positive whole number.');
        setResultDisplay(null);
        return;
      }

      const res = pickRandom(items, count, allowRepeats);
      if (res.ok) {
        if (res.values.length === 1) {
          setResultDisplay(res.values[0]);
          setResultSub(`Chosen from ${items.length} items`);
        } else {
          setResultDisplay(res.values.join('\n'));
          setResultSub(`Picked ${res.values.length} of ${items.length} items`);
        }
      } else {
        setResultDisplay(null);
        setResultSub(null);
        if (res.error === 'not-enough-items') {
          setErrorMsg(`Cannot pick ${count} unique items from a list of only ${items.length}. Enable repeats or add more items.`);
        } else {
          setErrorMsg(`Picker error: ${res.error}`);
        }
      }
    } else if (mode === 'range') {
      const min = Number(minVal);
      const max = Number(maxVal);

      if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) {
        setErrorMsg('Please enter valid whole numbers for minimum and maximum.');
        setResultDisplay(null);
        return;
      }
      if (max < min) {
        setErrorMsg('Maximum cannot be smaller than minimum.');
        setResultDisplay(null);
        return;
      }

      const res = randomInteger(min, max);
      if (res.ok) {
        setResultDisplay(String(res.value));
        setResultSub(`Between ${min} and ${max}`);
      } else {
        setErrorMsg(`Range error: ${res.error}`);
        setResultDisplay(null);
      }
    } else if (mode === 'coin') {
      const res = coinFlip();
      if (res.ok) {
        const side = res.result === 'heads' ? 'Heads' : 'Tails';
        setResultDisplay(side);
        setResultSub('50 / 50 chance');
      } else {
        setErrorMsg('Coin flip error');
      }
    } else if (mode === 'dice') {
      const res = rollDice(diceNotation);
      if (res.ok) {
        setResultDisplay(String(res.total));
        setResultSub(`Rolled ${diceNotation}: [${res.rolls.join(', ')}]`);
      } else {
        setErrorMsg('Invalid dice format. Use standard notation like 1d6, 2d20, or 3d6.');
        setResultDisplay(null);
      }
    }
  };

  const verb = mode === 'coin' ? 'Flip coin' : mode === 'dice' ? 'Roll dice' : 'Pick';

  return (
    <ToolScreenShell
      toolName="Random Picker"
      tagline="Let chance decide"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-4">
        {/* Mode selection row */}
        <SegmentedChoice<PickerMode>
          label="Mode"
          choices={MODE_CHOICES}
          value={mode}
          onChange={(m) => {
            setMode(m);
            setErrorMsg(null);
            setResultDisplay(null);
            setResultSub(null);
          }}
        />

        {/* Inputs per mode */}
        {mode === 'list' && (
          <div className="space-y-3">
            <LabelledTextArea
              id="random-picker-list"
              label="Items (one per line)"
              value={listText}
              onChange={setListText}
              placeholder="Paste or type choices, one per line..."
              rows={6}
              onClear={() => setListText('')}
            />
          </div>
        )}

        {mode === 'range' && (
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              id="range-min"
              label="Minimum"
              value={minVal}
              numeric="integer"
              allowNegativeToggle={true}
              onChange={(v) => setMinVal(String(v))}
              placeholder="1"
            />
            <NumberField
              id="range-max"
              label="Maximum"
              value={maxVal}
              numeric="integer"
              allowNegativeToggle={true}
              onChange={(v) => setMaxVal(String(v))}
              placeholder="100"
            />
          </div>
        )}

        {mode === 'coin' && (
          <div className="p-4 bg-[#18191C]/50 border border-white/5 rounded-2xl text-xs text-[#8E9094] text-center">
            Flip a balanced fair coin with cryptographic randomness.
          </div>
        )}

        {mode === 'dice' && (
          <div className="space-y-2">
            <SingleLineField
              id="dice-notation"
              label="Dice Notation"
              value={diceNotation}
              onChange={setDiceNotation}
              placeholder="e.g. 1d6, 2d20, 3d6"
              hint="Format: [number of dice]d[sides], for example 2d6"
            />
            <div className="flex gap-2">
              {['1d6', '2d6', '1d20', '1d100', '3d6'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDiceNotation(preset)}
                  className={`min-h-[40px] flex-1 py-1 px-2 rounded-xl text-xs font-mono font-medium transition-colors cursor-pointer ${
                    diceNotation === preset
                      ? 'bg-white text-black font-semibold'
                      : 'bg-[#1C1D21] text-[#9A9B9F] hover:bg-white/5 hover:text-white border border-white/5'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-1">
          <PrimaryButton
            onClick={handlePick}
            icon={mode === 'dice' ? <Dices size={16} /> : <Sparkles size={16} />}
            className="w-full"
          >
            {verb}
          </PrimaryButton>
        </div>

        {/* Error Line */}
        {errorMsg && <ErrorLine message={errorMsg} />}

        {/* Result Display in large type */}
        {resultDisplay && (
          <div className="p-4 bg-[#18191C] border border-white/10 rounded-2xl space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
              Result
            </span>
            <div className="font-mono text-3xl font-medium text-white tracking-tight break-words whitespace-pre-wrap select-text">
              {resultDisplay}
            </div>
            {resultSub && (
              <p className="text-xs text-[#8E9094] leading-normal pt-0.5">
                {resultSub}
              </p>
            )}
          </div>
        )}

        {/* Options disclosure for list mode */}
        {mode === 'list' && (
          <OptionsDisclosure title="Options">
            <div className="space-y-3">
              <NumberField
                id="list-pick-count"
                label="How many items to pick"
                value={pickCount}
                numeric="integer"
                onChange={(v) => setPickCount(String(v))}
                min={1}
                max={100}
                placeholder="1"
              />
              <SwitchRow
                label="Allow repeated choices"
                description="The same item can be picked more than once"
                checked={allowRepeats}
                onChange={setAllowRepeats}
              />
            </div>
          </OptionsDisclosure>
        )}
      </div>
    </ToolScreenShell>
  );
};

export default RandomPickerScreen;
