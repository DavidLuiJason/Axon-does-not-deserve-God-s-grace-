/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * BatchConvertScreen: Convert multiple files to a single target format.
 * Inspects all files, plans with planBatch, runs one file at a time with createBatchRun,
 * yields between items to prevent UI freeze, handles memory caps by draining held outputs,
 * displays progress, results list, and packages results into a ZIP archive for saving/sharing.
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileStack,
  Share2,
  Upload,
  XCircle,
} from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  ErrorLine,
  PrimaryButton,
} from '../tools/ToolParts';
import {
  planBatch,
  createBatchRun,
  zipEntries,
  type BatchPlan,
  type BatchRun,
  type BatchSnapshot,
  type BatchReportRow,
  type BatchItem,
  type BatchOutput,
} from '../../tools/engines/files/batchPlan';
import {
  detectConvertible,
  type ConvertibleFile,
} from '../../tools/engines/files/fileConvertPlan';
import {
  formatBytes,
  runConversion,
  runImageConversion,
} from '../converter/runConversion';
import { createZip } from '../../tools/engines/files/zipTool';
import { saveFile, type SaveFileResult } from '../../services/saveFile';
import type { ImageOutputFormat } from '../../tools/engines/images/convertPlan';
import type { ToolScreenProps } from '../../tools/screens/registry';

export const toolScreen = { toolId: 'batch-convert' };

const POPULAR_TARGETS = [
  { id: 'webp', label: 'WebP', group: 'Images' },
  { id: 'jpg', label: 'JPG', group: 'Images' },
  { id: 'png', label: 'PNG', group: 'Images' },
  { id: 'json', label: 'JSON', group: 'Data' },
  { id: 'csv', label: 'CSV', group: 'Data' },
  { id: 'tsv', label: 'TSV', group: 'Data' },
  { id: 'yaml', label: 'YAML', group: 'Data' },
  { id: 'xml', label: 'XML', group: 'Data' },
  { id: 'txt', label: 'TXT', group: 'Text' },
  { id: 'md', label: 'Markdown', group: 'Text' },
  { id: 'html', label: 'HTML', group: 'Text' },
] as const;

