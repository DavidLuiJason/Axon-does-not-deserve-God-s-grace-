/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Code Formatter Screen: Tidy or shrink code (JSON, CSS, HTML, XML).
 * Uses the pure formatting engine in src/tools/engines/code/codeFormat.ts.
 */

import React, { useId, useMemo, useState } from 'react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  ChoiceOption,
  ErrorLine,
  LabelledTextArea,
  OptionsDisclosure,
  PrimaryButton,
  ResultBox,
  SegmentedChoice,
} from '../tools/ToolParts';
import {
  CODE_FORMAT_LIMITS,
  CodeIndent,
  CodeLanguage,
  CodeMode,
  formatCode,
} from '../../tools/engines/code/codeFormat';

export const toolScreen = { toolId: 'code-formatter' };

export interface CodeFormatterScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

type IndentString = '2' | '4' | 'tab';

const LANGUAGE_CHOICES: ChoiceOption<CodeLanguage>[] = [
  { id: 'json', label: 'JSON' },
  { id: 'css', label: 'CSS' },
  { id: 'html', label: 'HTML' },
  { id: 'xml', label: 'XML' },
];

const MODE_CHOICES: ChoiceOption<CodeMode>[] = [
  { id: 'pretty', label: 'Tidy' },
  { id: 'minify', label: 'Shrink' },
];

const INDENT_CHOICES: ChoiceOption<IndentString>[] = [
  { id: '2', label: '2 spaces' },
  { id: '4', label: '4 spaces' },
  { id: 'tab', label: 'Tab' },
];

/** Threshold in characters above which live typing format is paused to protect low-end phones (Infinix Note 10). */
const LIVE_FORMAT_CHAR_LIMIT = 50_000;

export const CodeFormatterScreen: React.FC<CodeFormatterScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const codeInputId = useId();
  const [language, setLanguage] = useState<CodeLanguage>('json');
  const [mode, setMode] = useState<CodeMode>('pretty');
  const [indent, setIndent] = useState<IndentString>('2');
  const [code, setCode] = useState('');

  // For large inputs over the live threshold, we keep manual execution state
  const [manualOutput, setManualOutput] = useState<string | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);

  const indentValue: CodeIndent = indent === 'tab' ? 'tab' : indent === '4' ? 4 : 2;
  const isLive = code.length <= LIVE_FORMAT_CHAR_LIMIT;

  // Compute live result for inputs up to the live limit
  const liveResult = useMemo(() => {
    if (!isLive) return null;
    const trimmed = code.trim();
    if (!trimmed) {
      return { output: '', error: null };
    }
    const res = formatCode({
      language,
      mode,
      indent: indentValue,
      input: code,
    });
    if (res.ok) {
      return { output: res.output, error: null };
    }
    return {
      output: '',
      error: `${res.message} (line ${res.line}, col ${res.column})`,
    };
  }, [code, language, mode, indentValue, isLive]);

  // Execute manual format for large inputs or manual button clicks
  const executeFormat = () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setManualOutput('');
      setManualError(null);
      return;
    }
    const res = formatCode({
      language,
      mode,
      indent: indentValue,
      input: code,
    });
    if (res.ok) {
      setManualOutput(res.output);
      setManualError(null);
    } else {
      setManualOutput('');
      setManualError(`${res.message} (line ${res.line}, col ${res.column})`);
    }
  };

  const currentOutput = isLive ? (liveResult?.output ?? '') : (manualOutput ?? '');
  const currentError = isLive ? (liveResult?.error ?? null) : manualError;

  const handleClearCode = () => {
    setCode('');
    setManualOutput(null);
    setManualError(null);
  };

  return (
    <ToolScreenShell
      toolName="Code Formatter"
      tagline="Tidy or shrink code"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-4">
        {/* 1. Language selector */}
        <div className="space-y-1.5">
          <SegmentedChoice
            label="Language"
            choices={LANGUAGE_CHOICES}
            value={language}
            onChange={(val) => {
              setLanguage(val);
              if (!isLive) {
                setManualOutput(null);
                setManualError(null);
              }
            }}
          />
          <p className="text-xs text-[#8E9094] pl-0.5">
            JavaScript is not supported yet.
          </p>
        </div>

        {/* 2. Mode selector: Tidy or Shrink */}
        <SegmentedChoice
          label="Mode"
          choices={MODE_CHOICES}
          value={mode}
          onChange={(val) => {
            setMode(val);
            if (!isLive) {
              setManualOutput(null);
              setManualError(null);
            }
          }}
        />

        {/* 3. Options disclosure: Indent */}
        <OptionsDisclosure title="Options">
          <SegmentedChoice
            label="Indent"
            choices={INDENT_CHOICES}
            value={indent}
            onChange={(val) => {
              setIndent(val);
              if (!isLive) {
                setManualOutput(null);
                setManualError(null);
              }
            }}
          />
        </OptionsDisclosure>

        {/* 4. Multi-line Code input */}
        <LabelledTextArea
          id={codeInputId}
          label="Code"
          value={code}
          onChange={(val) => {
            setCode(val);
            if (!isLive) {
              setManualOutput(null);
              setManualError(null);
            }
          }}
          placeholder="Paste or type code here..."
          rows={8}
          maxLength={CODE_FORMAT_LIMITS.maxBytes}
          onClear={handleClearCode}
        />

        {/* 5. Format button (shown prominently when input exceeds live threshold) */}
        {!isLive && (
          <div className="space-y-1.5 pt-1">
            <PrimaryButton
              onClick={executeFormat}
              disabled={code.trim() === ''}
              className="w-full"
            >
              Format
            </PrimaryButton>
            <p className="text-xs text-[#8E9094] text-center">
              Large input: tap Format to update result.
            </p>
          </div>
        )}

        {/* 6. Error line with line and column */}
        {currentError && <ErrorLine message={currentError} />}

        {/* 7. Result box with Copy */}
        <ResultBox
          title="Result"
          text={currentOutput}
          emptyNotice="Formatted code will appear here..."
          onClear={!isLive && manualOutput ? () => setManualOutput(null) : undefined}
        />
      </div>
    </ToolScreenShell>
  );
};

export default CodeFormatterScreen;
