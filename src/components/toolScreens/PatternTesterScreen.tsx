/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pattern Tester Screen: Test a pattern against your text.
 * Uses pure pattern engine in src/tools/engines/code/patternTest.ts.
 * Executes matching inside a Web Worker created from an inline Blob
 * and wrapped with runWithTimeout (1.5 seconds) to prevent UI freezing.
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  ErrorLine,
  LabelledTextArea,
  OptionsDisclosure,
  ResultBox,
  SingleLineField,
} from '../tools/ToolParts';
import {
  PATTERN_TEST_LIMITS,
  runWithTimeout,
  type PatternMatch,
  type PatternTestResult,
  type TimeoutRunner,
} from '../../tools/engines/code/patternTest';

export const toolScreen = { toolId: 'pattern-tester' };

export interface PatternTesterScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

const FLAG_DEFS: { flag: string; label: string; title: string }[] = [
  { flag: 'g', label: 'g', title: 'Global match (find all)' },
  { flag: 'i', label: 'i', title: 'Ignore case' },
  { flag: 'm', label: 'm', title: 'Multiline (^ and $ match line starts/ends)' },
  { flag: 's', label: 's', title: 'Dotall (. matches newline)' },
  { flag: 'u', label: 'u', title: 'Unicode (treat pattern as Unicode code points)' },
  { flag: 'y', label: 'y', title: 'Sticky (match only from lastIndex)' },
];

/**
 * Worker script code string. Executed safely in an isolated Web Worker.
 */
const WORKER_CODE = `
self.onmessage = function(e) {
  const { pattern, flags, text, replacement, limits } = e.data;
  try {
    const allowedFlags = new Set(['g', 'i', 'm', 's', 'u', 'y']);
    if ([...flags].some(f => !allowedFlags.has(f)) || new Set(flags).size !== flags.length) {
      self.postMessage({ ok: false, error: 'invalid-input', message: 'Flags must be unique characters from g, i, m, s, u and y.' });
      return;
    }
    const regex = new RegExp(pattern, flags);
    const matches = [];
    const enumerate = flags.includes('g') || flags.includes('y');
    while (true) {
      const match = regex.exec(text);
      if (!match) break;
      if (matches.length >= limits.matches) {
        self.postMessage({ ok: false, error: 'too-many-matches', message: 'More than ' + limits.matches + ' matches; narrow the pattern or text.' });
        return;
      }
      const named = {};
      if (match.groups) {
        for (const key of Object.keys(match.groups)) {
          named[key] = match.groups[key];
        }
      }
      matches.push({ index: match.index, text: match[0], groups: match.slice(1), namedGroups: named });
      if (!enumerate) break;
      if (match[0].length === 0) {
        const next = regex.lastIndex;
        if (next >= text.length) break;
        regex.lastIndex = next + (flags.includes('u') && /[\\uD800-\\uDBFF]/u.test(text[next]) && next + 1 < text.length && /[\\uDC00-\\uDFFF]/u.test(text[next + 1]) ? 2 : 1);
      }
    }
    let replacedText = null;
    if (replacement !== undefined && replacement !== '') {
      try {
        replacedText = text.replace(new RegExp(pattern, flags), replacement);
      } catch {
        self.postMessage({ ok: false, error: 'execution-failed', message: 'The replacement could not be completed.' });
        return;
      }
    }
    self.postMessage({
      ok: true,
      matches,
      replacedText,
      messages: matches.length ? ['Found ' + matches.length + (matches.length === 1 ? ' match.' : ' matches.')] : ['No matches found.']
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The pattern is invalid.';
    self.postMessage({ ok: false, error: 'invalid-input', message: 'Invalid regular expression: ' + message });
  }
};
`;

