/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * File Compare Screen: Find out if two files are the same.
 * Uses pure fileCompare engine in src/tools/engines/files/fileCompare.ts.
 */

import React, { useId, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Upload,
  X,
} from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  ErrorLine,
  NumberField,
  OptionsDisclosure,
  SegmentedChoice,
  SwitchRow,
} from '../tools/ToolParts';
import {
  compareStreams,
  compareText,
  comparePixels,
  hexContext,
  overlay,
  FILE_COMPARE_LIMITS,
  type ByteCompareResult,
  type ByteRange,
  type HexRow,
  type TextCompareExtended,
  type PixelCompareResult,
  type PixelImage,
  type Reader,
} from '../../tools/engines/files/fileCompare';
import { describeSize } from '../../tools/engines/files/inspect';

export const toolScreen = { toolId: 'file-compare' };

export interface FileCompareScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

type ViewMode = 'bytes' | 'text' | 'picture';

function isTextFile(f: File): boolean {
  if (f.type.startsWith('text/')) return true;
  return /\.(txt|md|csv|json|xml|html|js|jsx|ts|tsx|css|yaml|yml|sh|py|c|cpp|h|rs|go|sql)$/i.test(f.name);
}

function isImageFile(f: File): boolean {
  if (f.type.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp|ico)$/i.test(f.name);
}

