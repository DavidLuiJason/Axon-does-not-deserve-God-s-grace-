/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FileConverterScreen: Convert one file to another.
 * Inspects header bytes with detectConvertible, offers valid target formats,
 * provides kind-specific options in one quiet disclosure, runs the conversion,
 * shows text or picture results with before/after sizes and losses, and saves/shares.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  RotateCcw,
  Share2,
  Upload,
} from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  ErrorLine,
  NumberField,
  OptionsDisclosure,
  PrimaryButton,
  SegmentedChoice,
  SwitchRow,
  SingleLineField,
  copyToClipboard,
} from '../tools/ToolParts';
import {
  detectConvertible,
  targetsFor,
  planFileConversion,
  type Detection,
  type FilePlanError,
} from '../../tools/engines/files/fileConvertPlan';
import {
  formatBytes,
  runConversion,
  runImageConversion,
} from '../converter/runConversion';
import { saveFile, type SaveFileResult } from '../../services/saveFile';
import type { ImageOutputFormat } from '../../tools/engines/images/convertPlan';
import type { ToolScreenProps } from '../../tools/screens/registry';

export const toolScreen = { toolId: 'file-converter' };

type ConversionResult =
  | {
      mode: 'text';
      text: string;
      bytes: Uint8Array;
      outputName: string;
      outputMime: string;
      sizeBefore: number;
      sizeAfter: number;
      losses: string[];
    }
  | {
      mode: 'image';
      previewUrl: string;
      bytes: Uint8Array;
      outputName: string;
      outputMime: string;
      sizeBefore: number;
      sizeAfter: number;
      losses: string[];
    };

