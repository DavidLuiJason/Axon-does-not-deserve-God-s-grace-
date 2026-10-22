/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Text Cleaner Screen: Tidy up messy text.
 * Uses the pure textCleaner engine in src/tools/engines/text/textCleaner.ts.
 */

import React, { useMemo, useState } from 'react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  ErrorLine,
  LabelledTextArea,
  OptionsDisclosure,
  ResultBox,
  SwitchRow,
} from '../tools/ToolParts';
import {
  textCleaner,
  TEXT_CLEANER_LIMITS,
  type TextCleanerCounts,
} from '../../tools/engines/text/textCleaner';

export const toolScreen = { toolId: 'text-cleaner' };

export interface TextCleanerScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

export const TextCleanerScreen: React.FC<TextCleanerScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [text, setText] = useState('');

  // Common switches on the screen
  const [trimEachLine, setTrimEachLine] = useState(true);
  const [collapseSpaces, setCollapseSpaces] = useState(true);
  const [removeBlankLines, setRemoveBlankLines] = useState(false);

  // Advanced options under Options disclosure
  const [collapseBlankLines, setCollapseBlankLines] = useState(true);
  const [straightenQuotes, setStraightenQuotes] = useState(false);
  const [removeZeroWidth, setRemoveZeroWidth] = useState(true);
  const [normalizeLineEndings, setNormalizeLineEndings] = useState(true);

  // Compute live cleanup
  const result = useMemo(() => {
    if (!text) return null;
    return textCleaner(text, {
      trimEachLine,
      collapseRepeatedSpaces: collapseSpaces,
      removeBlankLines,
      collapseBlankLines,
      straightenQuotesAndDashes: straightenQuotes,
      removeZeroWidth,
      normalizeLineEndings,
    });
  }, [
    text,
    trimEachLine,
    collapseSpaces,
    removeBlankLines,
    collapseBlankLines,
    straightenQuotes,
    removeZeroWidth,
    normalizeLineEndings,
  ]);

  // Build clean summary line from engine counts
  const summaryLine = useMemo(() => {
    if (!result || !result.ok || !text) return null;
    const c: TextCleanerCounts = result.counts;
    const parts: string[] = [];

    if (c.removeBlankLines > 0) {
      parts.push(`${c.removeBlankLines} blank line${c.removeBlankLines === 1 ? '' : 's'}`);
    }
    if (c.collapseRepeatedSpaces > 0) {
      parts.push(`${c.collapseRepeatedSpaces} extra space${c.collapseRepeatedSpaces === 1 ? '' : 's'}`);
    }
    if (c.trimEachLine > 0) {
      parts.push(`${c.trimEachLine} trimmed line${c.trimEachLine === 1 ? '' : 's'}`);
    }
    if (c.collapseBlankLines > 0 && !c.removeBlankLines) {
      parts.push(`${c.collapseBlankLines} consecutive blank line${c.collapseBlankLines === 1 ? '' : 's'}`);
    }
    if (c.straightenQuotesAndDashes > 0) {
      parts.push(`${c.straightenQuotesAndDashes} quote/dash`);
    }
    if (c.removeZeroWidth > 0) {
      parts.push(`${c.removeZeroWidth} hidden char${c.removeZeroWidth === 1 ? '' : 's'}`);
    }
    if (c.normalizeLineEndings > 0) {
      parts.push(`${c.normalizeLineEndings} line ending${c.normalizeLineEndings === 1 ? '' : 's'}`);
    }

    if (parts.length === 0) {
      return result.text === text ? 'Text is already clean' : 'Cleaned text';
    }

    if (parts.length === 1) {
      return `Removed ${parts[0]}`;
    }
    if (parts.length === 2) {
      return `Removed ${parts[0]} and ${parts[1]}`;
    }
    return `Cleaned ${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
  }, [result, text]);

  const getErrorMessage = (error: string) => {
    switch (error) {
      case 'too-large':
        return `Input exceeds maximum limit of ${TEXT_CLEANER_LIMITS.maxInputCharacters.toLocaleString()} characters.`;
      case 'invalid-input':
        return 'Invalid text input.';
      default:
        return `Cleaning error: ${error}`;
    }
  };

  return (
    <ToolScreenShell
      toolName="Text Cleaner"
      tagline="Tidy up messy text"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-4">
        {/* Input Text Area */}
        <LabelledTextArea
          id="text-cleaner-input"
          label="Text"
          value={text}
          onChange={setText}
          placeholder="Paste or type messy text to clean..."
          rows={5}
          maxLength={TEXT_CLEANER_LIMITS.maxInputCharacters}
          onClear={() => setText('')}
        />

        {/* Common cleanups on the screen */}
        <div className="p-3 bg-[#18191C] border border-white/5 rounded-xl space-y-1">
          <SwitchRow
            label="Trim lines"
            description="Strip leading and trailing spaces from each line"
            checked={trimEachLine}
            onChange={setTrimEachLine}
          />
          <SwitchRow
            label="Collapse spaces"
            description="Turn repeated spaces into a single space"
            checked={collapseSpaces}
            onChange={setCollapseSpaces}
          />
          <SwitchRow
            label="Remove blank lines"
            description="Delete all completely blank or whitespace lines"
            checked={removeBlankLines}
            onChange={setRemoveBlankLines}
          />
        </div>

        {/* Counts / Summary Line */}
        {summaryLine && (
          <div className="px-1 text-xs">
            <span className="font-mono text-emerald-400 font-medium">
              {summaryLine}
            </span>
          </div>
        )}

        {/* Error Line */}
        {result && !result.ok && (
          <ErrorLine message={getErrorMessage(result.error)} />
        )}

        {/* Result Box with Copy */}
        <ResultBox
          title="Cleaned Text"
          text={result && result.ok ? result.text : ''}
          emptyNotice="Cleaned text will appear here live..."
          onClear={() => setText('')}
        />

        {/* Options */}
        <OptionsDisclosure title="Options">
          <SwitchRow
            label="Collapse consecutive blank lines"
            description="Merge multiple consecutive blank lines into one"
            checked={collapseBlankLines}
            onChange={setCollapseBlankLines}
          />
          <SwitchRow
            label="Straighten curly quotes and dashes"
            description="Convert curly quotes to straight quotes, and em/en dashes to hyphens"
            checked={straightenQuotes}
            onChange={setStraightenQuotes}
          />
          <SwitchRow
            label="Remove zero-width characters"
            description="Strip invisible Unicode joiners and zero-width spaces"
            checked={removeZeroWidth}
            onChange={setRemoveZeroWidth}
          />
          <SwitchRow
            label="Normalize line endings"
            description="Standardize Windows (CRLF) and legacy Mac line breaks to LF"
            checked={normalizeLineEndings}
            onChange={setNormalizeLineEndings}
          />
        </OptionsDisclosure>
      </div>
    </ToolScreenShell>
  );
};

export default TextCleanerScreen;
