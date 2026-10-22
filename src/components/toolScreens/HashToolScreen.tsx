/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hash and Checksum Screen: Fingerprint text or a file.
 * Uses the pure hashChecksum engine in src/tools/engines/create/hashChecksum.ts.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, FileUp, X } from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  ErrorLine,
  LabelledTextArea,
  ResultBox,
  SegmentedChoice,
  SingleLineField,
} from '../tools/ToolParts';
import {
  hashChecksum,
  type HashAlgorithm,
} from '../../tools/engines/create/hashChecksum';

export const toolScreen = { toolId: 'hash-tool' };

export interface HashToolScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

type InputType = 'text' | 'file';

const ALGORITHM_CHOICES: { id: HashAlgorithm; label: string }[] = [
  { id: 'SHA-256', label: 'SHA-256' },
  { id: 'MD5', label: 'MD5' },
  { id: 'SHA-1', label: 'SHA-1' },
  { id: 'SHA-512', label: 'SHA-512' },
  { id: 'SHA-384', label: 'SHA-384' },
  { id: 'CRC32', label: 'CRC32' },
];

const INPUT_TYPE_CHOICES: { id: InputType; label: string }[] = [
  { id: 'text', label: 'Text' },
  { id: 'file', label: 'File' },
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB safe phone budget
const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB chunks for responsive UI

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const HashToolScreen: React.FC<HashToolScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>('SHA-256');
  const [inputType, setInputType] = useState<InputType>('text');

  // Text mode state
  const [textInput, setTextInput] = useState('');

  // File mode state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileProgress, setFileProgress] = useState<number | null>(null);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const isCancelledRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Result and compare state
  const [computedHash, setComputedHash] = useState<string>('');
  const [compareHash, setCompareHash] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Recompute hash for text mode
  useEffect(() => {
    if (inputType !== 'text') return;
    if (!textInput) {
      setComputedHash('');
      setErrorMsg(null);
      return;
    }

    let active = true;
    hashChecksum(textInput, algorithm).then((res) => {
      if (!active) return;
      if (res.ok) {
        setComputedHash(res.hex);
        setErrorMsg(null);
      } else {
        setComputedHash('');
        setErrorMsg(`Hashing failed: ${res.error}`);
      }
    });

    return () => {
      active = false;
    };
  }, [textInput, algorithm, inputType]);

  // Recompute hash when file bytes are ready or algorithm changes
  useEffect(() => {
    if (inputType !== 'file' || !fileBytes) return;

    let active = true;
    hashChecksum(fileBytes, algorithm).then((res) => {
      if (!active) return;
      if (res.ok) {
        setComputedHash(res.hex);
        setErrorMsg(null);
      } else {
        setComputedHash('');
        setErrorMsg(`Hashing failed: ${res.error}`);
      }
    });

    return () => {
      active = false;
    };
  }, [fileBytes, algorithm, inputType]);

  // Handle file selection and chunked reading
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setErrorMsg(`File exceeds maximum size limit of ${formatBytes(MAX_FILE_SIZE)}.`);
      setSelectedFile(null);
      setFileBytes(null);
      setComputedHash('');
      return;
    }

    setSelectedFile(file);
    setErrorMsg(null);
    setComputedHash('');
    setFileProgress(0);
    isCancelledRef.current = false;

    try {
      const buffer = new Uint8Array(file.size);
      let offset = 0;

      while (offset < file.size) {
        if (isCancelledRef.current) {
          setFileProgress(null);
          setSelectedFile(null);
          setFileBytes(null);
          return;
        }

        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const arrayBuf = await slice.arrayBuffer();
        buffer.set(new Uint8Array(arrayBuf), offset);
        offset += arrayBuf.byteLength;

        const percent = Math.min(100, Math.round((offset / file.size) * 100));
        setFileProgress(percent);

        // Yield to maintain responsiveness
        await new Promise((r) => setTimeout(r, 0));
      }

      setFileProgress(null);
      setFileBytes(buffer);
    } catch {
      setErrorMsg('Failed to read file.');
      setFileProgress(null);
      setSelectedFile(null);
      setFileBytes(null);
    }
  };

  const handleCancelFile = () => {
    isCancelledRef.current = true;
    setSelectedFile(null);
    setFileBytes(null);
    setFileProgress(null);
    setComputedHash('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Compare hashes ignoring case and spaces
  const matchResult = useMemo(() => {
    const target = compareHash.replace(/\s+/g, '').toLowerCase();
    const source = computedHash.replace(/\s+/g, '').toLowerCase();
    if (!target || !source) return null;
    return target === source;
  }, [compareHash, computedHash]);

  return (
    <ToolScreenShell
      toolName="Hash and Checksum"
      tagline="Fingerprint text or a file"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-4">
        {/* Algorithm selection row */}
        <SegmentedChoice<HashAlgorithm>
          label="Algorithm"
          choices={ALGORITHM_CHOICES}
          value={algorithm}
          onChange={setAlgorithm}
        />

        {/* Input Type selection (Text vs File) */}
        <SegmentedChoice<InputType>
          label="Input Source"
          choices={INPUT_TYPE_CHOICES}
          value={inputType}
          onChange={(t) => {
            setInputType(t);
            setComputedHash('');
            setErrorMsg(null);
          }}
        />

        {/* Text Input Mode */}
        {inputType === 'text' && (
          <LabelledTextArea
            id="hash-text-input"
            label="Text"
            value={textInput}
            onChange={setTextInput}
            placeholder="Type or paste text to hash..."
            rows={5}
            onClear={() => setTextInput('')}
          />
        )}

        {/* File Input Mode */}
        {inputType === 'file' && (
          <div className="space-y-3">
            <span className="block text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
              File
            </span>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />

            {!selectedFile ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full min-h-[56px] border border-dashed border-white/15 hover:border-white/30 rounded-2xl p-4 flex items-center justify-center gap-2.5 text-sm text-[#9A9B9F] hover:text-white transition-colors cursor-pointer bg-[#18191C]/50"
              >
                <FileUp size={18} className="text-[#E85A3C]" />
                <span>Choose a file</span>
              </button>
            ) : (
              <div className="p-3.5 bg-[#18191C] border border-white/10 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="truncate pr-2">
                    <span className="font-medium text-white">{selectedFile.name}</span>
                    <span className="text-[#8E9094] ml-2">({formatBytes(selectedFile.size)})</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelFile}
                    className="p-1 text-[#8E9094] hover:text-white transition-colors cursor-pointer"
                    title="Remove file"
                  >
                    <X size={16} />
                  </button>
                </div>

                {fileProgress !== null && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[11px] text-[#9A9B9F] font-mono">
                      <span>Reading file...</span>
                      <span>{fileProgress}%</span>
                    </div>
                    <div className="w-full bg-[#141517] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-[#E85A3C] h-1.5 rounded-full transition-all duration-150"
                        style={{ width: `${fileProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error Line */}
        {errorMsg && <ErrorLine message={errorMsg} />}

        {/* Computed Hash Result Box */}
        <ResultBox
          title={`${algorithm} Hash`}
          text={computedHash}
          emptyNotice={
            inputType === 'text'
              ? 'Enter text above to compute hash...'
              : selectedFile
              ? 'Processing file...'
              : 'Choose a file above to compute hash...'
          }
          onClear={() => {
            setTextInput('');
            handleCancelFile();
          }}
        />

        {/* Hash Comparison Section */}
        <div className="space-y-2 pt-1 border-t border-white/5">
          <SingleLineField
            id="compare-hash-input"
            label="Compare with a hash you have"
            value={compareHash}
            onChange={setCompareHash}
            placeholder="Paste expected checksum to compare..."
            onClear={() => setCompareHash('')}
          />

          {matchResult !== null && (
            <div className="flex items-center gap-2 px-1 text-xs">
              {matchResult ? (
                <div className="flex items-center gap-1.5 text-emerald-400 font-medium font-mono">
                  <Check size={14} />
                  <span>They match</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[#E85A3C] font-medium font-mono">
                  <X size={14} />
                  <span>They do not match</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ToolScreenShell>
  );
};

export default HashToolScreen;
