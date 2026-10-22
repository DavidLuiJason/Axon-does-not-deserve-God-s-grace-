/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * File Inspector Screen: See what a file really is.
 * Uses pure engines in src/tools/engines/files/inspect.ts and src/tools/engines/create/hashChecksum.ts.
 */

import React, { useId, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileSearch,
  Upload,
  X,
} from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import { copyToClipboard, ErrorLine } from '../tools/ToolParts';
import {
  describeSize,
  inspectBytes,
  type FileInspection,
} from '../../tools/engines/files/inspect';
import {
  hashChecksum,
  type HashAlgorithm,
} from '../../tools/engines/create/hashChecksum';

export const toolScreen = { toolId: 'file-inspector' };

export interface FileInspectorScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

interface TextStats {
  lines: number;
  words: number;
  characters: number;
}

interface Fingerprints {
  md5: string;
  sha1: string;
  sha256: string;
  crc32: string;
}

export const FileInspectorScreen: React.FC<FileInspectorScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<FileInspection | null>(null);
  const [textStats, setTextStats] = useState<TextStats | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fingerprints
  const [isHashing, setIsHashing] = useState(false);
  const [hashProgress, setHashProgress] = useState<number | null>(null);
  const [fingerprints, setFingerprints] = useState<Fingerprints | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // First bytes toggle
  const [showHexDump, setShowHexDump] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uniqueId = useId();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setErrorMessage(null);
    setFingerprints(null);
    setTextStats(null);
    setShowHexDump(false);

    try {
      // 1. Read first 4096 bytes for inspection
      const headSlice = file.slice(0, 4096);
      const headBuf = await headSlice.arrayBuffer();
      const res = inspectBytes({
        name: file.name,
        size: file.size,
        head: new Uint8Array(headBuf),
      });

      if (!res.ok) {
        setErrorMessage(res.message);
        setInspection(null);
        return;
      }

      setInspection(res);

      // 2. If it is detected as text, count lines, words, chars
      if (res.textDetection.isText && file.size <= 5 * 1024 * 1024) {
        try {
          const txt = await file.text();
          const lines = txt.split(/\r\n|\r|\n/).length;
          const words = txt.trim() ? txt.trim().split(/\s+/).filter(Boolean).length : 0;
          const characters = txt.length;
          setTextStats({ lines, words, characters });
        } catch {
          // ignore text decode error
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not read file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleComputeFingerprints = async () => {
    if (!selectedFile) return;
    setIsHashing(true);
    setHashProgress(0);

    try {
      const chunkSize = 1024 * 1024; // 1 MB chunks
      const total = selectedFile.size;
      const chunksCount = Math.max(1, Math.ceil(total / chunkSize));

      // Read file in chunks to show honest progress
      const fullBuffer = new Uint8Array(total);
      let offset = 0;

      for (let i = 0; i < chunksCount; i++) {
        const slice = selectedFile.slice(offset, offset + chunkSize);
        const buf = await slice.arrayBuffer();
        fullBuffer.set(new Uint8Array(buf), offset);
        offset += buf.byteLength;
        setHashProgress(Math.min(100, Math.round((offset / total) * 90)));
      }

      // Compute standard digests
      const [md5R, sha1R, sha256R, crc32R] = await Promise.all([
        hashChecksum(fullBuffer, 'MD5'),
        hashChecksum(fullBuffer, 'SHA-1'),
        hashChecksum(fullBuffer, 'SHA-256'),
        hashChecksum(fullBuffer, 'CRC32'),
      ]);

      setHashProgress(100);

      setFingerprints({
        md5: md5R.ok ? md5R.hex : 'failed',
        sha1: sha1R.ok ? sha1R.hex : 'failed',
        sha256: sha256R.ok ? sha256R.hex : 'failed',
        crc32: crc32R.ok ? crc32R.hex : 'failed',
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Fingerprint computation failed.');
    } finally {
      setIsHashing(false);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedHash(label);
      setTimeout(() => setCopiedHash(null), 2000);
    }
  };

  return (
    <ToolScreenShell
      toolName="File Inspector"
      tagline="See what a file really is"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-5">
        <p className="text-xs text-[#8E9094] italic">Files stay on your phone.</p>

        {/* Choose a File Button */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
            id={`${uniqueId}-inspect-file`}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-[#F0F0F0] transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            <Upload size={16} />
            <span>Choose a file</span>
          </button>
        </div>

        {errorMessage && <ErrorLine message={errorMessage} />}

        {/* Inspection Details */}
        {inspection && (
          <div className="space-y-4">
            <div className="bg-[#18191C] border border-white/10 rounded-2xl divide-y divide-white/5 overflow-hidden text-xs">
              {/* Name */}
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-[#8E9094] shrink-0 font-medium">Name</span>
                <span className="font-mono text-white truncate text-right">
                  {inspection.name}
                </span>
              </div>

              {/* Size */}
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-[#8E9094] shrink-0 font-medium">Size</span>
                <span className="font-mono text-white text-right">
                  {describeSize(inspection.size)}
                </span>
              </div>

              {/* Type */}
              <div className="px-4 py-3 space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#8E9094] font-medium">Type</span>
                  <span className="font-mono uppercase font-semibold text-white bg-white/10 px-2 py-0.5 rounded text-[11px]">
                    {inspection.type}
                  </span>
                </div>
                {inspection.extensionMessage && (
                  <p
                    className={`text-[11px] pt-0.5 ${
                      inspection.extensionAgrees === false
                        ? 'text-amber-400 font-medium'
                        : 'text-[#8E9094]'
                    }`}
                  >
                    {inspection.extensionMessage}
                  </p>
                )}
              </div>

              {/* Picture Size if picture */}
              {inspection.dimensions && (
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-[#8E9094] font-medium">Picture size</span>
                  <span className="font-mono text-white">
                    {inspection.dimensions.width} × {inspection.dimensions.height} pixels
                  </span>
                </div>
              )}

              {/* Text Stats if text */}
              {inspection.textDetection.isText && (
                <div className="px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#8E9094] font-medium">Text content</span>
                    <span className="font-mono text-white text-[11px]">
                      {inspection.textDetection.encoding}
                    </span>
                  </div>
                  {textStats && (
                    <div className="pt-1 grid grid-cols-3 gap-2 text-center bg-white/[0.02] p-2 rounded-xl font-mono text-[11px]">
                      <div>
                        <span className="text-[#8E9094] block text-[10px]">Lines</span>
                        <span className="text-white font-medium">
                          {textStats.lines.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#8E9094] block text-[10px]">Words</span>
                        <span className="text-white font-medium">
                          {textStats.words.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#8E9094] block text-[10px]">Characters</span>
                        <span className="text-white font-medium">
                          {textStats.characters.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Fingerprints Row */}
            <div className="p-4 bg-[#18191C] border border-white/10 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
                  Fingerprints
                </span>

                {!fingerprints && !isHashing && (
                  <button
                    type="button"
                    onClick={handleComputeFingerprints}
                    className="text-xs text-[#E85A3C] hover:underline cursor-pointer font-medium"
                  >
                    Compute fingerprints
                  </button>
                )}
              </div>

              {isHashing && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[11px] text-[#8E9094]">
                    <span>Calculating hashes in chunks...</span>
                    <span>{hashProgress ?? 0}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[#E85A3C] h-1.5 transition-all duration-200"
                      style={{ width: `${hashProgress ?? 0}%` }}
                    />
                  </div>
                </div>
              )}

              {fingerprints && (
                <div className="space-y-2 pt-1 font-mono text-xs">
                  {(['md5', 'sha1', 'sha256', 'crc32'] as const).map((algo) => {
                    const hashVal = fingerprints[algo];
                    const isCopied = copiedHash === algo;
                    return (
                      <div
                        key={algo}
                        className="p-2.5 bg-black/40 rounded-xl border border-white/5 flex items-center justify-between gap-3 group"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] text-[#8E9094] uppercase tracking-wider block font-sans">
                            {algo.toUpperCase()}
                          </span>
                          <span className="text-white break-all text-[11px] select-all">
                            {hashVal}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(hashVal, algo)}
                          title={`Copy ${algo.toUpperCase()}`}
                          className="p-1.5 text-[#8E9094] hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                        >
                          {isCopied ? (
                            <Check size={14} className="text-emerald-400" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quiet row: "First bytes" opens engine's hex dump */}
            <div className="border border-white/10 bg-[#18191C] rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowHexDump(!showHexDump)}
                className="w-full min-h-[44px] px-4 py-3 flex items-center justify-between text-left hover:bg-white/5 transition-colors cursor-pointer"
                aria-expanded={showHexDump}
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
                  First bytes (Hex dump)
                </span>
                <div className="text-[#8E9094]">
                  {showHexDump ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
              </button>

              {showHexDump && (
                <div className="p-3 border-t border-white/5 overflow-x-auto bg-[#141518]">
                  <pre className="font-mono text-[11px] leading-tight text-[#D0D2D6] whitespace-pre select-text">
                    {inspection.hexDump}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {!selectedFile && (
          <div className="p-6 bg-[#18191C]/50 border border-white/5 rounded-2xl text-xs text-[#8E9094] italic text-center space-y-1">
            <FileSearch size={28} className="mx-auto text-[#8E9094]/60 mb-2" />
            <p>Choose a file above to inspect its real type, size, and header bytes.</p>
          </div>
        )}
      </div>
    </ToolScreenShell>
  );
};

export default FileInspectorScreen;