export default function FileConverterScreen({
  onBack,
  onLogoClick,
}: ToolScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selected file and detection
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [headBytes, setHeadBytes] = useState<Uint8Array | null>(null);
  const [detection, setDetection] = useState<Detection | FilePlanError | null>(
    null
  );

  // Target format
  const [target, setTarget] = useState<string>('');

  // Options
  const [detectTypes, setDetectTypes] = useState(false);
  const [jsonIndent, setJsonIndent] = useState<'2' | '4'>('2');
  const [xmlRootName, setXmlRootName] = useState('root');
  const [imageQuality, setImageQuality] = useState<number | string>(92);
  const [maxSide, setMaxSide] = useState<number | string>('');

  // Running state and results
  const [converting, setConverting] = useState(false);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [lastSaveResult, setLastSaveResult] = useState<SaveFileResult | null>(
    null
  );

  // Cleanup object URL on unmount or before new result
  useEffect(() => {
    return () => {
      if (result && result.mode === 'image' && result.previewUrl) {
        URL.revokeObjectURL(result.previewUrl);
      }
    };
  }, [result]);

  const availableTargets = useMemo(() => {
    if (!detection || !detection.ok || detection.family === 'unsupported') {
      return [];
    }
    return targetsFor(detection.kindId, detection.formatId);
  }, [detection]);

  // Handle file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    // Reset previous results
    if (result && result.mode === 'image' && result.previewUrl) {
      URL.revokeObjectURL(result.previewUrl);
    }
    setResult(null);
    setConversionError(null);
    setSaveStatus(null);
    setLastSaveResult(null);

    setSelectedFile(file);

    try {
      const slice = file.slice(0, 4096);
      const buffer = await slice.arrayBuffer();
      const head = new Uint8Array(buffer);
      setHeadBytes(head);

      const det = detectConvertible({
        name: file.name,
        size: file.size,
        head,
      });
      setDetection(det);

      if (det.ok && det.family !== 'unsupported') {
        const targets = targetsFor(det.kindId, det.formatId);
        setTarget(targets[0] || '');
      } else {
        setTarget('');
      }
    } catch (err: any) {
      setConversionError(err?.message || 'Failed to read file header.');
      setDetection(null);
    }
  };

  const handleChooseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleClear = () => {
    if (result && result.mode === 'image' && result.previewUrl) {
      URL.revokeObjectURL(result.previewUrl);
    }
    setSelectedFile(null);
    setHeadBytes(null);
    setDetection(null);
    setTarget('');
    setResult(null);
    setConversionError(null);
    setSaveStatus(null);
    setLastSaveResult(null);
  };

  const handleConvert = async () => {
    if (!selectedFile || !headBytes || !detection || !detection.ok || !target) {
      return;
    }

    setConverting(true);
    setConversionError(null);
    setSaveStatus(null);
    setLastSaveResult(null);

    // Clean up previous image preview URL if any
    if (result && result.mode === 'image' && result.previewUrl) {
      URL.revokeObjectURL(result.previewUrl);
      setResult(null);
    }

    try {
      if (detection.family === 'image') {
        const qualityNum =
          typeof imageQuality === 'number'
            ? imageQuality
            : parseFloat(String(imageQuality)) || 92;
        const qualityNormalized = Math.max(0.05, Math.min(1, qualityNum / 100));
        const maxSideNum =
          maxSide !== '' ? parseInt(String(maxSide), 10) : undefined;

        const imgRes = await runImageConversion(selectedFile, {
          name: selectedFile.name,
          toFormat: target as ImageOutputFormat,
          quality: qualityNormalized,
          maxSide: Number.isSafeInteger(maxSideNum) ? maxSideNum : undefined,
        });

        if (!imgRes.ok) {
          setConversionError(imgRes.message);
          setConverting(false);
          return;
        }

        const previewUrl = URL.createObjectURL(imgRes.blob);
        const plan = planFileConversion(
          { name: selectedFile.name, size: selectedFile.size, head: headBytes },
          target,
          { width: imgRes.width, height: imgRes.height }
        );

        const losses = plan.ok ? plan.losses : imgRes.warnings;

        setResult({
          mode: 'image',
          previewUrl,
          bytes: imgRes.bytes,
          outputName: imgRes.outputName,
          outputMime: imgRes.outputMime,
          sizeBefore: imgRes.sizeBefore,
          sizeAfter: imgRes.sizeAfter,
          losses,
        });
      } else {
        // Data or text conversion
        const textContent = await selectedFile.text();
        const outcome = runConversion({
          kind: detection.kindId,
          from: detection.formatId,
          to: target,
          input: textContent,
          options: {
            detectTypes,
            indent: jsonIndent === '4' ? 4 : 2,
            rootName: xmlRootName.trim() || 'root',
          },
        });

        if (!outcome.ok) {
          setConversionError(
            outcome.message ||
              `Conversion failed: ${outcome.error.replace(/-/g, ' ')}`
          );
          setConverting(false);
          return;
        }

        const plan = planFileConversion(
          { name: selectedFile.name, size: selectedFile.size, head: headBytes },
          target
        );

        const outputName = plan.ok
          ? plan.outputName
          : `${selectedFile.name.replace(/\.[^/.]+$/, '')}.${target}`;
        const outputMime = plan.ok
          ? plan.outputMime
          : 'text/plain;charset=utf-8';
        const losses = plan.ok
          ? plan.losses
          : outcome.changes || [
              'Formatting may differ between source and target formats.',
            ];

        const bytes = new TextEncoder().encode(outcome.value);

        setResult({
          mode: 'text',
          text: outcome.value,
          bytes,
          outputName,
          outputMime,
          sizeBefore: selectedFile.size,
          sizeAfter: bytes.byteLength,
          losses,
        });
      }
    } catch (err: any) {
      setConversionError(
        err?.message || 'An unexpected error occurred during conversion.'
      );
    } finally {
      setConverting(false);
    }
  };

  const handleCopyText = async () => {
    if (!result || result.mode !== 'text') return;
    const ok = await copyToClipboard(result.text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    try {
      const dataToSave =
        result.mode === 'text'
          ? result.text
          : new Blob([result.bytes as unknown as BlobPart], { type: result.outputMime });

      const saveRes = await saveFile(
        result.outputName,
        dataToSave,
        result.outputMime
      );
      setLastSaveResult(saveRes);
      if (saveRes.success) {
        setSaveStatus(saveRes.message || `Saved ${result.outputName}`);
      } else {
        setSaveStatus(`Save failed: ${saveRes.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setSaveStatus(`Save failed: ${err?.message || String(err)}`);
    }
  };

  const handleShare = async () => {
    if (!result) return;
    if (lastSaveResult?.canShare && lastSaveResult.share) {
      await lastSaveResult.share();
      return;
    }
    // Web Share API fallback
    if (navigator?.share) {
      try {
        const fileToShare = new File([result.bytes as unknown as BlobPart], result.outputName, {
          type: result.outputMime,
        });
        await navigator.share({
          title: result.outputName,
          files: [fileToShare],
        });
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.warn('Share error:', err);
        }
      }
    } else {
      setSaveStatus('Sharing is not supported on this browser.');
    }
  };

  // Determine quiet line for file info
  const quietFileInfo = useMemo(() => {
    if (!selectedFile || !detection) return null;
    if (!detection.ok) return detection.message;
    const formatLabel = detection.formatId
      ? detection.formatId.toUpperCase()
      : 'File';
    return `${formatLabel} file, ${formatBytes(selectedFile.size)}`;
  }, [selectedFile, detection]);

  const lossesLine = useMemo(() => {
    if (!result || result.losses.length === 0) return null;
    return result.losses[0];
  }, [result]);

  return (
    <ToolScreenShell
      toolName="File Converter"
      tagline="FILE CONVERTER"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      {/* Hidden native file input */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* 1. Choose a file row */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
          FILE
        </label>

        {!selectedFile ? (
          <button
            type="button"
            onClick={handleChooseClick}
            className="w-full min-h-[56px] border border-dashed border-white/20 hover:border-white/40 rounded-2xl p-4 flex items-center justify-center gap-3 bg-[#18191C] hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer text-[#D0D2D6]"
          >
            <Upload size={18} className="text-[#E85A3C]" />
            <span className="text-sm font-medium text-white">Choose a file</span>
          </button>
        ) : (
          <div className="p-3.5 bg-[#18191C] border border-white/10 rounded-2xl space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {detection && detection.ok && detection.family === 'image' ? (
                  <ImageIcon size={18} className="text-[#E85A3C] shrink-0" />
                ) : (
                  <FileText size={18} className="text-[#E85A3C] shrink-0" />
                )}
                <span className="text-sm font-medium text-white truncate">
                  {selectedFile.name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleChooseClick}
                  className="px-2.5 py-1 text-xs font-medium text-[#9A9B9F] hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-2.5 py-1 text-xs font-medium text-[#8E9094] hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Quiet info line from detectConvertible */}
            {quietFileInfo && (
              <p className="text-xs text-[#8E9094] leading-normal">
                {quietFileInfo}
              </p>
            )}

            {/* Disagreement warning */}
            {detection && detection.ok && detection.warnings.length > 0 && (
              <p className="text-xs text-[#E8A33C] leading-relaxed">
                {detection.warnings.join(' ')}
              </p>
            )}

            {/* Unsupported notice */}
            {detection &&
              detection.ok &&
              detection.family === 'unsupported' && (
                <p className="text-xs text-[#E0B4A8] leading-relaxed">
                  {detection.reason}
                </p>
              )}
            {detection && !detection.ok && (
              <p className="text-xs text-[#E0B4A8] leading-relaxed">
                {detection.message}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 2. Target "To" picker (lists only targetsFor) */}
      {selectedFile && detection && detection.ok && availableTargets.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
            TO
          </label>
          <div className="flex flex-wrap gap-1.5 p-1 bg-[#18191C] rounded-xl border border-white/5">
            {availableTargets.map((fmt) => {
              const isSelected = target === fmt;
              return (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setTarget(fmt)}
                  className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs font-medium uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center ${
                    isSelected
                      ? 'bg-white text-black font-semibold shadow-sm'
                      : 'text-[#9A9B9F] hover:text-white hover:bg-white/5'
                  }`}
                >
                  {fmt}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. ONE "Options" row (progressive disclosure) */}
      {selectedFile && detection && detection.ok && target && (
        <OptionsDisclosure title="Options">
          {detection.kindId === 'data-formats' && (
            <div className="space-y-3 pt-1">
              {(detection.formatId === 'csv' || detection.formatId === 'tsv') && (
                <SwitchRow
                  label="Detect numbers and booleans"
                  description="Convert numeric and boolean strings into typed values in tables."
                  checked={detectTypes}
                  onChange={setDetectTypes}
                />
              )}
              {(target === 'json' || target === 'yaml') && (
                <SegmentedChoice
                  label="Indentation"
                  choices={[
                    { id: '2', label: '2 spaces' },
                    { id: '4', label: '4 spaces' },
                  ]}
                  value={jsonIndent}
                  onChange={(v) => setJsonIndent(v as '2' | '4')}
                />
              )}
              {target === 'xml' && (
                <SingleLineField
                  label="XML Root Element Name"
                  value={xmlRootName}
                  onChange={setXmlRootName}
                  placeholder="root"
                />
              )}
            </div>
          )}

          {detection.kindId === 'image' && (
            <div className="space-y-3 pt-1">
              {(target === 'jpg' || target === 'webp') && (
                <NumberField
                  label="Quality (5 to 100%)"
                  value={imageQuality}
                  numeric="integer"
                  onChange={setImageQuality}
                  placeholder="92"
                  min={5}
                  max={100}
                />
              )}
              <NumberField
                label="Longest side (pixels, optional)"
                value={maxSide}
                numeric="integer"
                onChange={setMaxSide}
                placeholder="e.g. 1920 (max 16,384)"
                min={1}
                max={16384}
              />
            </div>
          )}

          {detection.kindId === 'text-formats' && (
            <p className="text-xs text-[#8E9094] leading-normal pt-1">
              Text conversion preserves plain text structure and encodes with UTF-8.
            </p>
          )}
        </OptionsDisclosure>
      )}

      {/* Convert action button */}
      {selectedFile && detection && detection.ok && availableTargets.length > 0 && (
        <div className="pt-1">
          <PrimaryButton
            onClick={handleConvert}
            disabled={converting || !target}
            className="w-full"
          >
            {converting ? 'Converting...' : 'Convert'}
          </PrimaryButton>
        </div>
      )}

      {/* Errors */}
      <ErrorLine message={conversionError} />

      {/* 4. Result display */}
      {result && (
        <div className="p-4 rounded-2xl bg-[#141517] border border-white/10 space-y-3.5">
          <div className="flex items-center justify-between text-xs text-[#8E9094]">
            <span className="font-semibold uppercase tracking-wider text-white">
              {result.outputName}
            </span>
            <span className="font-mono text-[11px]">
              {formatBytes(result.sizeBefore)} → {formatBytes(result.sizeAfter)}
            </span>
          </div>

          {/* Text Result */}
          {result.mode === 'text' && (
            <div className="space-y-2">
              <div className="relative">
                <div className="max-h-72 overflow-y-auto p-3.5 bg-[#18191C] border border-white/5 rounded-xl font-mono text-xs text-white whitespace-pre-wrap break-words leading-relaxed select-text">
                  {result.text.slice(0, 2000)}
                </div>
              </div>
              {result.text.length > 2000 && (
                <p className="text-[11px] text-[#7A7C82]">
                  Showing first 2,000 of {result.text.length.toLocaleString()} characters.
                </p>
              )}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="px-3.5 py-2 rounded-xl bg-white/5 text-[#D0D2D6] text-xs hover:bg-white/10 transition-colors flex items-center gap-1.5 cursor-pointer min-h-[40px]"
                >
                  {copied ? (
                    <>
                      <Check size={14} className="text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Picture Result */}
          {result.mode === 'image' && (
            <div className="space-y-2">
              <div className="flex justify-center bg-[#18191C] border border-white/5 rounded-xl p-3">
                <img
                  src={result.previewUrl}
                  alt={result.outputName}
                  className="max-h-64 object-contain rounded-lg"
                />
              </div>
            </div>
          )}

          {/* ONE quiet line from losses */}
          {lossesLine && (
            <p className="text-xs text-[#8E9094] italic leading-relaxed">
              {lossesLine}
            </p>
          )}

          {/* Save status notification */}
          {saveStatus && (
            <p className="text-xs text-white/80 leading-normal">{saveStatus}</p>
          )}

          {/* Actions: Save and Share */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
            <PrimaryButton
              onClick={handleSave}
              icon={<Download size={15} />}
              className="flex-1"
            >
              Save
            </PrimaryButton>
            <PrimaryButton
              variant="secondary"
              onClick={handleShare}
              icon={<Share2 size={15} />}
              className="flex-1"
            >
              Share
            </PrimaryButton>
          </div>
        </div>
      )}
    </ToolScreenShell>
  );
}
