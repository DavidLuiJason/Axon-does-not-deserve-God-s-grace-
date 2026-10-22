/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Summarizer Screen: Shorten a text by extracting key sentences.
 * Uses the pure extractive summarize engine in src/tools/engines/text/summarize.ts
 * and decodes imported text files with src/tools/engines/files/documentRead.ts.
 */

import React, { useId, useMemo, useRef, useState } from 'react';
import { Copy, Check, Upload, Sparkles } from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  copyToClipboard,
  ErrorLine,
  LabelledTextArea,
  OptionsDisclosure,
  PrimaryButton,
  SegmentedChoice,
  SwitchRow,
} from '../tools/ToolParts';
import {
  summarizeText,
  SUMMARIZE_LIMITS,
  type SummarizeResult,
} from '../../tools/engines/text/summarize';
import { readDocument } from '../../tools/engines/files/documentRead';

export const toolScreen = { toolId: 'summarizer' };

export interface SummarizerScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

type SummaryLength = 'short' | 'medium' | 'long';

const LENGTH_CHOICES = [
  { id: 'short', label: 'Short (3)' },
  { id: 'medium', label: 'Medium (5)' },
  { id: 'long', label: 'Long (8)' },
] as const;

const SENTENCE_COUNTS: Record<SummaryLength, number> = {
  short: 3,
  medium: 5,
  long: 8,
};

