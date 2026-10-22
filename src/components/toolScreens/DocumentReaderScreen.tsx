/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Document Reader Screen: Read text, Markdown, HTML, CSV, TSV, and JSON documents.
 * Uses the pure documentRead engine in src/tools/engines/files/documentRead.ts.
 */

import React, { useId, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import { ErrorLine } from '../tools/ToolParts';
import {
  findInDocument,
  paginate,
  readDocument,
  type DocumentBlock,
  type DocumentModel,
  type FindOptions,
} from '../../tools/engines/files/documentRead';

export const toolScreen = { toolId: 'document-reader' };

export interface DocumentReaderScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

type TextSizeStep = 0 | 1 | 2; // 0 = Small, 1 = Normal, 2 = Large

const CHARS_PER_PAGE = 3500;

export const DocumentReaderScreen: React.FC<DocumentReaderScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [model, setModel] = useState<DocumentModel | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [textSize, setTextSize] = useState<TextSizeStep>(1);
  const [showContents, setShowContents] = useState(false);
  const [showFind, setShowFind] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeHitIndex, setActiveHitIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputId = useId();

  const handleOpenClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const res = readDocument({ name: file.name, bytes });

      if (!res.ok) {
        setErrorMessage(res.message);
        setModel(null);
        return;
      }

      setModel(res);
      setErrorMessage(null);
      setCurrentPageIndex(0);
      setSearchQuery('');
      setActiveHitIndex(0);
      setShowContents(false);
    } catch {
      setErrorMessage('Could not open the selected file.');
      setModel(null);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Compute pagination using the pure engine
  const paginationResult = useMemo(() => {
    if (!model) return null;
    const res = paginate(model, CHARS_PER_PAGE);
    return res.ok ? res.pages : [];
  }, [model]);

  const totalPages = paginationResult ? Math.max(1, paginationResult.length) : 1;
  const currentPage = paginationResult?.[currentPageIndex];

  // Current page blocks
  const pageBlocks = useMemo(() => {
    if (!model || !currentPage) return [];
    return model.blocks.slice(currentPage.fromBlock, currentPage.toBlock);
  }, [model, currentPage]);

  // Compute search hits across the entire document
  const searchResult = useMemo(() => {
    if (!model || !searchQuery.trim()) return [];
    const res = findInDocument(model, searchQuery.trim(), {
      caseSensitive: false,
      wholeWord: false,
    });
    return res.ok ? res.hits : [];
  }, [model, searchQuery]);

  const totalHits = searchResult.length;

  // Jump to a specific hit and ensure its page is visible
  const jumpToHit = (index: number) => {
    if (totalHits === 0 || !paginationResult) return;
    const normalizedIndex = (index + totalHits) % totalHits;
    setActiveHitIndex(normalizedIndex);

    const hit = searchResult[normalizedIndex];
    const targetPageIndex = paginationResult.findIndex(
      (p) => hit.blockIndex >= p.fromBlock && hit.blockIndex < p.toBlock
    );
    if (targetPageIndex >= 0 && targetPageIndex !== currentPageIndex) {
      setCurrentPageIndex(targetPageIndex);
    }
  };

  const handleSearchNext = () => {
    jumpToHit(activeHitIndex + 1);
  };

  const handleSearchPrev = () => {
    jumpToHit(activeHitIndex - 1);
  };

  // Handle jump from contents outline
  const handleOutlineJump = (blockIndex: number) => {
    if (!paginationResult) return;
    const targetPageIndex = paginationResult.findIndex(
      (p) => blockIndex >= p.fromBlock && blockIndex < p.toBlock
    );
    if (targetPageIndex >= 0) {
      setCurrentPageIndex(targetPageIndex);
    }
  };

  // Text size classes
  const textSizeClasses = useMemo(() => {
    switch (textSize) {
      case 0:
        return {
          body: 'text-xs',
          h1: 'text-lg',
          h2: 'text-base',
          h3: 'text-sm',
          h4: 'text-xs',
          code: 'text-[11px]',
          table: 'text-[11px]',
        };
      case 2:
        return {
          body: 'text-base',
          h1: 'text-2xl',
          h2: 'text-xl',
          h3: 'text-lg',
          h4: 'text-base',
          code: 'text-sm',
          table: 'text-xs',
        };
      case 1:
      default:
        return {
          body: 'text-sm',
          h1: 'text-xl',
          h2: 'text-lg',
          h3: 'text-base',
          h4: 'text-sm',
          code: 'text-xs',
          table: 'text-xs',
        };
    }
  }, [textSize]);

  // Render text with highlight marks if hits exist
  const renderHighlightedText = (text: string, globalBlockIndex: number) => {
    if (totalHits === 0 || !searchQuery.trim()) {
      return text;
    }

    const blockHits = searchResult
      .map((hit, hitIdx) => ({ ...hit, hitIdx }))
      .filter((hit) => hit.blockIndex === globalBlockIndex);

    if (blockHits.length === 0) {
      return text;
    }

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    for (const hit of blockHits) {
      if (hit.start > lastIndex) {
        elements.push(text.slice(lastIndex, hit.start));
      }
      const isActive = hit.hitIdx === activeHitIndex;
      elements.push(
        <mark
          key={`${hit.start}-${hit.end}`}
          className={`px-0.5 rounded ${
            isActive
              ? 'bg-[#E85A3C] text-white font-semibold'
              : 'bg-[#E85A3C]/35 text-white'
          }`}
        >
          {text.slice(hit.start, hit.end)}
        </mark>
      );
      lastIndex = hit.end;
    }

    if (lastIndex < text.length) {
      elements.push(text.slice(lastIndex));
    }

    return elements;
  };

  // Render a block cleanly and safely as text
  const renderBlock = (
    block: DocumentBlock,
    localIndex: number,
    globalBlockIndex: number
  ) => {
    switch (block.kind) {
      case 'heading': {
        const level = block.level ?? 1;
        let headingClass = textSizeClasses.h1;
        if (level === 2) headingClass = textSizeClasses.h2;
        else if (level === 3) headingClass = textSizeClasses.h3;
        else if (level >= 4) headingClass = textSizeClasses.h4;

        return (
          <h2
            key={localIndex}
            className={`font-semibold text-white tracking-tight mt-4 mb-2 ${headingClass}`}
          >
            {renderHighlightedText(block.text, globalBlockIndex)}
          </h2>
        );
      }
      case 'list-item':
        return (
          <div
            key={localIndex}
            className={`flex items-start gap-2.5 my-1.5 pl-1 text-[#ECECEC] leading-relaxed ${textSizeClasses.body}`}
          >
            <span className="text-[#E85A3C] select-none shrink-0 font-bold leading-none mt-1">
              •
            </span>
            <div className="flex-1">
              {renderHighlightedText(block.text, globalBlockIndex)}
            </div>
          </div>
        );
      case 'quote':
        return (
          <blockquote
            key={localIndex}
            className={`border-l-2 border-[#E85A3C]/80 pl-3.5 py-1 my-2.5 italic text-[#D1D2D6] bg-white/[0.02] rounded-r-lg leading-relaxed ${textSizeClasses.body}`}
          >
            {renderHighlightedText(block.text, globalBlockIndex)}
          </blockquote>
        );
      case 'code':
        return (
          <pre
            key={localIndex}
            className={`font-mono bg-[#18191C] border border-white/5 p-3.5 rounded-xl overflow-x-auto whitespace-pre text-[#ECECEC] my-2 leading-relaxed ${textSizeClasses.code}`}
          >
            <code>{renderHighlightedText(block.text, globalBlockIndex)}</code>
          </pre>
        );
      case 'table-row': {
        // Table row with tab-separated cells
        const cells = block.text.split('\t');
        return (
          <div
            key={localIndex}
            className={`flex border-b border-white/5 py-1.5 px-2 ${
              block.header ? 'bg-white/10 font-semibold text-white' : 'text-[#D1D2D6]'
            } ${textSizeClasses.table}`}
          >
            {cells.map((cell, cIdx) => (
              <div
                key={cIdx}
                className="flex-1 min-w-[100px] px-2 truncate leading-normal"
              >
                {renderHighlightedText(cell, globalBlockIndex)}
              </div>
            ))}
          </div>
        );
      }
      case 'paragraph':
      default:
        return (
          <p
            key={localIndex}
            className={`text-[#ECECEC] leading-relaxed my-2 whitespace-pre-wrap select-text ${textSizeClasses.body}`}
          >
            {renderHighlightedText(block.text, globalBlockIndex)}
          </p>
        );
    }
  };

  return (
    <ToolScreenShell
      toolName="Document Reader"
      tagline="Turns supported text documents into bounded readable blocks"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-4">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.text,.md,.markdown,.html,.htm,.csv,.tsv,.json,.pdf,.docx,.xlsx,.pptx"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Open document file"
        />

        {/* Top bar controls: Open a file, Text size, Find toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={handleOpenClick}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white text-black hover:bg-[#F0F0F0] text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"
          >
            <Upload size={16} />
            <span>Open a file</span>
          </button>

          {model && (
            <div className="flex items-center gap-1.5">
              {/* Find toggle */}
              <button
                type="button"
                onClick={() => setShowFind(!showFind)}
                aria-label="Find in document"
                className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl border border-white/5 transition-colors cursor-pointer flex items-center justify-center ${
                  showFind
                    ? 'bg-[#E85A3C]/20 text-[#E85A3C] border-[#E85A3C]/40'
                    : 'bg-white/5 text-[#9A9B9F] hover:text-white hover:bg-white/10'
                }`}
                title="Find in document"
              >
                <Search size={16} />
              </button>

              {/* Text size controls: A- and A+ (three steps) */}
              <div className="flex items-center bg-[#18191C] border border-white/5 rounded-xl p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setTextSize((s) => (s > 0 ? ((s - 1) as TextSizeStep) : s))}
                  disabled={textSize === 0}
                  className="min-h-[36px] min-w-[36px] px-2 rounded-lg text-xs font-semibold text-[#ECECEC] hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Smaller text"
                >
                  A-
                </button>
                <span className="text-[10px] text-[#8E9094] px-1 font-mono select-none">
                  {textSize === 0 ? 'Small' : textSize === 1 ? 'Normal' : 'Large'}
                </span>
                <button
                  type="button"
                  onClick={() => setTextSize((s) => (s < 2 ? ((s + 1) as TextSizeStep) : s))}
                  disabled={textSize === 2}
                  className="min-h-[36px] min-w-[36px] px-2 rounded-lg text-xs font-semibold text-[#ECECEC] hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Larger text"
                >
                  A+
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error message */}
        <ErrorLine message={errorMessage} />

        {/* Find Search Bar */}
        {model && showFind && (
          <div className="p-3 bg-[#18191C] border border-white/10 rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 flex items-center">
                <Search size={14} className="absolute left-3 text-[#8E9094]" />
                <input
                  id={searchInputId}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setActiveHitIndex(0);
                  }}
                  placeholder="Find in document..."
                  maxLength={200}
                  className="w-full min-h-[40px] pl-8 pr-8 bg-[#121315] border border-white/10 rounded-lg text-xs text-white placeholder-[#686A70] focus:outline-none focus:border-[#E85A3C]"
                />
                {searchQuery.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setActiveHitIndex(0);
                    }}
                    className="absolute right-2.5 text-[#8E9094] hover:text-white p-0.5 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleSearchPrev}
                  disabled={totalHits === 0}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-[#ECECEC] transition-colors cursor-pointer"
                  title="Previous match"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleSearchNext}
                  disabled={totalHits === 0}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-[#ECECEC] transition-colors cursor-pointer"
                  title="Next match"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs px-1 text-[#8E9094]">
              <span>
                {searchQuery.trim()
                  ? totalHits > 0
                    ? `Hit ${activeHitIndex + 1} of ${totalHits}`
                    : 'No matches found'
                  : 'Type a word or phrase to find'}
              </span>
            </div>
          </div>
        )}

        {/* When a document is loaded */}
        {model && (
          <div className="space-y-3">
            {/* The file name, format, encoding and stats in one quiet line */}
            <p className="text-xs text-[#8E9094] leading-normal truncate py-0.5">
              <span className="text-[#ECECEC] font-medium">{model.name}</span>
              {' • '}
              <span>{model.format.toUpperCase()}</span>
              {' • '}
              <span>{model.encoding}</span>
              {' • '}
              <span>
                {model.stats.words.toLocaleString()} words, about{' '}
                {model.stats.readingMinutes} minute
                {model.stats.readingMinutes === 1 ? '' : 's'}
              </span>
            </p>

            {/* Truncated documents say so in one line */}
            {model.truncated && (
              <p className="text-xs text-[#E0B4A8] bg-[#231A19] border border-[#E85A3C]/30 px-3 py-2 rounded-xl">
                The document has too many blocks; only the first 20,000 are shown.
              </p>
            )}

            {/* Any engine warnings in plain words */}
            {model.warnings.length > 0 &&
              model.warnings
                .filter((w) => !w.includes('first 20,000 are shown'))
                .map((warning, idx) => (
                  <p
                    key={idx}
                    className="text-xs text-[#D1D2D6] bg-white/[0.03] border border-white/5 px-3 py-1.5 rounded-xl"
                  >
                    {warning}
                  </p>
                ))}

            {/* Contents outline (collapsed) */}
            {model.outline.length > 0 && (
              <div className="border border-white/5 bg-[#161719] rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowContents(!showContents)}
                  className="w-full min-h-[44px] px-4 py-2.5 flex items-center justify-between text-left hover:bg-white/5 transition-colors cursor-pointer"
                  aria-expanded={showContents}
                >
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#9A9B9F]">
                    Contents ({model.outline.length})
                  </span>
                  <div className="text-[#9A9B9F]">
                    {showContents ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </div>
                </button>
                {showContents && (
                  <div className="p-2 border-t border-white/5 max-h-60 overflow-y-auto space-y-1">
                    {model.outline.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          handleOutlineJump(item.blockIndex);
                          setShowContents(false);
                        }}
                        style={{ paddingLeft: `${(item.level - 1) * 14 + 10}px` }}
                        className="w-full text-left py-1.5 pr-3 text-xs text-[#D1D2D6] hover:text-white hover:bg-white/5 rounded-lg transition-colors truncate cursor-pointer flex items-center justify-between"
                      >
                        <span className="truncate">{item.text}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Reading View Container */}
            <div className="min-h-[240px] bg-[#161719] border border-white/10 rounded-2xl p-5 select-text">
              {model.blocks.length === 0 ? (
                <p className="text-xs text-[#686A70] italic">
                  This document contains no readable text.
                </p>
              ) : (
                <div
                  className={
                    model.format === 'csv' || model.format === 'tsv'
                      ? 'overflow-x-auto'
                      : 'space-y-1'
                  }
                >
                  {pageBlocks.map((block, localIdx) => {
                    const globalBlockIndex = (currentPage?.fromBlock ?? 0) + localIdx;
                    return renderBlock(block, localIdx, globalBlockIndex);
                  })}
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between py-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setCurrentPageIndex((p) => Math.max(0, p - 1))}
                  disabled={currentPageIndex === 0}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium text-[#ECECEC] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ChevronLeft size={16} />
                  <span>Previous</span>
                </button>

                <span className="text-xs text-[#8E9094] font-medium select-none">
                  Page {currentPageIndex + 1} of {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPageIndex((p) => Math.min(totalPages - 1, p + 1))
                  }
                  disabled={currentPageIndex >= totalPages - 1}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium text-[#ECECEC] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Empty state when no file opened */}
        {!model && !errorMessage && (
          <div className="py-16 text-center text-xs text-[#8E9094] flex flex-col items-center justify-center space-y-2 border border-dashed border-white/10 rounded-2xl bg-[#161719]/50 p-6">
            <FileText size={32} className="text-[#686A70] mb-1" />
            <p className="text-sm font-medium text-[#D1D2D6]">No document open</p>
            <p className="text-xs text-[#8E9094] max-w-sm">
              Open a text, Markdown, HTML, CSV, TSV, or JSON file to begin reading.
            </p>
          </div>
        )}
      </div>
    </ToolScreenShell>
  );
};

export default DocumentReaderScreen;
