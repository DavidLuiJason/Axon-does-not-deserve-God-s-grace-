/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Find and Replace Screen: Find and replace inside your text.
 * Uses the pure find/replace engine in src/tools/engines/text/findReplace.ts.
 */

import React, { useMemo, useState } from 'react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  ErrorLine,
  LabelledTextArea,
  OptionsDisclosure,
  ResultBox,
  SingleLineField,
  SwitchRow,
} from '../tools/ToolParts';
import {
  findReplace,
  FIND_REPLACE_LIMITS,
} from '../../tools/engines/text/findReplace';

export const toolScreen = { toolId: 'find-replace' };

export interface FindReplaceScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

export const FindReplaceScreen: React.FC<FindReplaceScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [text, setText] = useState('');
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');

  // Options
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regex, setRegex] = useState(false);
  const [replaceAll, setReplaceAll] = useState(true);

  // Compute live find and replace
  const result = useMemo(() => {
    if (!text && !findText) return null;
    return findReplace(text, findText, replaceText, {
      caseSensitive,
      wholeWord,
      regex,
      replaceAll,
    });
  }, [text, findText, replaceText, caseSensitive, wholeWord, regex, replaceAll]);

  const getErrorMessage = (error: string) => {
    switch (error) {
      case 'invalid-pattern':
        return 'Invalid pattern: check regular expression syntax.';
      case 'unsafe-pattern':
        return 'Unsafe pattern: nested or unbounded quantifiers could freeze execution.';
      case 'too-large':
        return `Input exceeds limits: text up to ${FIND_REPLACE_LIMITS.maxInputCharacters.toLocaleString()} characters, pattern up to ${FIND_REPLACE_LIMITS.maxPatternCharacters.toLocaleString()}.`;
      case 'invalid-input':
        return 'Invalid input.';
      default:
        return `Error: ${error}`;
    }
  };

  const matchSummary = useMemo(() => {
    if (!findText) return null;
    if (!result || !result.ok) return null;
    if (result.matchCount === 0) return 'No matches';
    return result.matchCount === 1 ? '1 match' : `${result.matchCount.toLocaleString()} matches`;
  }, [findText, result]);

  return (
    <ToolScreenShell
      toolName="Find and Replace"
      tagline="Find and replace inside your text"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-4">
        {/* Text Input */}
        <LabelledTextArea
          id="find-replace-text"
          label="Text"
          value={text}
          onChange={setText}
          placeholder="Paste or type your text here..."
          rows={5}
          maxLength={FIND_REPLACE_LIMITS.maxInputCharacters}
          onClear={() => setText('')}
        />

        {/* Find and Replace Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SingleLineField
            id="find-replace-find"
            label="Find"
            value={findText}
            onChange={setFindText}
            placeholder="Search text..."
            maxLength={FIND_REPLACE_LIMITS.maxPatternCharacters}
            onClear={() => setFindText('')}
          />
          <SingleLineField
            id="find-replace-replace"
            label="Replace with"
            value={replaceText}
            onChange={setReplaceText}
            placeholder="Replacement..."
            onClear={() => setReplaceText('')}
          />
        </div>

        {/* Matches Status Line */}
        {matchSummary && (
          <div className="flex items-center gap-2 px-1 text-xs">
            <span
              className={`font-mono font-medium ${
                result && result.ok && result.matchCount > 0
                  ? 'text-emerald-400'
                  : 'text-[#8E9094]'
              }`}
            >
              {matchSummary}
            </span>
          </div>
        )}

        {/* Error Line */}
        {result && !result.ok && (
          <ErrorLine message={getErrorMessage(result.error)} />
        )}

        {/* Result Box with Copy */}
        <ResultBox
          title="Replaced Text"
          text={result && result.ok ? result.text : ''}
          emptyNotice="Replaced text will appear here..."
          onClear={() => {
            setText('');
            setFindText('');
            setReplaceText('');
          }}
        />

        {/* Options */}
        <OptionsDisclosure title="Options">
          <SwitchRow
            label="Match case"
            description="Distinguish between uppercase and lowercase letters"
            checked={caseSensitive}
            onChange={setCaseSensitive}
          />
          <SwitchRow
            label="Whole word"
            description="Only match whole words surrounded by word boundaries"
            checked={wholeWord}
            onChange={setWholeWord}
          />
          <div className="space-y-1">
            <SwitchRow
              label="Use a pattern"
              description="Treat the Find field as a regular expression pattern"
              checked={regex}
              onChange={setRegex}
            />
            {regex && (
              <p className="text-[11px] text-[#8E9094] pl-1 leading-normal italic">
                Use a pattern: supports standard JavaScript regular expression syntax.
              </p>
            )}
          </div>
          <SwitchRow
            label="Replace all"
            description="Replace every occurrence in the text instead of only the first"
            checked={replaceAll}
            onChange={setReplaceAll}
          />
        </OptionsDisclosure>
      </div>
    </ToolScreenShell>
  );
};

export default FindReplaceScreen;