export const FileCompareScreen: React.FC<FileCompareScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);

  // Options
  const [stopAtFirst, setStopAtFirst] = useState(false);
  const [tolerance, setTolerance] = useState('0');

  // Comparison State
  const [isComparing, setIsComparing] = useState(false);
  const [progress, setProgress] = useState<{ compared: number; total: number } | null>(null);
  const cancelRequestedRef = useRef(false);

  // Results
  const [byteResult, setByteResult] = useState<ByteCompareResult | null>(null);
  const [textResult, setTextResult] = useState<TextCompareExtended | null>(null);
  const [pixelResult, setPixelResult] = useState<PixelCompareResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // View mode switcher
  const [viewMode, setViewMode] = useState<ViewMode>('bytes');
  const [showAllRanges, setShowAllRanges] = useState(false);
  const [selectedHexRange, setSelectedHexRange] = useState<ByteRange | null>(null);
  const [hexRows, setHexRows] = useState<HexRow[] | null>(null);

  const fileInputARef = useRef<HTMLInputElement | null>(null);
  const fileInputBRef = useRef<HTMLInputElement | null>(null);
  const diffCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const uniqueId = useId();

  const bothAreText = Boolean(fileA && fileB && isTextFile(fileA) && isTextFile(fileB));
  const bothArePictures = Boolean(fileA && fileB && isImageFile(fileA) && isImageFile(fileB));

  const availableViewModes = useMemo(() => {
    const list: { id: ViewMode; label: string }[] = [{ id: 'bytes', label: 'Bytes' }];
    if (bothAreText) list.push({ id: 'text', label: 'Text' });
    if (bothArePictures) list.push({ id: 'picture', label: 'Picture' });
    return list;
  }, [bothAreText, bothArePictures]);

  const handleSelectFileA = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFileA(f);
      resetResults();
    }
    e.target.value = '';
  };

  const handleSelectFileB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFileB(f);
      resetResults();
    }
    e.target.value = '';
  };

  const resetResults = () => {
    setByteResult(null);
    setTextResult(null);
    setPixelResult(null);
    setErrorMessage(null);
    setProgress(null);
    setSelectedHexRange(null);
    setHexRows(null);
  };

  const handleCancel = () => {
    cancelRequestedRef.current = true;
  };

  // Helper to load an image into PixelImage
  const loadPixelImage = async (file: File): Promise<PixelImage> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        resolve({
          width: canvas.width,
          height: canvas.height,
          data: imgData.data,
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Could not decode picture ${file.name}.`));
      };
      img.src = url;
    });
  };

  // Main Compare Runner
  const handleCompare = async () => {
    if (!fileA || !fileB) return;
    setIsComparing(true);
    resetResults();
    cancelRequestedRef.current = false;

    // 1. Run stream byte compare
    const readerA: Reader = {
      size: fileA.size,
      async read(offset, length) {
        const slice = fileA.slice(offset, offset + length);
        return new Uint8Array(await slice.arrayBuffer());
      },
    };

    const readerB: Reader = {
      size: fileB.size,
      async read(offset, length) {
        const slice = fileB.slice(offset, offset + length);
        return new Uint8Array(await slice.arrayBuffer());
      },
    };

    try {
      const bRes = await compareStreams(readerA, readerB, {
        chunkSize: 65536,
        stopAtFirst,
        shouldCancel: () => cancelRequestedRef.current,
        onProgress: (comp, tot) => setProgress({ compared: comp, total: tot }),
      });

      if (!bRes.ok) {
        setErrorMessage(bRes.message);
        setIsComparing(false);
        return;
      }

      setByteResult(bRes);

      // 2. If both are text, run compareText
      if (bothAreText) {
        try {
          const [tA, tB] = await Promise.all([fileA.text(), fileB.text()]);
          const txtRes = compareText(tA, tB);
          if (txtRes.ok) {
            setTextResult(txtRes);
          }
        } catch {
          // ignore text decode failure, byte diff stands
        }
      }

      // 3. If both are pictures, run comparePixels
      if (bothArePictures) {
        try {
          const [imA, imB] = await Promise.all([loadPixelImage(fileA), loadPixelImage(fileB)]);
          const numTol = parseInt(tolerance, 10);
          const pRes = comparePixels(imA, imB, {
            tolerance: Number.isNaN(numTol) ? 0 : numTol,
          });

          if (pRes.ok) {
            setPixelResult(pRes);
            // Render diff preview on canvas
            setTimeout(() => {
              if (diffCanvasRef.current && pRes.diffMask) {
                const w = Math.max(imA.width, imB.width);
                const h = Math.max(imA.height, imB.height);
                diffCanvasRef.current.width = w;
                diffCanvasRef.current.height = h;
                const ctx = diffCanvasRef.current.getContext('2d');
                if (ctx) {
                  const over = overlay(imA, pRes.diffMask);
                  if (over instanceof Uint8ClampedArray) {
                    const idata = new ImageData(over, w, h);
                    ctx.putImageData(idata, 0, 0);
                  }
                }
              }
            }, 50);
          } else {
            setErrorMessage(pRes.message);
          }
        } catch (err: any) {
          setErrorMessage(err.message || 'Could not decode images for pixel comparison.');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Comparison failed.');
    } finally {
      setIsComparing(false);
    }
  };

  // Inspect Hex Context when tapping a range
  const handleRangeClick = async (range: ByteRange) => {
    if (!fileA || !fileB) return;
    if (selectedHexRange?.start === range.start) {
      setSelectedHexRange(null);
      setHexRows(null);
      return;
    }

    setSelectedHexRange(range);
    const startOffset = Math.max(0, range.start - 16);
    const readLen = range.length + 32;
    const [sliceA, sliceB] = await Promise.all([
      fileA.slice(startOffset, startOffset + readLen).arrayBuffer(),
      fileB.slice(startOffset, startOffset + readLen).arrayBuffer(),
    ]);

    const rows = hexContext(
      new Uint8Array(sliceA),
      new Uint8Array(sliceB),
      range.start - startOffset,
      range.length,
      16
    );

    if (Array.isArray(rows)) {
      setHexRows(rows.map(r => ({ ...r, offset: r.offset + startOffset })));
    }
  };

  return (
    <ToolScreenShell
      toolName="File Compare"
      tagline="Find out if two files are the same"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-5">
        <p className="text-xs text-[#8E9094] italic">Files stay on your phone.</p>

        {/* Two File Selection Slots */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Slot A */}
          <div className="p-3.5 bg-[#18191C] border border-white/10 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-[#8E9094]">
                File A
              </span>
              {fileA && (
                <button
                  type="button"
                  onClick={() => {
                    setFileA(null);
                    resetResults();
                  }}
                  className="text-[#8E9094] hover:text-white p-1 cursor-pointer"
                  aria-label="Clear File A"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <input
              ref={fileInputARef}
              type="file"
              onChange={handleSelectFileA}
              className="hidden"
              id={`${uniqueId}-file-a`}
            />

            {fileA ? (
              <div
                onClick={() => fileInputARef.current?.click()}
                className="p-3 bg-[#1C1D21] border border-white/10 rounded-xl cursor-pointer hover:bg-white/5 transition-colors space-y-1"
              >
                <div className="text-xs font-mono font-medium text-white truncate">
                  {fileA.name}
                </div>
                <div className="text-[11px] text-[#8E9094]">
                  {describeSize(fileA.size)}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputARef.current?.click()}
                className="w-full min-h-[52px] border border-dashed border-white/20 rounded-xl flex items-center justify-center gap-2 text-xs text-[#8E9094] hover:text-white hover:border-white/40 transition-colors cursor-pointer"
              >
                <Upload size={16} />
                <span>Choose File A</span>
              </button>
            )}
          </div>

          {/* Slot B */}
          <div className="p-3.5 bg-[#18191C] border border-white/10 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-[#8E9094]">
                File B
              </span>
              {fileB && (
                <button
                  type="button"
                  onClick={() => {
                    setFileB(null);
                    resetResults();
                  }}
                  className="text-[#8E9094] hover:text-white p-1 cursor-pointer"
                  aria-label="Clear File B"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <input
              ref={fileInputBRef}
              type="file"
              onChange={handleSelectFileB}
              className="hidden"
              id={`${uniqueId}-file-b`}
            />

            {fileB ? (
              <div
                onClick={() => fileInputBRef.current?.click()}
                className="p-3 bg-[#1C1D21] border border-white/10 rounded-xl cursor-pointer hover:bg-white/5 transition-colors space-y-1"
              >
                <div className="text-xs font-mono font-medium text-white truncate">
                  {fileB.name}
                </div>
                <div className="text-[11px] text-[#8E9094]">
                  {describeSize(fileB.size)}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputBRef.current?.click()}
                className="w-full min-h-[52px] border border-dashed border-white/20 rounded-xl flex items-center justify-center gap-2 text-xs text-[#8E9094] hover:text-white hover:border-white/40 transition-colors cursor-pointer"
              >
                <Upload size={16} />
                <span>Choose File B</span>
              </button>
            )}
          </div>
        </div>

        {/* Options Row */}
        <OptionsDisclosure title="Options">
          <div className="space-y-4 pt-1">
            <SwitchRow
              label="Just tell me if they are the same"
              description="Stops comparing as soon as the first difference is found"
              checked={stopAtFirst}
              onChange={setStopAtFirst}
            />

            {bothArePictures && (
              <NumberField
                id={`${uniqueId}-tolerance`}
                label="Pixel color tolerance (0 to 255)"
                value={tolerance}
                numeric="integer"
                onChange={setTolerance}
                min={0}
                max={255}
                placeholder="0"
              />
            )}
          </div>
        </OptionsDisclosure>

        {/* Compare Action Button & Progress */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleCompare}
            disabled={!fileA || !fileB || isComparing}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-[#F0F0F0] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
          >
            <span>Compare</span>
          </button>

          {isComparing && (
            <div className="p-3.5 bg-[#18191C] border border-white/10 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-[#8E9094]">
                <span>Comparing files...</span>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="text-xs text-red-400 hover:underline cursor-pointer font-semibold"
                >
                  Cancel
                </button>
              </div>

              {progress && (
                <div className="space-y-1">
                  <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[#E85A3C] h-1.5 transition-all duration-200"
                      style={{
                        width: `${Math.min(100, Math.round((progress.compared / Math.max(1, progress.total)) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="text-[11px] font-mono text-[#8E9094] text-right">
                    {Math.round((progress.compared / Math.max(1, progress.total)) * 100)}%
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {errorMessage && <ErrorLine message={errorMessage} />}

        {/* Comparison Result Section */}
        {byteResult && (
          <div className="space-y-4 pt-1">
            {/* Top Headline Result */}
            <div
              className={`p-5 rounded-2xl border flex items-center gap-3.5 ${
                byteResult.identical
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
              }`}
            >
              {byteResult.identical ? (
                <CheckCircle2 size={24} className="shrink-0" />
              ) : (
                <AlertCircle size={24} className="shrink-0" />
              )}
              <div className="font-semibold text-lg tracking-tight">
                {byteResult.identical
                  ? 'The files are identical'
                  : 'The files are different'}
              </div>
            </div>

            {/* Mode Switcher when text or picture is available */}
            {availableViewModes.length > 1 && (
              <SegmentedChoice<ViewMode>
                choices={availableViewModes}
                value={viewMode}
                onChange={setViewMode}
              />
            )}

            {/* 1. Bytes View */}
            {viewMode === 'bytes' && (
              <div className="space-y-3">
                {/* Stats details */}
                <div className="bg-[#18191C] border border-white/10 rounded-2xl divide-y divide-white/5 overflow-hidden text-xs">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-[#8E9094]">File A size</span>
                    <span className="font-mono text-white">
                      {describeSize(byteResult.sizeA)}
                    </span>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-[#8E9094]">File B size</span>
                    <span className="font-mono text-white">
                      {describeSize(byteResult.sizeB)}
                    </span>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-[#8E9094]">Differing bytes</span>
                    <span className="font-mono text-white font-medium">
                      {byteResult.differingBytes.toLocaleString()} ({byteResult.percent.toFixed(2)}%)
                    </span>
                  </div>
                  {byteResult.firstDifference !== null && (
                    <div className="px-4 py-3 flex items-center justify-between">
                      <span className="text-[#8E9094]">First difference</span>
                      <span className="font-mono text-white">
                        byte {byteResult.firstDifference.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* List of differing ranges */}
                {!byteResult.identical && byteResult.ranges.length > 0 && (
                  <div className="space-y-2">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
                      Differing ranges ({byteResult.ranges.length.toLocaleString()})
                    </span>

                    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                      {(showAllRanges
                        ? byteResult.ranges
                        : byteResult.ranges.slice(0, 20)
                      ).map((range, idx) => {
                        const isSelected = selectedHexRange?.start === range.start;
                        return (
                          <div key={idx} className="space-y-1">
                            <button
                              type="button"
                              onClick={() => handleRangeClick(range)}
                              className={`w-full text-left p-2.5 rounded-xl border font-mono text-xs transition-colors flex items-center justify-between cursor-pointer ${
                                isSelected
                                  ? 'bg-white/10 border-white/20 text-white'
                                  : 'bg-[#18191C] border-white/5 text-[#D0D2D6] hover:bg-white/[0.04]'
                              }`}
                            >
                              <span>
                                bytes {range.start.toLocaleString()} to {range.end.toLocaleString()} ({range.length} {range.length === 1 ? 'byte' : 'bytes'})
                              </span>
                              <div className="text-[#8E9094]">
                                {isSelected ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </div>
                            </button>

                            {/* Expanded Side-by-side Hex View */}
                            {isSelected && hexRows && (
                              <div className="p-3 bg-[#141518] border border-white/10 rounded-xl space-y-2 text-[11px] font-mono overflow-x-auto">
                                <div className="text-[10px] text-[#8E9094] uppercase tracking-wider flex justify-between">
                                  <span>Offset</span>
                                  <span>File A vs File B</span>
                                </div>
                                <div className="space-y-1">
                                  {hexRows.map((row) => (
                                    <div key={row.offset} className="flex gap-3 leading-tight">
                                      <span className="text-[#8E9094] select-none">
                                        {row.offset.toString(16).padStart(6, '0')}:
                                      </span>
                                      <div className="flex gap-1">
                                        {row.hexA.map((h, i) => (
                                          <span
                                            key={i}
                                            className={
                                              row.different[i]
                                                ? 'text-red-400 font-bold bg-red-500/10 rounded px-0.5'
                                                : 'text-[#ECECEC]'
                                            }
                                          >
                                            {h}
                                          </span>
                                        ))}
                                      </div>
                                      <span className="text-white/20">|</span>
                                      <div className="flex gap-1">
                                        {row.hexB.map((h, i) => (
                                          <span
                                            key={i}
                                            className={
                                              row.different[i]
                                                ? 'text-emerald-400 font-bold bg-emerald-500/10 rounded px-0.5'
                                                : 'text-[#ECECEC]'
                                            }
                                          >
                                            {h}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {byteResult.ranges.length > 20 && (
                      <button
                        type="button"
                        onClick={() => setShowAllRanges(!showAllRanges)}
                        className="text-xs text-[#E85A3C] hover:underline cursor-pointer font-medium pt-1"
                      >
                        {showAllRanges
                          ? 'Show first 20 ranges'
                          : `Show all (${byteResult.ranges.length} ranges)`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 2. Text View */}
            {viewMode === 'text' && textResult && (
              <div className="space-y-3">
                <div className="p-3.5 bg-[#18191C] border border-white/10 rounded-2xl flex items-center justify-around text-xs">
                  <div className="text-center">
                    <span className="text-[#8E9094] block">Added (+)</span>
                    <span className="font-mono text-emerald-400 font-semibold text-sm">
                      +{textResult.addedLines}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-[#8E9094] block">Removed (-)</span>
                    <span className="font-mono text-red-400 font-semibold text-sm">
                      -{textResult.removedLines}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-[#8E9094] block">Changed (~)</span>
                    <span className="font-mono text-amber-300 font-semibold text-sm">
                      ~{textResult.changedLines}
                    </span>
                  </div>
                </div>

                {textResult.differences.length > 0 ? (
                  <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                    {textResult.differences.map((diff, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl border text-xs font-mono leading-relaxed space-y-1 ${
                          diff.type === 'add'
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : diff.type === 'remove'
                            ? 'bg-red-500/5 border-red-500/20'
                            : 'bg-amber-500/5 border-amber-500/20'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] text-[#8E9094]">
                          <span className="capitalize font-semibold">
                            {diff.type === 'add'
                              ? '+ Line ' + diff.positionB.line
                              : diff.type === 'remove'
                              ? '- Line ' + diff.positionA.line
                              : `~ Line ${diff.positionA.line} → ${diff.positionB.line}`}
                          </span>
                        </div>
                        {diff.textA && (
                          <div className="text-red-400 break-all line-through opacity-80">
                            - {diff.textA}
                          </div>
                        )}
                        {diff.textB && (
                          <div className="text-emerald-400 break-all">
                            + {diff.textB}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-[#18191C] border border-white/10 rounded-2xl text-xs text-[#8E9094] text-center italic">
                    No text differences found.
                  </div>
                )}
              </div>
            )}

            {/* 3. Picture View */}
            {viewMode === 'picture' && pixelResult && (
              <div className="space-y-3">
                <div className="bg-[#18191C] border border-white/10 rounded-2xl divide-y divide-white/5 overflow-hidden text-xs">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-[#8E9094]">Dimensions</span>
                    <span className="font-mono text-white">
                      {pixelResult.dimensionsMatch
                        ? `${pixelResult.sizeA.width} × ${pixelResult.sizeA.height} (Match)`
                        : `A: ${pixelResult.sizeA.width}×${pixelResult.sizeA.height} vs B: ${pixelResult.sizeB.width}×${pixelResult.sizeB.height}`}
                    </span>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-[#8E9094]">Differing pixels</span>
                    <span className="font-mono text-white font-medium">
                      {pixelResult.differingPixels.toLocaleString()}
                    </span>
                  </div>
                  {pixelResult.boundingBox && (
                    <div className="px-4 py-3 flex items-center justify-between">
                      <span className="text-[#8E9094]">Bounding box</span>
                      <span className="font-mono text-white">
                        [{pixelResult.boundingBox.x}, {pixelResult.boundingBox.y}] {pixelResult.boundingBox.width}×{pixelResult.boundingBox.height}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
                    Difference preview
                  </span>
                  <div className="p-3 bg-[#18191C] border border-white/10 rounded-2xl flex items-center justify-center overflow-auto max-h-80">
                    <canvas ref={diffCanvasRef} className="max-w-full rounded shadow" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!byteResult && !isComparing && (
          <div className="p-4 bg-[#18191C]/50 border border-white/5 rounded-2xl text-xs text-[#8E9094] italic text-center">
            Choose two files above and tap Compare to check differences.
          </div>
        )}
      </div>
    </ToolScreenShell>
  );
};

export default FileCompareScreen;
