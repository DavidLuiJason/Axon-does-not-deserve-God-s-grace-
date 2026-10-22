/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Text Compare Screen: See what changed between two texts.
 * Uses the pure textCompare engine in src/tools/engines/text/textCompare.ts.
 */

import React, { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  copyToClipboard,
  ErrorLine,
  LabelledTextArea,
  SegmentedChoice,
} from '../tools/ToolParts';
import {
  textCompare,
  TEXT_COMPARE_LIMITS,
  type TextCompareMode,
  type TextDiffPart,
} from '../../tools/engines/text/textCompare';

export const toolScreen = { toolId: 'text-compare' };

export interface TextCompareScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

const COMPARE_MODES: { id: TextCompareMode; label: string }[] = [
  { id: 'line', label: 'Line by line' },
  { id: 'word', label: 'Word by word' },
];

export const TextCompareScreen: React.FC<TextCompareScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [original, setOriginal] = useState('');
  const [changed, setChanged] = useState('');
  const [mode, setMode] = useState<TextCompareMode>('line');
  const [copied, setCopied] = useState(false);

  // Execute comparison
  const result = useMemo(() => {
    if (!original && !changed) return null;
    return textCompare(original, changed, mode);
  }, [original, changed, mode]);

  const areIdentical = useMemo(() => {
    if (!original && !changed) return false;
    if (original === changed) return true;
    if (result && result.ok && result.counts.add === 0 && result.counts.remove === 0) {
      return true;
    }
    return false;
  }, [original, changed, result]);

  const getErrorMessage = (error: string) => {
    switch (error) {
      case 'too-large':
        return `Texts exceed size limit: max ${TEXT_COMPARE_LIMITS.maxCharacters.toLocaleString()} combined characters or ${TEXT_COMPARE_LIMITS.maxLines.toLocaleString()} lines.`;
      case 'invalid-mode':
        return `Invalid compare mode: ${mode}.`;
      case 'invalid-input':
        return 'Invalid comparison input.';
      default:
        return `Compare error: ${error}`;
    }
  };

  const handleCopyUnified = async () => {
    if (!result || !result.ok) return;
    const lines = result.differences.map((part) => {
      const prefix = part.type === 'add' ? '+ ' : part.type === 'remove' ? '- ' : '  ';
      return part.text
        .split('\n')
        .map((l) => (l ? prefix + l : prefix))
        .join('\n');
    });
    const ok = await copyToClipboard(lines.join('\n'));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <ToolScreenShell
      toolName="Text Compare"
      tagline="See what changed between two texts"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-4">
        {/* Two input text areas: Original and Changed */}
        <div className="space-y-3">
          <LabelledTextArea
            id="text-compare-original"
            label="Original"
            value={original}
            onChange={setOriginal}
            placeholder="Paste original text..."
            rows={4}
            maxLength={TEXT_COMPARE_LIMITS.maxCharacters}
            onClear={() => setOriginal('')}
          />
          <LabelledTextArea
            id="text-compare-changed"
            label="Changed"
            value={changed}
            onChange={setChanged}
            placeholder="Paste changed text to compare..."
            rows={4}
            maxLength={TEXT_COMPARE_LIMITS.maxCharacters}
            onClear={() => setChanged('')}
          />
        </div>

        {/* Mode selection row */}
        <SegmentedChoice<TextCompareMode>
          label="Comparison Mode"
          choices={COMPARE_MODES}
          value={mode}
          onChange={setMode}
        />

        {/* Error Line */}
        {result && !result.ok && (
          <ErrorLine message={getErrorMessage(result.error)} />
        )}

        {/* Result Area */}
        {result && result.ok && (
          <div className="space-y-2 pt-1">
            {/* Summary Line */}
            <div className="flex items-center justify-between text-xs px-1">
              <div className="font-semibold uppercase tracking-wider text-[#8E9094]">
                Differences
              </div>
              <div className="flex items-center gap-3">
                {areIdentical ? (
                  <span className="font-mono text-emerald-400 font-medium">
                    The texts are the same
                  </span>
                ) : (
                  <span className="font-mono text-xs text-[#9A9B9F]">
                    <span className="text-emerald-400 font-medium">
                      +{result.counts.add} added
                    </span>
                    {', '}
                    <span className="text-[#E85A3C] font-medium">
                      -{result.counts.remove} removed
                    </span>
                  </span>
                )}
                {!areIdentical && (
                  <button
                    type="button"
                    onClick={handleCopyUnified}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-[#9A9B9F] hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                    title="Copy diff"
                  >
                    {copied ? (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Differences Container */}
            {areIdentical ? (
              <div className="p-4 bg-[#18191C] border border-white/10 rounded-xl text-center text-sm text-[#ECECEC]">
                The texts are the same
              </div>
            ) : (
              <div className="p-3 bg-[#18191C] border border-white/10 rounded-xl font-mono text-xs leading-relaxed space-y-1 break-words overflow-x-hidden">
                {mode === 'line' ? (
                  result.differences.map((part: TextDiffPart, idx: number) => {
                    const isAdd = part.type === 'add';
                    const isRemove = part.type === 'remove';
                    const symbol = isAdd ? '+' : isRemove ? '-' : ' ';

                    return (
                      <div
                        key={idx}
                        className={`flex items-start gap-2 px-2 py-1 rounded break-words whitespace-pre-wrap ${
                          isAdd
                            ? 'text-emerald-400 bg-emerald-950/25 border-l-2 border-emerald-500'
                            : isRemove
                            ? 'text-[#E85A3C] bg-[#E85A3C]/10 border-l-2 border-[#E85A3C]'
                            : 'text-[#9A9B9F]'
                        }`}
                      >
                        <span className="font-bold select-none shrink-0 w-3">
                          {symbol}
                        </span>
                        <span className="flex-1 break-words">
                          {part.text || '\n'}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 py-1 leading-relaxed">
                    {result.differences.map((part: TextDiffPart, idx: number) => {
                      const isAdd = part.type === 'add';
                      const isRemove = part.type === 'remove';

                      if (isAdd) {
                        return (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-emerald-400 bg-emerald-950/30 border border-emerald-800/40"
                          >
                            <span className="font-bold select-none text-[10px]">+</span>
                            <span>{part.text}</span>
                          </span>
                        );
                      }
                      if (isRemove) {
                        return (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[#E85A3C] bg-[#E85A3C]/10 border border-[#E85A3C]/20 line-through opacity-85"
                          >
                            <span className="font-bold select-none text-[10px]">-</span>
                            <span>{part.text}</span>
                          </span>
                        );
                      }
                      return (
                        <span key={idx} className="text-[#ECECEC] whitespace-pre-wrap">
                          {part.text}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!result && (
          <div className="p-4 bg-[#18191C]/50 border border-white/5 rounded-2xl text-xs text-[#8E9094] italic text-center">
            Enter original and changed text above to view differences.
          </div>
        )}
      </div>
    </ToolScreenShell>
  );
};

export default TextCompareScreen;
