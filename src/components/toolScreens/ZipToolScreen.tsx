/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Zip and Unzip Screen: Pack files together or open a zip.
 * Uses pure zip engine in src/tools/engines/files/zipTool.ts.
 */

import React, { useId, useMemo, useRef, useState } from 'react';
import {
  Archive,
  Check,
  CheckSquare,
  Download,
  FileArchive,
  Plus,
  Share2,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  ErrorLine,
  OptionsDisclosure,
  SegmentedChoice,
  SingleLineField,
  SwitchRow,
} from '../tools/ToolParts';
import {
  createZip,
  extractEntry,
  listZip,
  ZIP_TOOL_LIMITS,
  type ZipEntryInfo,
  type ZipFileInput,
} from '../../tools/engines/files/zipTool';
import { describeSize } from '../../tools/engines/files/inspect';
import { saveFile } from '../../services/saveFile';

export const toolScreen = { toolId: 'zip-tool' };

export interface ZipToolScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

type Mode = 'make' | 'open';

interface StagedFile {
  id: string;
  file: File;
  name: string;
  size: number;
}

export const ZipToolScreen: React.FC<ZipToolScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [mode, setMode] = useState<Mode>('make');

  // --- MAKE A ZIP STATE ---
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [archiveName, setArchiveName] = useState('archive.zip');
  const [storeOnly, setStoreOnly] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState<number | null>(null);
  const [createdZipBytes, setCreatedZipBytes] = useState<Uint8Array | null>(null);
  const [makeStatus, setMakeStatus] = useState<string | null>(null);
  const [makeError, setMakeError] = useState<string | null>(null);
  const cancelMakeRef = useRef(false);

  // --- OPEN A ZIP STATE ---
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [zipEntries, setZipEntries] = useState<ZipEntryInfo[] | null>(null);
  const [zipRawBytes, setZipRawBytes] = useState<Uint8Array | null>(null);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [openStatus, setOpenStatus] = useState<string | null>(null);
  const cancelExtractRef = useRef(false);

  const fileInputMultiRef = useRef<HTMLInputElement | null>(null);
  const zipInputRef = useRef<HTMLInputElement | null>(null);
  const uniqueId = useId();

  // --- MAKE ZIP ACTIONS ---
  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setMakeError(null);
    setCreatedZipBytes(null);
    setMakeStatus(null);

    const additions: StagedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      additions.push({
        id: `${f.name}-${f.size}-${Date.now()}-${i}`,
        file: f,
        name: f.name,
        size: f.size,
      });
    }

    setStagedFiles((prev) => [...prev, ...additions]);
    e.target.value = '';
  };

  const handleRemoveFile = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
    setCreatedZipBytes(null);
    setMakeStatus(null);
  };

  const handleMakeZip = async () => {
    if (stagedFiles.length === 0) return;
    setIsZipping(true);
    setZipProgress(0);
    setMakeError(null);
    setMakeStatus(null);
    setCreatedZipBytes(null);
    cancelMakeRef.current = false;

    try {
      const zipInputs: ZipFileInput[] = [];
      for (let i = 0; i < stagedFiles.length; i++) {
        if (cancelMakeRef.current) {
          setMakeStatus('Zip creation was cancelled.');
          setIsZipping(false);
          return;
        }

        const item = stagedFiles[i];
        setZipProgress(Math.round(((i + 1) / stagedFiles.length) * 50));
        const buf = await item.file.arrayBuffer();
        zipInputs.push({
          name: item.name,
          bytes: new Uint8Array(buf),
        });
      }

      setZipProgress(80);
      const res = await createZip(zipInputs, { store: storeOnly });
      if (cancelMakeRef.current) {
        setMakeStatus('Zip creation was cancelled.');
        setIsZipping(false);
        return;
      }

      setZipProgress(100);

      if (!res.ok) {
        setMakeError(res.message);
      } else {
        setCreatedZipBytes(res.value);
        setMakeStatus(`Created ${archiveName || 'archive.zip'} (${describeSize(res.value.byteLength)})`);
      }
    } catch (err: any) {
      setMakeError(err.message || 'Failed to create zip archive.');
    } finally {
      setIsZipping(false);
    }
  };

  const handleSaveCreatedZip = async () => {
    if (!createdZipBytes) return;
    const name = archiveName.trim() ? (archiveName.endsWith('.zip') ? archiveName : `${archiveName}.zip`) : 'archive.zip';
    const blob = new Blob([createdZipBytes], { type: 'application/zip' });
    const res = await saveFile(name, blob, 'application/zip');
    if (res.success) {
      setMakeStatus(res.message || `Saved ${name}`);
    } else {
      setMakeError(res.error || `Could not save ${name}`);
    }
  };

  const handleShareCreatedZip = async () => {
    if (!createdZipBytes) return;
    const name = archiveName.trim() ? (archiveName.endsWith('.zip') ? archiveName : `${archiveName}.zip`) : 'archive.zip';
    const blob = new Blob([createdZipBytes], { type: 'application/zip' });
    const file = new File([blob], name, { type: 'application/zip' });

    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: name,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') setMakeError('Share failed or was cancelled.');
      }
    } else {
      const res = await saveFile(name, blob, 'application/zip');
      if (res.canShare && res.share) {
        await res.share();
      } else if (res.success) {
        setMakeStatus(res.message || `Downloaded ${name}`);
      }
    }
  };

  // --- OPEN ZIP ACTIONS ---
  const handleSelectZipFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArchiveFile(file);
    setOpenError(null);
    setOpenStatus(null);
    setZipEntries(null);
    setZipRawBytes(null);
    setSelectedEntries(new Set());

    try {
      if (file.size > ZIP_TOOL_LIMITS.maxInputBytes) {
        setOpenError('ZIP input exceeds the 250 MB size limit.');
        return;
      }

      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      setZipRawBytes(bytes);

      const listRes = await listZip(bytes);
      if (!listRes.ok) {
        setOpenError(listRes.message);
      } else {
        setZipEntries(listRes.value);
        // Default to ticking all non-directory files
        const initialTicked = new Set(
          listRes.value.filter((entry) => !entry.isDirectory).map((e) => e.name)
        );
        setSelectedEntries(initialTicked);
      }
    } catch (err: any) {
      setOpenError(err.message || 'Could not read or parse zip archive.');
    } finally {
      e.target.value = '';
    }
  };

  const handleToggleEntry = (name: string) => {
    setSelectedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleToggleAll = () => {
    if (!zipEntries) return;
    const nonDir = zipEntries.filter((e) => !e.isDirectory);
    if (selectedEntries.size === nonDir.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(nonDir.map((e) => e.name)));
    }
  };

  const handleExtract = async () => {
    if (!zipRawBytes || !zipEntries || selectedEntries.size === 0) return;
    setIsExtracting(true);
    setOpenError(null);
    setOpenStatus(null);
    cancelExtractRef.current = false;

    const namesToExtract = Array.from(selectedEntries);
    let extractedCount = 0;

    try {
      for (let i = 0; i < namesToExtract.length; i++) {
        if (cancelExtractRef.current) {
          setOpenStatus(`Extraction cancelled after saving ${extractedCount} file${extractedCount === 1 ? '' : 's'}.`);
          setIsExtracting(false);
          return;
        }

        const name = namesToExtract[i];
        setExtractProgress({
          current: i + 1,
          total: namesToExtract.length,
          name,
        });

        const res = await extractEntry(zipRawBytes, name);
        if (!res.ok) {
          setOpenError(`Could not extract "${name}": ${res.message}`);
          setIsExtracting(false);
          return;
        }

        const safeFileName = name.split('/').pop() || name;
        const blob = new Blob([res.value], { type: 'application/octet-stream' });
        await saveFile(safeFileName, blob);
        extractedCount++;
      }

      setOpenStatus(`Extracted and saved ${extractedCount} file${extractedCount === 1 ? '' : 's'}.`);
    } catch (err: any) {
      setOpenError(err.message || 'Extraction failed.');
    } finally {
      setIsExtracting(false);
      setExtractProgress(null);
    }
  };

  return (
    <ToolScreenShell
      toolName="Zip and Unzip"
      tagline="Pack files together or open a zip"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-5">
        <p className="text-xs text-[#8E9094] italic">Files stay on your phone.</p>

        {/* Two-way Mode Choice */}
        <SegmentedChoice<Mode>
          choices={[
            { id: 'make', label: 'Make a zip' },
            { id: 'open', label: 'Open a zip' },
          ]}
          value={mode}
          onChange={(m) => {
            setMode(m);
            setMakeError(null);
            setOpenError(null);
          }}
        />

        {/* ================= MODE: MAKE A ZIP ================= */}
        {mode === 'make' && (
          <div className="space-y-4">
            {/* File selection button */}
            <div>
              <input
                ref={fileInputMultiRef}
                type="file"
                multiple
                onChange={handleAddFiles}
                className="hidden"
                id={`${uniqueId}-make-files`}
              />
              <button
                type="button"
                onClick={() => fileInputMultiRef.current?.click()}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-[#F0F0F0] transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <Plus size={16} />
                <span>Choose files</span>
              </button>
            </div>

            {/* List of files with sizes and remove buttons */}
            {stagedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#8E9094]">
                  <span>Files ({stagedFiles.length})</span>
                  <span>
                    Total: {describeSize(stagedFiles.reduce((acc, f) => acc + f.size, 0))}
                  </span>
                </div>

                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {stagedFiles.map((f) => (
                    <div
                      key={f.id}
                      className="p-2.5 bg-[#18191C] border border-white/5 rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-white truncate">{f.name}</div>
                        <div className="text-[11px] text-[#8E9094]">
                          {describeSize(f.size)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(f.id)}
                        className="text-[#8E9094] hover:text-red-400 p-1.5 rounded hover:bg-white/5 transition-colors cursor-pointer"
                        aria-label={`Remove ${f.name}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Archive name input */}
            <SingleLineField
              id={`${uniqueId}-archive-name`}
              label="Zip archive name"
              value={archiveName}
              onChange={setArchiveName}
              placeholder="archive.zip"
            />

            {/* Options */}
            <OptionsDisclosure title="Options">
              <div className="pt-1">
                <SwitchRow
                  label="Store only (no compression)"
                  description="Packs files quickly without compressing them"
                  checked={storeOnly}
                  onChange={setStoreOnly}
                />
              </div>
            </OptionsDisclosure>

            {makeError && <ErrorLine message={makeError} />}

            {/* Make Zip Button */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleMakeZip}
                disabled={stagedFiles.length === 0 || isZipping}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-[#F0F0F0] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Archive size={16} />
                <span>Make zip</span>
              </button>

              {isZipping && (
                <div className="p-3 bg-[#18191C] border border-white/10 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#8E9094]">
                    <span>Packing zip archive...</span>
                    <button
                      type="button"
                      onClick={() => {
                        cancelMakeRef.current = true;
                      }}
                      className="text-xs text-red-400 hover:underline cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[#E85A3C] h-1.5 transition-all duration-200"
                      style={{ width: `${zipProgress ?? 0}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Created Zip Result and Save/Share */}
            {createdZipBytes && (
              <div className="p-4 bg-[#18191C] border border-white/10 rounded-2xl space-y-3">
                <div className="text-xs text-emerald-400 font-medium">
                  {makeStatus}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveCreatedZip}
                    className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-[#F0F0F0] transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Download size={16} />
                    <span>Save</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShareCreatedZip}
                    className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Share2 size={16} />
                    <span>Share</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= MODE: OPEN A ZIP ================= */}
        {mode === 'open' && (
          <div className="space-y-4">
            {/* Choose Zip Button */}
            <div>
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip,application/zip"
                onChange={handleSelectZipFile}
                className="hidden"
                id={`${uniqueId}-open-zip`}
              />
              <button
                type="button"
                onClick={() => zipInputRef.current?.click()}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-[#F0F0F0] transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <FileArchive size={16} />
                <span>Choose a zip</span>
              </button>
            </div>

            {openError && <ErrorLine message={openError} />}

            {/* Zip Entries List */}
            {zipEntries && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8E9094]">
                    {archiveFile?.name} ({zipEntries.length} entries)
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleAll}
                    className="text-[#E85A3C] hover:underline cursor-pointer font-medium"
                  >
                    {selectedEntries.size === zipEntries.filter((e) => !e.isDirectory).length
                      ? 'Untick all'
                      : 'Tick all'}
                  </button>
                </div>

                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {zipEntries.map((entry) => {
                    const isSelected = selectedEntries.has(entry.name);
                    return (
                      <div
                        key={entry.name}
                        onClick={() => !entry.isDirectory && handleToggleEntry(entry.name)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-mono transition-colors ${
                          entry.isDirectory
                            ? 'bg-[#18191C]/50 border-white/5 opacity-60'
                            : isSelected
                            ? 'bg-white/10 border-white/20 text-white cursor-pointer'
                            : 'bg-[#18191C] border-white/5 text-[#D0D2D6] hover:bg-white/[0.04] cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {!entry.isDirectory ? (
                            <div className="text-[#8E9094] group-hover:text-white shrink-0">
                              {isSelected ? (
                                <CheckSquare size={16} className="text-[#E85A3C]" />
                              ) : (
                                <Square size={16} />
                              )}
                            </div>
                          ) : (
                            <span className="w-4 shrink-0 text-center text-[#8E9094]">/</span>
                          )}

                          <span className="truncate">{entry.name}</span>
                        </div>

                        <div className="text-right shrink-0 text-[11px] text-[#8E9094]">
                          {entry.encrypted ? (
                            <span className="text-amber-400 font-semibold px-1 py-0.5 rounded bg-amber-500/10">
                              Encrypted
                            </span>
                          ) : (
                            describeSize(entry.size)
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Extract Button */}
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={handleExtract}
                    disabled={selectedEntries.size === 0 || isExtracting}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-[#F0F0F0] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Download size={16} />
                    <span>Extract ({selectedEntries.size} selected)</span>
                  </button>

                  {isExtracting && (
                    <div className="p-3 bg-[#18191C] border border-white/10 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs text-[#8E9094]">
                        <span>
                          Extracting {extractProgress?.current} of {extractProgress?.total}:{' '}
                          <span className="text-white font-mono">{extractProgress?.name}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            cancelExtractRef.current = true;
                          }}
                          className="text-xs text-red-400 hover:underline cursor-pointer font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-[#E85A3C] h-1.5 transition-all duration-200"
                          style={{
                            width: `${Math.round(
                              ((extractProgress?.current || 0) /
                                Math.max(1, extractProgress?.total || 1)) *
                                100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {openStatus && (
                  <p className="text-xs text-emerald-400 pt-1 text-center font-medium">
                    {openStatus}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </ToolScreenShell>
  );
};

export default ZipToolScreen;