export const SummarizerScreen: React.FC<SummarizerScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [inputText, setInputText] = useState('');
  const [lengthChoice, setLengthChoice] = useState<SummaryLength>('medium');
  const [showKeywords, setShowKeywords] = useState(false);
  const [keepCodeBlocks, setKeepCodeBlocks] = useState(false);
  const [result, setResult] = useState<SummarizeResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fileNotice, setFileNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const doc = readDocument({ name: file.name, bytes });

      if (!doc.ok) {
        setErrorMessage(doc.message);
        setFileNotice(null);
        return;
      }

      const plainText = doc.blocks.map((b) => b.text).join('\n\n');
      if (!plainText.trim()) {
        setErrorMessage('The chosen file contains no readable text.');
        setFileNotice(null);
        return;
      }

      setInputText(plainText);
      setErrorMessage(null);
      setResult(null);
      setFileNotice(
        `Loaded "${file.name}" (${doc.format.toUpperCase()}, ${doc.stats.words.toLocaleString()} words)`
      );
    } catch {
      setErrorMessage('Could not read the chosen file.');
      setFileNotice(null);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const runSummarize = (
    text: string,
    length: SummaryLength,
    keepCode: boolean
  ) => {
    setErrorMessage(null);
    setFileNotice(null);

    if (!text.trim()) {
      setErrorMessage('Enter text to summarize.');
      setResult(null);
      return;
    }

    if (text.length > SUMMARIZE_LIMITS.maxCharacters) {
      setErrorMessage(
        `Text exceeds the ${SUMMARIZE_LIMITS.maxCharacters.toLocaleString()} character limit.`
      );
      setResult(null);
      return;
    }

    const sentences = SENTENCE_COUNTS[length];
    const res = summarizeText(text, {
      sentences,
      keywords: 12,
      code: keepCode ? 'keep' : 'skip',
    });

    if (!res.ok) {
      setErrorMessage(res.message);
      setResult(null);
      return;
    }

    setResult(res);
  };

  const handleSummarize = () => {
    runSummarize(inputText, lengthChoice, keepCodeBlocks);
  };

  const handleLengthChange = (val: SummaryLength) => {
    setLengthChoice(val);
    if (result && result.ok && inputText.trim()) {
      runSummarize(inputText, val, keepCodeBlocks);
    }
  };

  const handleKeywordsChange = (val: boolean) => {
    setShowKeywords(val);
    if (result && result.ok && inputText.trim()) {
      runSummarize(inputText, lengthChoice, keepCodeBlocks);
    }
  };

  const handleKeepCodeBlocksChange = (val: boolean) => {
    setKeepCodeBlocks(val);
    if (result && result.ok && inputText.trim()) {
      runSummarize(inputText, lengthChoice, val);
    }
  };

  const handleCopy = async () => {
    if (!result || !result.ok || !result.text) return;
    const ok = await copyToClipboard(result.text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClearAll = () => {
    setInputText('');
    setResult(null);
    setErrorMessage(null);
    setFileNotice(null);
  };

  const isOnlyCode =
    Boolean(result && result.ok && result.stats.sentencesIn === 0 && result.codeBlocks > 0);

  const contentSegments = useMemo(() => {
    if (!result || !result.ok) return [];
    if (!keepCodeBlocks || !result.sentences.some((s) => s.codeBlock)) {
      return [{ isCode: false, text: result.text }];
    }

    const segments: Array<{ isCode: boolean; text: string }> = [];
    let currentProse: string[] = [];
    let lastPara: number | undefined;

    for (const s of result.sentences) {
      if (s.codeBlock) {
        if (currentProse.length > 0) {
          segments.push({ isCode: false, text: currentProse.join('') });
          currentProse = [];
          lastPara = undefined;
        }
        segments.push({ isCode: true, text: s.text });
      } else {
        if (lastPara !== undefined) {
          currentProse.push(s.paragraph !== lastPara ? '\n' : ' ');
        }
        currentProse.push(s.text);
        lastPara = s.paragraph;
      }
    }
    if (currentProse.length > 0) {
      segments.push({ isCode: false, text: currentProse.join('') });
    }
    return segments;
  }, [result, keepCodeBlocks]);

  return (
    <ToolScreenShell
      toolName="Summarizer"
      tagline="Selects important original sentences without rewriting them"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-4">
        {/* Hidden file input for opening text files */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.text,.md,.markdown,.html,.htm,.log"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Upload text file"
        />

        {/* Input Text Area and File Upload Action */}
        <div className="space-y-2">
          <LabelledTextArea
            id={inputId}
            label="Original Text"
            value={inputText}
            onChange={(val) => {
              setInputText(val);
              if (errorMessage) setErrorMessage(null);
              if (!val.trim()) setResult(null);
            }}
            placeholder="Paste text here or choose a text file below..."
            rows={7}
            maxLength={SUMMARIZE_LIMITS.maxCharacters}
            onClear={handleClearAll}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <button
              type="button"
              onClick={handleFileClick}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-[#ECECEC] transition-colors cursor-pointer flex items-center gap-2 border border-white/5"
            >
              <Upload size={14} className="text-[#8E9094]" />
              <span>Choose a text file</span>
            </button>

            {fileNotice && (
              <span className="text-xs text-[#8E9094] truncate max-w-xs pl-1">
                {fileNotice}
              </span>
            )}
          </div>
        </div>

        {/* Summary Length Controls */}
        <SegmentedChoice<SummaryLength>
          label="Summary length"
          choices={LENGTH_CHOICES}
          value={lengthChoice}
          onChange={handleLengthChange}
        />

        {/* Options Row (Progressive Disclosure) */}
        <OptionsDisclosure title="Options">
          {/* 1. Show key words */}
          <SwitchRow
            label="Show key words"
            description="Display extracted vocabulary terms ranked by significance"
            checked={showKeywords}
            onChange={handleKeywordsChange}
          />

          {/* 2. Topic coverage quiet line */}
          {result &&
            result.ok &&
            typeof result.keywordCoverage === 'number' &&
            Number.isFinite(result.keywordCoverage) && (
              <div className="text-xs text-[#8E9094] py-1 pl-1">
                Topic coverage: {Math.round(result.keywordCoverage * 100)}%
              </div>
            )}

          {/* 3. Keep code blocks switch */}
          <SwitchRow
            label="Keep code blocks"
            description="Include code blocks in the summary without altering them"
            checked={keepCodeBlocks}
            onChange={handleKeepCodeBlocksChange}
          />

          {/* Sentences kept count */}
          <div className="pt-1 text-xs text-[#8E9094] flex items-center justify-between border-t border-white/5">
            <span>Sentences kept</span>
            <span className="font-mono text-white">
              {result && result.ok
                ? `${result.stats.sentencesOut} of ${result.stats.sentencesIn}`
                : 'Available after summarizing'}
            </span>
          </div>
        </OptionsDisclosure>

        {/* Primary Action Button */}
        <PrimaryButton
          onClick={handleSummarize}
          disabled={!inputText.trim()}
          className="w-full"
          icon={<Sparkles size={16} />}
        >
          Summarize
        </PrimaryButton>

        {/* Error message */}
        <ErrorLine message={errorMessage} />

        {/* Results Presentation */}
        {result && result.ok && (
          <>
            {isOnlyCode ? (
              <div className="space-y-2 pt-2">
                <p className="text-xs text-[#8E9094] italic leading-normal pl-0.5">
                  Nothing to summarise: the text is only code.
                </p>
                {result.warnings.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {result.warnings.map((warning, idx) => (
                      <p
                        key={idx}
                        className="text-xs text-[#E0B4A8] leading-normal pl-0.5 break-words"
                      >
                        {warning}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-[#8E9094]">
                    Extracted Sentences
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#9A9B9F] hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check size={13} className="text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Result text box: show exact engine text; code blocks in monospace if kept */}
                <div className="min-h-[64px] w-full bg-[#18191C] border border-white/10 rounded-xl p-4 text-sm text-[#ECECEC] leading-relaxed select-text break-words">
                  {contentSegments.map((segment, idx) =>
                    segment.isCode ? (
                      <pre
                        key={idx}
                        className="font-mono text-xs whitespace-pre-wrap break-words select-text my-2 p-3 rounded-lg bg-black/40 border border-white/10 overflow-x-auto text-[#ECECEC]"
                      >
                        {segment.text}
                      </pre>
                    ) : (
                      <div
                        key={idx}
                        className="font-sans whitespace-pre-wrap leading-relaxed select-text break-words"
                      >
                        {segment.text}
                      </div>
                    )
                  )}
                </div>

                {/* COUNT LINE: directly under the result */}
                <p className="text-xs text-[#8E9094] leading-normal pl-0.5 break-words">
                  {result.stats.charactersOut.toLocaleString()} of{' '}
                  {result.stats.charactersIn.toLocaleString()} characters
                </p>

                {/* Quiet engine label line */}
                <p className="text-xs text-[#8E9094] italic leading-normal pl-0.5 break-words">
                  {result.label}
                </p>

                {/* Any engine warnings in plain words */}
                {result.warnings.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {result.warnings.map((warning, idx) => (
                      <p
                        key={idx}
                        className="text-xs text-[#E0B4A8] leading-normal pl-0.5 break-words"
                      >
                        {warning}
                      </p>
                    ))}
                  </div>
                )}

                {/* Key words (when toggled on in options) */}
                {showKeywords && result.keywords.length > 0 && (
                  <div className="p-3.5 bg-[#161719] border border-white/5 rounded-xl space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8E9094]">
                      Key Words
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {result.keywords.map((kw, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2.5 py-1 bg-white/5 border border-white/5 rounded-lg text-[#D1D2D6]"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </ToolScreenShell>
  );
};

export default SummarizerScreen;
