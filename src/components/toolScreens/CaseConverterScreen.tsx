/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Case Converter Screen: Change the case of any text.
 * Uses the pure case conversion engine in src/tools/engines/text/caseConvert.ts.
 */

import React, { useMemo, useState } from 'react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  ErrorLine,
  LabelledTextArea,
  ResultBox,
  SegmentedChoice,
} from '../tools/ToolParts';
import {
  caseConvert,
  CASE_CONVERT_LIMITS,
  CASE_CONVERT_MODES,
  type CaseConvertMode,
} from '../../tools/engines/text/caseConvert';

export const toolScreen = { toolId: 'case-converter' };

export interface CaseConverterScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

export const CaseConverterScreen: React.FC<CaseConverterScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<CaseConvertMode>('UPPER');

  // Convert live as text or mode changes
  const result = useMemo(() => {
    if (!text) return null;
    return caseConvert(text, mode);
  }, [text, mode]);

  const getErrorMessage = (error: string) => {
    switch (error) {
      case 'too-large':
        return `Input text exceeds the maximum limit of ${CASE_CONVERT_LIMITS.maxInputCharacters.toLocaleString()} characters.`;
      case 'invalid-mode':
        return `Invalid conversion mode selected: ${mode}.`;
      case 'invalid-input':
        return 'Invalid text input.';
      default:
        return `Conversion error: ${error}`;
    }
  };

  return (
    <ToolScreenShell
      toolName="Case Converter"
      tagline="Change the case of any text"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-4">
        {/* Multi-line Text Field */}
        <LabelledTextArea
          id="case-convert-input"
          label="Text"
          value={text}
          onChange={setText}
          placeholder="Paste or type text to convert..."
          rows={6}
          maxLength={CASE_CONVERT_LIMITS.maxInputCharacters}
          onClear={() => setText('')}
        />

        {/* Choice row: one per engine mode with engine's display names */}
        <SegmentedChoice<CaseConvertMode>
          label="Target Case"
          choices={CASE_CONVERT_MODES}
          value={mode}
          onChange={setMode}
        />

        {/* Error message */}
        {result && !result.ok && (
          <ErrorLine message={getErrorMessage(result.error)} />
        )}

        {/* Result Box with Copy button */}
        <ResultBox
          title="Converted Text"
          text={result && result.ok ? result.text : ''}
          emptyNotice="Converted text will show here live..."
          onClear={() => setText('')}
        />
      </div>
    </ToolScreenShell>
  );
};

export default CaseConverterScreen;