export const PatternTesterScreen: React.FC<PatternTesterScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [pattern, setPattern] = useState('\\w+');
  const [testText, setTestText] = useState('Axon builds tools for calm devices.');
  const [enabledFlags, setEnabledFlags] = useState<Set<string>>(new Set(['g']));
  const [replacement, setReplacement] = useState('');

  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [matches, setMatches] = useState<PatternMatch[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [replacedText, setReplacedText] = useState<string | null>(null);

  const activeWorkerRef = useRef<Worker | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);
  const runSequenceRef = useRef(0);
  const uniqueId = useId();

  const toggleFlag = (flag: string) => {
    setEnabledFlags((prev) => {
      const next = new Set(prev);
      if (next.has(flag)) {
        next.delete(flag);
      } else {
        next.add(flag);
      }
      return next;
    });
  };

  const flagsString = Array.from(enabledFlags).sort().join('');

  // Run matching in Web Worker whenever pattern, testText, flags, or replacement change
  useEffect(() => {
    const seq = ++runSequenceRef.current;

    // Terminate existing worker if still running
    if (activeWorkerRef.current) {
      activeWorkerRef.current.terminate();
      activeWorkerRef.current = null;
    }
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }

    if (!pattern) {
      setIsRunning(false);
      setErrorMessage(null);
      setMatches([]);
      setMessages([]);
      setReplacedText(null);
      return;
    }

    if (pattern.length > PATTERN_TEST_LIMITS.patternLength) {
      setIsRunning(false);
      setErrorMessage(`Pattern exceeds ${PATTERN_TEST_LIMITS.patternLength} characters.`);
      setMatches([]);
      setMessages([]);
      setReplacedText(null);
      return;
    }

    if (testText.length > PATTERN_TEST_LIMITS.textLength) {
      setIsRunning(false);
      setErrorMessage(`Text exceeds ${PATTERN_TEST_LIMITS.textLength} characters.`);
      setMatches([]);
      setMessages([]);
      setReplacedText(null);
      return;
    }

    if (
      replacement &&
      replacement.length > PATTERN_TEST_LIMITS.replacementLength
    ) {
      setIsRunning(false);
      setErrorMessage(
        `Replacement exceeds ${PATTERN_TEST_LIMITS.replacementLength} characters.`
      );
      setMatches([]);
      setMessages([]);
      setReplacedText(null);
      return;
    }

    setIsRunning(true);
    setErrorMessage(null);

    const runner: TimeoutRunner = async <T,>(
      taskFn: () => T | Promise<T>,
      timeoutMs: number
    ): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          if (activeWorkerRef.current) {
            activeWorkerRef.current.terminate();
            activeWorkerRef.current = null;
          }
          if (activeBlobUrlRef.current) {
            URL.revokeObjectURL(activeBlobUrlRef.current);
            activeBlobUrlRef.current = null;
          }
          reject(new Error('timeout'));
        }, timeoutMs);

        Promise.resolve()
          .then(() => taskFn())
          .then(
            (val) => {
              clearTimeout(timer);
              resolve(val);
            },
            (err) => {
              clearTimeout(timer);
              reject(err);
            }
          );
      });
    };

    const task = (): Promise<PatternTestResult> => {
      return new Promise((resolve, reject) => {
        try {
          const blob = new Blob([WORKER_CODE], {
            type: 'application/javascript',
          });
          const blobUrl = URL.createObjectURL(blob);
          activeBlobUrlRef.current = blobUrl;
          const worker = new Worker(blobUrl);
          activeWorkerRef.current = worker;

          worker.onmessage = (e: MessageEvent<PatternTestResult>) => {
            if (activeBlobUrlRef.current) {
              URL.revokeObjectURL(activeBlobUrlRef.current);
              activeBlobUrlRef.current = null;
            }
            activeWorkerRef.current = null;
            resolve(e.data);
          };

          worker.onerror = (err) => {
            if (activeBlobUrlRef.current) {
              URL.revokeObjectURL(activeBlobUrlRef.current);
              activeBlobUrlRef.current = null;
            }
            activeWorkerRef.current = null;
            reject(err);
          };

          worker.postMessage({
            pattern,
            flags: flagsString,
            text: testText,
            replacement: replacement || undefined,
            limits: PATTERN_TEST_LIMITS,
          });
        } catch (err) {
          reject(err);
        }
      });
    };

    runWithTimeout(task, 1500, runner).then((res) => {
      if (seq !== runSequenceRef.current) return;
      setIsRunning(false);

      if (!res.ok) {
        if (res.error === 'timeout') {
          setErrorMessage(
            'This pattern took too long; it may backtrack badly.'
          );
        } else {
          setErrorMessage('Execution failed.');
        }
        setMatches([]);
        setMessages([]);
        setReplacedText(null);
        return;
      }

      const outcome = res.value;
      if (!outcome.ok) {
        setErrorMessage(outcome.message);
        setMatches([]);
        setMessages([]);
        setReplacedText(null);
      } else {
        setErrorMessage(null);
        setMatches(outcome.matches);
        setMessages(outcome.messages);
        setReplacedText(outcome.replacedText);
      }
    });

    return () => {
      if (activeWorkerRef.current) {
        activeWorkerRef.current.terminate();
        activeWorkerRef.current = null;
      }
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
    };
  }, [pattern, testText, flagsString, replacement]);

  // Build highlighted pieces of testText for display
  const renderHighlightedText = () => {
    if (!testText) {
      return <span className="text-[#8E9094] italic">Empty text</span>;
    }
    if (matches.length === 0) {
      return <span>{testText}</span>;
    }

    const segments: React.ReactNode[] = [];
    let lastIndex = 0;

    // Filter and sort matches by index
    const sorted = [...matches].sort((a, b) => a.index - b.index);

    sorted.forEach((m, idx) => {
      const start = m.index;
      const end = m.index + m.text.length;

      // Add unmatched text before this match
      if (start > lastIndex) {
        segments.push(
          <span key={`plain-${idx}-${lastIndex}`}>
            {testText.slice(lastIndex, start)}
          </span>
        );
      }

      if (start >= lastIndex) {
        if (m.text.length === 0) {
          // Zero-width match
          segments.push(
            <span
              key={`match-zero-${idx}`}
              title={`Zero-width match at index ${m.index}`}
              className="inline-block w-1.5 h-4 bg-[#E85A3C] rounded-sm mx-0.5 align-middle opacity-80"
            />
          );
        } else {
          segments.push(
            <mark
              key={`match-${idx}`}
              className="bg-[#E85A3C]/30 text-white rounded px-0.5 border border-[#E85A3C]/40"
              title={`Match ${idx + 1} at index ${m.index}`}
            >
              {m.text}
            </mark>
          );
        }
        lastIndex = Math.max(lastIndex, end);
      }
    });

    if (lastIndex < testText.length) {
      segments.push(
        <span key={`plain-tail-${lastIndex}`}>
          {testText.slice(lastIndex)}
        </span>
      );
    }

    return segments;
  };

  return (
    <ToolScreenShell
      toolName="Pattern Tester"
      tagline="Test a pattern against your text"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-5">
        {/* Pattern Input and Flags */}
        <div className="space-y-3">
          <SingleLineField
            id={`${uniqueId}-pattern`}
            label="Pattern"
            value={pattern}
            onChange={setPattern}
            placeholder="e.g. (?<word>\w+)-(\d+)"
            maxLength={PATTERN_TEST_LIMITS.patternLength}
          />

          {/* Flags in one row */}
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
              Flags
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {FLAG_DEFS.map(({ flag, label, title }) => {
                const isSelected = enabledFlags.has(flag);
                return (
                  <button
                    key={flag}
                    type="button"
                    onClick={() => toggleFlag(flag)}
                    title={title}
                    className={`min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center ${
                      isSelected
                        ? 'bg-white text-black shadow-sm'
                        : 'bg-[#1C1D21] text-[#9A9B9F] hover:text-white hover:bg-white/10 border border-white/10'
                    }`}
                    aria-pressed={isSelected}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Test Text Area */}
        <LabelledTextArea
          id={`${uniqueId}-test-text`}
          label="Test text"
          value={testText}
          onChange={setTestText}
          placeholder="Enter the text to test against the pattern..."
          rows={5}
          maxLength={PATTERN_TEST_LIMITS.textLength}
        />

        {/* Quiet line: JavaScript flavour */}
        <p className="text-[11px] text-[#8E9094] -mt-2">
          JavaScript flavour.
        </p>

        {/* Options (Replace with) */}
        <OptionsDisclosure title="Options">
          <div className="space-y-3 pt-1">
            <SingleLineField
              id={`${uniqueId}-replace`}
              label="Replace with"
              value={replacement}
              onChange={setReplacement}
              placeholder="e.g. $<word>! or [REDACTED]"
              maxLength={PATTERN_TEST_LIMITS.replacementLength}
            />

            {replacement && replacedText !== null && (
              <div className="pt-1">
                <span className="block text-xs font-semibold uppercase tracking-wider text-[#8E9094] mb-1.5">
                  Replacement result
                </span>
                <ResultBox
                  title="Replacement result"
                  text={replacedText}
                />
              </div>
            )}
          </div>
        </OptionsDisclosure>

        {/* Error message */}
        {errorMessage && <ErrorLine message={errorMessage} />}

        {/* Match Count / Status */}
        {!errorMessage && pattern && (
          <div className="space-y-4">
            {/* Status summary */}
            <div className="flex items-center justify-between text-xs text-[#8E9094]">
              <span>
                {isRunning
                  ? 'Testing pattern...'
                  : messages.length > 0
                  ? messages[0]
                  : `${matches.length} match${matches.length === 1 ? '' : 'es'}`}
              </span>
              <span className="font-mono text-[11px]">
                Flags: /{flagsString || '-'}/
              </span>
            </div>

            {/* Highlighted text preview */}
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
                Matched text
              </span>
              <div className="p-4 bg-[#18191C] border border-white/10 rounded-2xl text-xs font-mono leading-relaxed whitespace-pre-wrap break-all text-[#D0D2D6] max-h-64 overflow-y-auto">
                {renderHighlightedText()}
              </div>
            </div>

            {/* List of matches */}
            {matches.length > 0 && (
              <div className="space-y-2">
                <span className="block text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
                  Matches ({matches.length})
                </span>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {matches.map((m, idx) => {
                    const namedKeys = Object.keys(m.namedGroups);
                    return (
                      <div
                        key={idx}
                        className="p-3.5 bg-[#18191C] border border-white/10 rounded-xl space-y-2 text-xs font-mono"
                      >
                        <div className="flex items-center justify-between text-[#8E9094]">
                          <span className="font-semibold text-white">
                            Match {idx + 1}
                          </span>
                          <span>
                            Index [{m.index}..{m.index + m.text.length}]
                          </span>
                        </div>

                        <div className="p-2 bg-black/40 rounded-lg text-white break-all">
                          {m.text === '' ? (
                            <span className="text-[#8E9094] italic font-sans text-[11px]">
                              Zero-width match
                            </span>
                          ) : (
                            m.text
                          )}
                        </div>

                        {/* Numbered Groups */}
                        {m.groups.length > 0 && (
                          <div className="pt-1 space-y-1 text-[11px]">
                            <span className="text-[#8E9094] block font-sans font-medium">
                              Groups:
                            </span>
                            <div className="space-y-1 pl-2 border-l border-white/10">
                              {m.groups.map((groupVal, gIdx) => (
                                <div key={gIdx} className="text-[#D0D2D6]">
                                  <span className="text-[#8E9094]">
                                    Group {gIdx + 1}:{' '}
                                  </span>
                                  {groupVal === undefined ? (
                                    <span className="text-[#8E9094] italic">
                                      undefined
                                    </span>
                                  ) : (
                                    `"${groupVal}"`
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Named Groups */}
                        {namedKeys.length > 0 && (
                          <div className="pt-1 space-y-1 text-[11px]">
                            <span className="text-[#8E9094] block font-sans font-medium">
                              Named groups:
                            </span>
                            <div className="space-y-1 pl-2 border-l border-white/10">
                              {namedKeys.map((k) => (
                                <div key={k} className="text-[#D0D2D6]">
                                  <span className="text-[#E85A3C] font-semibold">
                                    {k}:{' '}
                                  </span>
                                  {m.namedGroups[k] === undefined ? (
                                    <span className="text-[#8E9094] italic">
                                      undefined
                                    </span>
                                  ) : (
                                    `"${m.namedGroups[k]}"`
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {!pattern && (
          <div className="p-4 bg-[#18191C]/50 border border-white/5 rounded-2xl text-xs text-[#8E9094] italic text-center">
            Enter a pattern and test text above to see matches.
          </div>
        )}
      </div>
    </ToolScreenShell>
  );
};

export default PatternTesterScreen;