export default function BatchConvertScreen({
  onBack,
  onLogoClick,
}: ToolScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Files state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [convertibleFiles, setConvertibleFiles] = useState<ConvertibleFile[]>([]);
  const [fileMap, setFileMap] = useState<Map<string, File>>(new Map());

  // Target format
  const [target, setTarget] = useState<string>('webp');

  // UI disclosures
  const [showSeeWhy, setShowSeeWhy] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Execution state
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [snapshot, setSnapshot] = useState<BatchSnapshot | null>(null);
  const [reportRows, setReportRows] = useState<BatchReportRow[]>([]);
  const [accumulatedOutputs, setAccumulatedOutputs] = useState<BatchOutput[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Save / Share state
  const [savingZip, setSavingZip] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [lastSaveResult, setLastSaveResult] = useState<SaveFileResult | null>(null);

  // Cancellation ref to break loop
  const cancelRequestedRef = useRef(false);

  // Handle files chosen from disk
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    setSelectedFiles(files);
    setFinished(false);
    setSnapshot(null);
    setReportRows([]);
    setAccumulatedOutputs([]);
    setErrorMsg(null);
    setSaveStatus(null);
    setLastSaveResult(null);

    const map = new Map<string, File>();
    for (const f of files) {
      map.set(f.name, f);
    }
    setFileMap(map);

    try {
      const convList: ConvertibleFile[] = await Promise.all(
        files.map(async (f) => {
          const slice = f.slice(0, 4096);
          const buffer = await slice.arrayBuffer();
          return {
            name: f.name,
            size: f.size,
            head: new Uint8Array(buffer),
          };
        })
      );
      setConvertibleFiles(convList);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to read file headers.');
      setConvertibleFiles([]);
    }
  };

  const handleChooseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleClear = () => {
    setSelectedFiles([]);
    setConvertibleFiles([]);
    setFileMap(new Map());
    setFinished(false);
    setSnapshot(null);
    setReportRows([]);
    setAccumulatedOutputs([]);
    setErrorMsg(null);
    setSaveStatus(null);
    setLastSaveResult(null);
    setShowSeeWhy(false);
    setShowResults(false);
  };

  // Plan batch
  const batchPlanResult: BatchPlan | { ok: false; error: string; message: string } | null =
    useMemo(() => {
      if (convertibleFiles.length === 0) return null;
      return planBatch(convertibleFiles, target);
    }, [convertibleFiles, target]);

  // Counts of ready and skipped
  const readyItems: BatchItem[] = useMemo(() => {
    if (!batchPlanResult || !batchPlanResult.ok) return [];
    return batchPlanResult.items.filter((i) => i.status === 'ready');
  }, [batchPlanResult]);

  const skippedItems: BatchItem[] = useMemo(() => {
    if (!batchPlanResult || !batchPlanResult.ok) return [];
    return batchPlanResult.items.filter((i) => i.status === 'skipped');
  }, [batchPlanResult]);

  // Convert one item
  const convertOneItem = async (
    file: File,
    item: BatchItem
  ): Promise<{ ok: boolean; bytes?: Uint8Array; message?: string }> => {
    const detection = detectConvertible({
      name: file.name,
      size: file.size,
      head: item.head,
    });

    if (!detection.ok || detection.family === 'unsupported') {
      return {
        ok: false,
        message: !detection.ok ? detection.message : detection.reason,
      };
    }

    if (detection.family === 'image') {
      const imgRes = await runImageConversion(file, {
        name: file.name,
        toFormat: target as ImageOutputFormat,
      });

      if (!imgRes.ok) {
        return { ok: false, message: imgRes.message };
      }
      return { ok: true, bytes: imgRes.bytes };
    }

    // Data or text conversion
    const textContent = await file.text();
    const outcome = runConversion({
      kind: detection.kindId,
      from: detection.formatId,
      to: target,
      input: textContent,
    });

    if (!outcome.ok) {
      return {
        ok: false,
        message:
          outcome.message ||
          `Conversion failed: ${outcome.error.replace(/-/g, ' ')}`,
      };
    }

    const bytes = new TextEncoder().encode(outcome.value);
    return { ok: true, bytes };
  };

  // Run the batch conversion
  const handleConvertAll = async () => {
    if (!batchPlanResult || !batchPlanResult.ok) return;

    setRunning(true);
    setFinished(false);
    setErrorMsg(null);
    setSaveStatus(null);
    setLastSaveResult(null);
    cancelRequestedRef.current = false;

    const runInstance = createBatchRun(batchPlanResult, {
      maxHeldBytes: 64 * 1024 * 1024,
    });

    if (!('next' in runInstance)) {
      setErrorMsg(runInstance.message);
      setRunning(false);
      return;
    }

    const run = runInstance as BatchRun;
    const accumulated: BatchOutput[] = [];

    setSnapshot(run.snapshot());

    try {
      while (true) {
        if (cancelRequestedRef.current) {
          run.cancel();
          break;
        }

        const item = run.next();
        if (!item) {
          break;
        }

        setSnapshot(run.snapshot());
        // Yield to the main thread between files so the UI remains completely responsive
        await new Promise((r) => setTimeout(r, 25));

        const file = fileMap.get(item.name);
        let completionResult: { ok: boolean; bytes?: Uint8Array; message?: string };

        if (!file) {
          completionResult = { ok: false, message: 'Source file not found' };
        } else {
          try {
            completionResult = await convertOneItem(file, item);
          } catch (err: any) {
            completionResult = {
              ok: false,
              message: err?.message || 'Conversion error',
            };
          }
        }

        let comp = run.complete(item.id, completionResult);

        // When complete answers 'memory-cap', save what is held into the zip part, drain(), then continue
        if (!comp.ok && comp.error === 'memory-cap') {
          const drained = run.drain();
          accumulated.push(...drained);
          comp = run.complete(item.id, completionResult);
        }

        setSnapshot(run.snapshot());
        await new Promise((r) => setTimeout(r, 10));
      }

      // Collect remaining held items
      const finalDrained = run.drain();
      accumulated.push(...finalDrained);

      setAccumulatedOutputs(accumulated);
      setReportRows(run.reportRows());
      setSnapshot(run.snapshot());
      setFinished(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error occurred during batch run.');
    } finally {
      setRunning(false);
    }
  };

  const handleCancel = () => {
    cancelRequestedRef.current = true;
  };

  // Save all as zip
  const handleSaveAllAsZip = async () => {
    if (accumulatedOutputs.length === 0) {
      setSaveStatus('No converted files to save.');
      return;
    }

    setSavingZip(true);
    setSaveStatus(null);

    try {
      const zipPlan = zipEntries(
        accumulatedOutputs.map((o) => ({
          name: o.name,
          bytes: o.bytes,
        }))
      );

      if (!zipPlan.ok) {
        setSaveStatus(`ZIP preparation failed: ${zipPlan.message}`);
        setSavingZip(false);
        return;
      }

      const zipBytesRes = await createZip(zipPlan.entries, { store: false });
      if (!zipBytesRes.ok) {
        setSaveStatus(`ZIP compression failed: ${zipBytesRes.message}`);
        setSavingZip(false);
        return;
      }

      const zipFileName = `batch-converted-${target}.zip`;
      const zipBlob = new Blob([zipBytesRes.value as unknown as BlobPart], { type: 'application/zip' });

      const saveRes = await saveFile(
        zipFileName,
        zipBlob,
        'application/zip'
      );

      setLastSaveResult(saveRes);
      if (saveRes.success) {
        setSaveStatus(saveRes.message || `Saved ${zipFileName}`);
      } else {
        setSaveStatus(`Save failed: ${saveRes.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setSaveStatus(`ZIP failed: ${err?.message || String(err)}`);
    } finally {
      setSavingZip(false);
    }
  };

  const handleShareZip = async () => {
    if (lastSaveResult?.canShare && lastSaveResult.share) {
      await lastSaveResult.share();
      return;
    }
    if (accumulatedOutputs.length === 0) return;

    try {
      const zipPlan = zipEntries(
        accumulatedOutputs.map((o) => ({
          name: o.name,
          bytes: o.bytes,
        }))
      );
      if (!zipPlan.ok) return;

      const zipBytesRes = await createZip(zipPlan.entries, { store: false });
      if (!zipBytesRes.ok) return;

      const zipFileName = `batch-converted-${target}.zip`;
      const file = new File([zipBytesRes.value as unknown as BlobPart], zipFileName, {
        type: 'application/zip',
      });

      if (navigator?.share) {
        await navigator.share({
          title: zipFileName,
          files: [file],
        });
      } else {
        setSaveStatus('Sharing is not supported on this browser.');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('Share error:', err);
      }
    }
  };

  // Selected files summary text
  const filesSummary = useMemo(() => {
    if (selectedFiles.length === 0) return null;
    const names = selectedFiles.slice(0, 3).map((f) => f.name).join(', ');
    const more = selectedFiles.length > 3 ? `, +${selectedFiles.length - 3} more` : '';
    return `${selectedFiles.length} files selected: ${names}${more}`;
  }, [selectedFiles]);

  return (
    <ToolScreenShell
      toolName="Batch Convert"
      tagline="BATCH CONVERT"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFilesSelected}
        className="hidden"
        aria-hidden="true"
      />

      {/* 1. Choose files (several) */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
          FILES
        </label>

        {selectedFiles.length === 0 ? (
          <button
            type="button"
            onClick={handleChooseClick}
            className="w-full min-h-[56px] border border-dashed border-white/20 hover:border-white/40 rounded-2xl p-4 flex items-center justify-center gap-3 bg-[#18191C] hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer text-[#D0D2D6]"
          >
            <Upload size={18} className="text-[#E85A3C]" />
            <span className="text-sm font-medium text-white">Choose files</span>
          </button>
        ) : (
          <div className="p-3.5 bg-[#18191C] border border-white/10 rounded-2xl space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileStack size={18} className="text-[#E85A3C] shrink-0" />
                <span className="text-xs text-[#ECECEC] leading-normal truncate">
                  {filesSummary}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleChooseClick}
                  disabled={running}
                  className="px-2.5 py-1 text-xs font-medium text-[#9A9B9F] hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={running}
                  className="px-2.5 py-1 text-xs font-medium text-[#8E9094] hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Target "To" picker (one target for all) */}
      {selectedFiles.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
            TO
          </label>
          <div className="flex flex-wrap gap-1.5 p-1 bg-[#18191C] rounded-xl border border-white/5">
            {POPULAR_TARGETS.map((t) => {
              const isSelected = target === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => !running && setTarget(t.id)}
                  disabled={running}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-medium uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center ${
                    isSelected
                      ? 'bg-white text-black font-semibold shadow-sm'
                      : 'text-[#9A9B9F] hover:text-white hover:bg-white/5'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Single line summary from planBatch ("12 will convert, 2 will be skipped") */}
      {batchPlanResult && batchPlanResult.ok && !running && !finished && (
        <div className="space-y-2 p-3 bg-[#18191C] border border-white/5 rounded-xl">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#ECECEC] font-medium">
              {readyItems.length} will convert, {skippedItems.length} will be skipped
            </span>
            {skippedItems.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSeeWhy(!showSeeWhy)}
                className="text-[#9A9B9F] hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <span>See why</span>
                {showSeeWhy ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
          </div>

          {/* Quiet "See why" disclosure */}
          {showSeeWhy && skippedItems.length > 0 && (
            <div className="pt-2 border-t border-white/5 space-y-1.5 text-xs text-[#8E9094]">
              {skippedItems.map((item) => (
                <div key={item.id} className="leading-relaxed">
                  <span className="text-white font-medium">{item.name}</span>: {item.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Plan error if any */}
      {batchPlanResult && !batchPlanResult.ok && (
        <ErrorLine message={batchPlanResult.message} />
      )}
      <ErrorLine message={errorMsg} />

      {/* 4. Convert all button or progress */}
      {selectedFiles.length > 0 && batchPlanResult && batchPlanResult.ok && !finished && (
        <div className="space-y-3 pt-1">
          {!running ? (
            <PrimaryButton
              onClick={handleConvertAll}
              disabled={readyItems.length === 0}
              className="w-full"
            >
              Convert all
            </PrimaryButton>
          ) : (
            <div className="p-4 bg-[#141517] border border-white/10 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-xs text-[#8E9094]">
                <span className="text-white font-medium">
                  Converting{' '}
                  {(snapshot?.done ?? 0) +
                    (snapshot?.failed ?? 0) +
                    (snapshot?.skipped ?? 0)}{' '}
                  of {batchPlanResult.items.length}
                </span>
                <span className="font-mono">{snapshot?.percent ?? 0}%</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[#1C1D21] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#E85A3C] h-2 transition-all duration-200"
                  style={{ width: `${snapshot?.percent ?? 0}%` }}
                />
              </div>

              {/* Cancel at all times */}
              <div className="pt-1">
                <PrimaryButton
                  variant="danger"
                  onClick={handleCancel}
                  className="w-full"
                >
                  Cancel
                </PrimaryButton>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Finished results state */}
      {finished && snapshot && (
        <div className="p-4 rounded-2xl bg-[#141517] border border-white/10 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-white">Batch Complete</span>
            <span className="text-xs text-[#8E9094] font-mono">
              {snapshot.done} converted, {snapshot.failed} failed, {snapshot.skipped} skipped
            </span>
          </div>

          {/* Quiet "See results" disclosure */}
          <div className="border border-white/5 bg-[#18191C] rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowResults(!showResults)}
              className="w-full min-h-[44px] px-3.5 py-2 flex items-center justify-between text-left text-xs font-semibold uppercase tracking-wider text-[#9A9B9F] hover:text-white transition-colors cursor-pointer"
            >
              <span>See results ({reportRows.length} files)</span>
              {showResults ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {showResults && (
              <div className="max-h-60 overflow-y-auto divide-y divide-white/5 border-t border-white/5 p-2 space-y-1">
                {reportRows.map((row, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 py-1.5 px-2 text-xs"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      {row.result === 'converted' ? (
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle size={14} className="text-[#E85A3C] shrink-0" />
                      )}
                      <span className="text-white truncate">{row.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-[#8E9094] font-mono text-[11px]">
                      <span>{formatBytes(row.sizeBefore)}</span>
                      {row.sizeAfter !== undefined && (
                        <span>→ {formatBytes(row.sizeAfter)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {saveStatus && (
            <p className="text-xs text-white/80 leading-normal">{saveStatus}</p>
          )}

          {/* Action buttons: Save all as zip and Share */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/5">
            <PrimaryButton
              onClick={handleSaveAllAsZip}
              disabled={savingZip || accumulatedOutputs.length === 0}
              icon={<Archive size={15} />}
              className="flex-1"
            >
              {savingZip ? 'Creating ZIP...' : 'Save all as zip'}
            </PrimaryButton>
            <PrimaryButton
              variant="secondary"
              onClick={handleShareZip}
              disabled={accumulatedOutputs.length === 0}
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
