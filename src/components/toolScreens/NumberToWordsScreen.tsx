/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Number to Words Screen: Write a number out in words.
 * Uses the pure numberToWords engine in src/tools/engines/numbers/numberToWords.ts.
 */

import React, { useMemo, useState } from 'react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  ErrorLine,
  NumberField,
  OptionsDisclosure,
  ResultBox,
  SwitchRow,
} from '../tools/ToolParts';
import { numberToWords } from '../../tools/engines/numbers/numberToWords';

export const toolScreen = { toolId: 'number-to-words' };

export interface NumberToWordsScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

export const NumberToWordsScreen: React.FC<NumberToWordsScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [numInput, setNumInput] = useState('1000001');

  // Options
  const [ordinal, setOrdinal] = useState(false);
  const [capitalize, setCapitalize] = useState(true);

  // Compute words live
  const result = useMemo(() => {
    const trimmed = numInput.trim();
    if (!trimmed || trimmed === '-' || trimmed === '+') return null;
    return numberToWords(trimmed, { ordinal });
  }, [numInput, ordinal]);

  const formattedWords = useMemo(() => {
    if (!result || !result.ok) return '';
    const w = result.words;
    if (capitalize && w.length > 0) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }
    return w;
  }, [result, capitalize]);

  const getErrorMessage = (error: string) => {
    switch (error) {
      case 'too-large':
        return 'Number is too large. Maximum supported integer is 999 quintillion (10^21 - 1).';
      case 'too-long':
        return 'Input exceeds maximum length of 128 characters.';
      case 'invalid-ordinal':
        return 'Ordinal numbers (e.g. 1st, 2nd) must be whole numbers without decimal places.';
      case 'invalid-input':
        return 'Please enter a valid number (e.g. 42 or 3.14159).';
      default:
        return `Error: ${error}`;
    }
  };

  return (
    <ToolScreenShell
      toolName="Number to Words"
      tagline="Write a number out in words"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-4">
        {/* Number Input */}
        <NumberField
          id="number-to-words-input"
          label="Number"
          value={numInput}
          numeric="decimal"
          allowNegativeToggle={true}
          onChange={(v) => setNumInput(String(v))}
          placeholder="e.g. 1,000,001 or 3.14"
        />

        {/* Error Line */}
        {result && !result.ok && (
          <ErrorLine message={getErrorMessage(result.error)} />
        )}

        {/* Result Box with Copy */}
        <ResultBox
          title="In Words"
          text={formattedWords}
          emptyNotice="Enter a number above to see it written in words..."
          onClear={() => setNumInput('')}
        />

        {/* Options */}
        <OptionsDisclosure title="Options">
          <SwitchRow
            label="Ordinal form"
            description="Format as sequence position (first, second, third) instead of cardinal amount"
            checked={ordinal}
            onChange={setOrdinal}
          />
          <SwitchRow
            label="Capitalize initial letter"
            description="Start the sentence with a capital letter"
            checked={capitalize}
            onChange={setCapitalize}
          />
        </OptionsDisclosure>
      </div>
    </ToolScreenShell>
  );
};

export default NumberToWordsScreen;
