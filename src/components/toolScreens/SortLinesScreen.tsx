/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sort Lines Screen: Put your lines in order.
 * Uses the pure sortLines engine in src/tools/engines/text/sortLines.ts.
 */

import React, { useMemo, useState } from 'react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  ErrorLine,
  LabelledTextArea,
  OptionsDisclosure,
  ResultBox,
  SegmentedChoice,
  SingleLineField,
  SwitchRow,
} from '../tools/ToolParts';
import {
  sortLines,
  SORT_LINES_LIMITS,
  type SortLineMode,
} from '../../tools/engines/text/sortLines';

export const toolScreen = { toolId: 'sort-lines' };

export interface SortLinesScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

const MODE_CHOICES: { id: SortLineMode; label: string }[] = [
  { id: 'ascending', label: 'A to Z' },
  { id: 'descending', label: 'Z to A' },
  { id: 'natural', label: 'Natural' },
  { id: 'by-length', label: 'By length' },
  { id: 'reverse', label: 'Reverse' },
  { id: 'shuffle', label: 'Shuffle' },
];

/**
 * Creates a deterministic pseudo-random generator from a seed string or number.
 */
function makeSeededRandom(seedStr: string): () => number {
  if (!seedStr.trim()) {
    return () => Math.random();
  }
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export const SortLinesScreen: React.FC<SortLinesScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<SortLineMode>('ascending');

  // Options
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [removeDuplicates, setRemoveDuplicates] = useState(false);
  const [ignoreBlankLines, setIgnoreBlankLines] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState('');

  // Number of input lines
  const linesIn = useMemo(() => {
    if (!text) return 0;
    return text.split(/\r\n|\n|\r/).length;
  }, [text]);

  // Execute sort
  const result = useMemo(() => {
    if (!text) return null;
    const randomFn = makeSeededRandom(shuffleSeed);
    return sortLines(
      text,
      {
        mode,
        ignoreCase,
        removeDuplicates,
        ignoreBlankLines,
      },
      randomFn
    );
  }, [text, mode, ignoreCase, removeDuplicates, ignoreBlankLines, shuffleSeed]);

  const getErrorMessage = (error: string) => {
    switch (error) {
      case 'too-large':
        return `Input exceeds limits: max ${SORT_LINES_LIMITS.maxInputCharacters.toLocaleString()} characters or ${SORT_LINES_LIMITS.maxLines.toLocaleString()} lines.`;
      case 'invalid-mode':
        return `Invalid sorting mode: ${mode}.`;
      case 'invalid-random':
        return 'Shuffle random generator failed.';
      case 'invalid-input':
        return 'Invalid text input.';
      default:
        return `Sorting error: ${error}`;
    }
  };

  const lineCountSummary = useMemo(() => {
    if (!text || !result || !result.ok) return null;
    const out = result.lineCount;
    return `${linesIn.toLocaleString()} line${linesIn === 1 ? '' : 's'} in, ${out.toLocaleString()} line${out === 1 ? '' : 's'} out`;
  }, [text, linesIn, result]);

  return (
    <ToolScreenShell
      toolName="Sort Lines"
      tagline="Put your lines in order"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-4">
        {/* Input Text Area */}
        <LabelledTextArea
          id="sort-lines-input"
          label="Lines"
          value={text}
          onChange={setText}
          placeholder="Paste or type lines to sort..."
          rows={6}
          maxLength={SORT_LINES_LIMITS.maxInputCharacters}
          onClear={() => setText('')}
        />

        {/* Choice row with engine mode display names */}
        <SegmentedChoice<SortLineMode>
          label="Sort Order"
          choices={MODE_CHOICES}
          value={mode}
          onChange={setMode}
        />

        {/* Lines In/Out Summary Line */}
        {lineCountSummary && (
          <div className="px-1 text-xs">
            <span className="font-mono text-emerald-400 font-medium">
              {lineCountSummary}
            </span>
          </div>
        )}

        {/* Error Line */}
        {result && !result.ok && (
          <ErrorLine message={getErrorMessage(result.error)} />
        )}

        {/* Result Box with Copy */}
        <ResultBox
          title="Sorted Lines"
          text={result && result.ok ? result.text : ''}
          emptyNotice="Sorted lines will appear here live..."
          onClear={() => setText('')}
        />

        {/* Options */}
        <OptionsDisclosure title="Options">
          <SwitchRow
            label="Ignore case"
            description="Sort uppercase and lowercase letters identically"
            checked={ignoreCase}
            onChange={setIgnoreCase}
          />
          <SwitchRow
            label="Remove duplicates"
            description="Keep only the first occurrence of identical lines"
            checked={removeDuplicates}
            onChange={setRemoveDuplicates}
          />
          <SwitchRow
            label="Ignore blank lines"
            description="Discard empty and whitespace-only lines before sorting"
            checked={ignoreBlankLines}
            onChange={setIgnoreBlankLines}
          />
          {mode === 'shuffle' && (
            <SingleLineField
              id="sort-lines-seed"
              label="Shuffle seed"
              value={shuffleSeed}
              onChange={setShuffleSeed}
              placeholder="Optional seed (e.g. 12345)"
              hint="Leave blank for random shuffle, or enter a seed for repeatable results"
              onClear={() => setShuffleSeed('')}
            />
          )}
        </OptionsDisclosure>
      </div>
    </ToolScreenShell>
  );
};

export default SortLinesScreen;
