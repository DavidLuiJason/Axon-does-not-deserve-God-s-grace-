/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * My Dictionary Screen: Keep, search, import, edit, export and erase the owner's own word meanings.
 * Uses the pure userDictionary and userDictionaryImport engines.
 * English dictionary is immutable and never modified.
 */

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  ErrorLine,
  LabelledTextArea,
  OptionsDisclosure,
  PrimaryButton,
  SegmentedChoice,
  SingleLineField,
} from '../tools/ToolParts';
import {
  createUserDictionary,
  USER_DICT_LIMITS,
  type UserDictionaryEntry,
  type UserPartOfSpeech,
} from '../../tools/engines/dictionary/userDictionary';
import {
  applyImport,
  parseImportChunks,
  type ImportContext,
  type ImportReport,
} from '../../tools/engines/dictionary/userDictionaryImport';
import { getDictionary } from '../../brain/dictionaryAccess';
import {
  hashEntryKey,
  userDictionaryStorage,
} from '../../services/userDictionaryStorage';
import { saveFile } from '../../services/saveFile';

export const toolScreen = { toolId: 'my-dictionary' };

export interface MyDictionaryScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

type ScreenView =
  | 'home'
  | 'add'
  | 'edit'
  | 'importing'
  | 'import-report'
  | 'erase-confirm';

const POS_CHOICES: { id: UserPartOfSpeech; label: string }[] = [
  { id: 'noun', label: 'Noun' },
  { id: 'verb', label: 'Verb' },
  { id: 'adjective', label: 'Adjective' },
  { id: 'adverb', label: 'Adverb' },
  { id: 'other', label: 'Other' },
];

export const MyDictionaryScreen: React.FC<MyDictionaryScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  // 1. Initialise the user dictionary engine with persistent localStorage adapter
  const userDict = useMemo(() => {
    return createUserDictionary(userDictionaryStorage, {
      hash: hashEntryKey,
      now: () => Date.now(),
    });
  }, []);

  // Navigation & view states
  const [view, setView] = useState<ScreenView>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [entries, setEntries] = useState<UserDictionaryEntry[]>([]);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);
  const [hasUndo, setHasUndo] = useState(false);

  // Form states for Add / Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formWord, setFormWord] = useState('');
  const [formPos, setFormPos] = useState<UserPartOfSpeech>('noun');
  const [formMeaning, setFormMeaning] = useState('');
  const [formExample, setFormExample] = useState('');
  const [formSynonyms, setFormSynonyms] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  // Import flow states
  const [importProgress, setImportProgress] = useState(0);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importFile, setImportFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [showProblems, setShowProblems] = useState(false);
  const cancelImportRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Erase confirmation state
  const [eraseConfirmText, setEraseConfirmText] = useState('');
  const [eraseError, setEraseError] = useState<string | null>(null);

  const searchInputId = useId();

  // Reload current entries from dictionary
  const refreshEntries = () => {
    const st = userDict.status();
    if (!st.ok) {
      setStorageError(st.message);
      setEntries([]);
      return;
    }
    setStorageError(null);

    if (searchQuery.trim()) {
      const res = userDict.find(searchQuery.trim(), 100);
      if (res.ok) setEntries(res.entries);
    } else {
      const res = userDict.list(0, 100);
      if (res.ok) setEntries(res.entries);
    }
  };

  useEffect(() => {
    refreshEntries();
  }, [searchQuery]);

  // Form actions
  const openAddForm = () => {
    setEditingId(null);
    setFormWord('');
    setFormPos('noun');
    setFormMeaning('');
    setFormExample('');
    setFormSynonyms('');
    setFormError(null);
    setShowMoreDetails(false);
    setView('add');
  };

  const openEditForm = (entry: UserDictionaryEntry) => {
    setEditingId(entry.id);
    setFormWord(entry.word);
    setFormPos(entry.partOfSpeech);
    setFormMeaning(entry.meaning);
    setFormExample(entry.example ?? '');
    setFormSynonyms(entry.synonyms ? entry.synonyms.join(', ') : '');
    setFormError(null);
    setShowMoreDetails(Boolean(entry.example || (entry.synonyms && entry.synonyms.length > 0)));
    setView('edit');
  };

  const handleSaveEntry = () => {
    setFormError(null);
    const trimmedWord = formWord.trim();
    if (!trimmedWord) {
      setFormError('Word is required.');
      return;
    }
    if (trimmedWord.length > USER_DICT_LIMITS.maxWordChars) {
      setFormError(`Word must be at most ${USER_DICT_LIMITS.maxWordChars} characters.`);
      return;
    }
    if (!formMeaning.trim()) {
      setFormError('Meaning is required.');
      return;
    }
    if (formMeaning.length > USER_DICT_LIMITS.maxMeaningChars) {
      setFormError(`Meaning must be at most ${USER_DICT_LIMITS.maxMeaningChars} characters.`);
      return;
    }
    if (formExample.trim().length > USER_DICT_LIMITS.maxExampleChars) {
      setFormError(`Example must be at most ${USER_DICT_LIMITS.maxExampleChars} characters.`);
      return;
    }

    const synList = formSynonyms
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (synList.length > USER_DICT_LIMITS.maxSynonyms) {
      setFormError(`At most ${USER_DICT_LIMITS.maxSynonyms} synonyms are allowed.`);
      return;
    }

    const payload = {
      word: trimmedWord,
      partOfSpeech: formPos,
      meaning: formMeaning.trim(),
      ...(formExample.trim() ? { example: formExample.trim() } : {}),
      ...(synList.length > 0 ? { synonyms: synList } : {}),
    };

    if (editingId) {
      const res = userDict.update(editingId, payload);
      if (!res.ok) {
        setFormError(res.message);
        return;
      }
      setFeedbackNotice(`Updated "${trimmedWord}"`);
    } else {
      const res = userDict.add(payload);
      if (!res.ok) {
        setFormError(res.message);
        return;
      }
      setFeedbackNotice(`Added "${trimmedWord}"`);
    }

    refreshEntries();
    setView('home');
  };

  const handleDeleteEntry = () => {
    if (!editingId) return;
    // Use removeMany([editingId]) so an undo copy is saved by the engine
    const res = userDict.removeMany([editingId]);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setHasUndo(true);
    setFeedbackNotice(`Deleted "${formWord}"`);
    refreshEntries();
    setView('home');
  };

  // Undo last change
  const handleUndo = () => {
    const res = userDict.undoLast();
    if (!res.ok) {
      setFeedbackNotice(res.message);
      return;
    }
    setHasUndo(false);
    setFeedbackNotice('Restored previous change.');
    refreshEntries();
  };

  // Export handling
  const handleExport = async (format: 'json' | 'csv') => {
    if (format === 'json') {
      const res = userDict.exportJson();
      if (!res.ok) {
        setFeedbackNotice(res.message);
        return;
      }
      await saveFile('my-dictionary.json', res.text, 'application/json');
      setFeedbackNotice('Exported dictionary as JSON.');
    } else {
      const res = userDict.exportCsv();
      if (!res.ok) {
        setFeedbackNotice(res.message);
        return;
      }
      await saveFile('my-dictionary.csv', res.text, 'text/csv');
      setFeedbackNotice('Exported dictionary as CSV.');
    }
  };

  // Erase all handling
  const handleEraseAll = () => {
    if (eraseConfirmText !== 'ERASE') {
      setEraseError('Type the word ERASE to confirm.');
      return;
    }
    const res = userDict.eraseAll({ force: true });
    if (!res.ok) {
      setEraseError(res.message);
      return;
    }
    setHasUndo(true);
    setEraseConfirmText('');
    setEraseError(null);
    setFeedbackNotice('All dictionary entries erased. Undo is available.');
    refreshEntries();
    setView('home');
  };

  // Import file picking and chunked progress
  const handlePickImportFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      setImportFile({ name: file.name, bytes });
      startImportParsing({ name: file.name, bytes });
    } catch {
      setFeedbackNotice('Could not open the selected import file.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startImportParsing = async (input: { name: string; bytes: Uint8Array }) => {
    cancelImportRef.current = false;
    setView('importing');
    setImportProgress(0);
    setShowProblems(false);

    // Build the coreHas lookup function by checking the English dictionary without history side-effects
    let dictInstance: any = null;
    try {
      dictInstance = await getDictionary();
    } catch {
      dictInstance = null;
    }

    // Extract quick candidate word tokens for synchronous core checking
    const knownCoreKeys = new Set<string>();
    if (dictInstance) {
      try {
        const textSample = new TextDecoder('utf-8').decode(input.bytes.slice(0, 500_000));
        const words = textSample.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) ?? [];
        const uniqueWords = [...new Set(words.map((w) => w.toLowerCase()))].slice(0, 2000);

        for (const w of uniqueWords) {
          if (cancelImportRef.current) break;
          if (dictInstance.leafOf(w) !== null) {
            try {
              if (await dictInstance.has(w)) {
                knownCoreKeys.add(w);
              }
            } catch {
              // Ignore core lookup error on individual token
            }
          }
        }
      } catch {
        // Fallback to empty core set
      }
    }

    if (cancelImportRef.current) {
      setView('home');
      return;
    }

    const context: ImportContext = {
      existing: (key, pos) => {
        const res = userDict.get(key);
        return res.ok && res.entries.some((e) => e.partOfSpeech === pos);
      },
      coreHas: (key) => knownCoreKeys.has(key),
    };

    try {
      let finalReport: ImportReport | null = null;
      for await (const chunk of parseImportChunks(input, context)) {
        if (cancelImportRef.current) {
          setView('home');
          return;
        }
        setImportProgress(chunk.progress);
        if (chunk.done) {
          finalReport = chunk.report;
        }
      }

      if (finalReport) {
        setImportReport(finalReport);
        setView('import-report');
      } else {
        setFeedbackNotice('Import produced no report.');
        setView('home');
      }
    } catch (err) {
      setFeedbackNotice(`Import parsing failed: ${(err as Error).message}`);
      setView('home');
    }
  };

  const handleCancelImport = () => {
    cancelImportRef.current = true;
    setImportReport(null);
    setImportFile(null);
    setView('home');
  };

  const handleConfirmImport = () => {
    if (!importReport) return;
    const res = applyImport(userDict, importReport, { confirm: true });
    if (!res.ok) {
      setFeedbackNotice(res.message);
      return;
    }

    setHasUndo(true);
    setFeedbackNotice(`Added ${res.added} words.`);
    setImportReport(null);
    setImportFile(null);
    refreshEntries();
    setView('home');
  };

  const totalDictionaryWords = userDict.count();

  return (
    <ToolScreenShell
      toolName="My Dictionary"
      tagline="Your own word meanings, separate from the English dictionary"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-4">
        {/* Hidden file input for import files */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.text,.csv,.tsv,.json,.zip"
          onChange={handleFileSelected}
          className="hidden"
          aria-label="Upload dictionary import file"
        />

        {/* Storage status error */}
        <ErrorLine message={storageError} />

        {/* Temporary action feedback notice */}
        {feedbackNotice && (
          <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-[#ECECEC] flex items-center justify-between gap-2">
            <span>{feedbackNotice}</span>
            <button
              type="button"
              onClick={() => setFeedbackNotice(null)}
              className="text-[#8E9094] hover:text-white p-1 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* VIEW 1: HOME VIEW */}
        {view === 'home' && (
          <div className="space-y-4">
            {/* Search Input Bar */}
            <div className="relative flex items-center">
              <Search size={15} className="absolute left-3.5 text-[#8E9094]" />
              <input
                id={searchInputId}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your dictionary..."
                className="w-full min-h-[44px] pl-10 pr-9 bg-[#1C1D21] border border-white/10 rounded-xl text-sm text-white placeholder-[#686A70] focus:outline-none focus:border-[#E85A3C] transition-colors font-sans"
              />
              {searchQuery.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-3 text-[#8E9094] hover:text-white p-1 cursor-pointer"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Action Bar: Add word, Import, More Options */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openAddForm}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white text-black hover:bg-[#F0F0F0] text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"
              >
                <Plus size={16} />
                <span>Add word</span>
              </button>

              <button
                type="button"
                onClick={handlePickImportFile}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium text-[#ECECEC] transition-colors cursor-pointer flex items-center gap-2 border border-white/5"
              >
                <Upload size={16} className="text-[#8E9094]" />
                <span>Import</span>
              </button>

              {hasUndo && (
                <button
                  type="button"
                  onClick={handleUndo}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#E85A3C]/15 hover:bg-[#E85A3C]/25 text-xs font-medium text-[#E85A3C] transition-colors cursor-pointer flex items-center gap-1.5 border border-[#E85A3C]/30"
                >
                  <RotateCcw size={14} />
                  <span>Undo last change</span>
                </button>
              )}
            </div>

            {/* Quiet More Row */}
            <OptionsDisclosure title="More">
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between text-xs text-[#8E9094]">
                  <span>Total words</span>
                  <span className="font-mono text-white font-medium">
                    {totalDictionaryWords.toLocaleString()}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => handleExport('json')}
                    disabled={totalDictionaryWords === 0}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium text-[#ECECEC] transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <Download size={14} className="text-[#8E9094]" />
                    <span>Export JSON</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExport('csv')}
                    disabled={totalDictionaryWords === 0}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium text-[#ECECEC] transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <Download size={14} className="text-[#8E9094]" />
                    <span>Export CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEraseConfirmText('');
                      setEraseError(null);
                      setView('erase-confirm');
                    }}
                    disabled={totalDictionaryWords === 0}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#E85A3C]/15 hover:bg-[#E85A3C]/25 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium text-[#E85A3C] transition-colors cursor-pointer flex items-center gap-2 ml-auto"
                  >
                    <Trash2 size={14} />
                    <span>Erase all</span>
                  </button>
                </div>
              </div>
            </OptionsDisclosure>

            {/* Word List Presentation */}
            {entries.length === 0 ? (
              <div className="py-14 text-center text-xs text-[#8E9094] flex flex-col items-center justify-center space-y-2 border border-dashed border-white/10 rounded-2xl bg-[#161719]/40 p-6">
                <FileText size={28} className="text-[#686A70] mb-1" />
                <p className="text-sm font-medium text-[#D1D2D6]">
                  {searchQuery.trim()
                    ? 'No matching words found'
                    : 'Your dictionary is empty'}
                </p>
                <p className="text-xs text-[#8E9094]">
                  {searchQuery.trim()
                    ? 'Try searching with different letters.'
                    : 'Add a word or import a file.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5 border-t border-b border-white/5">
                {entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => openEditForm(entry)}
                    className="w-full text-left py-3 px-1.5 hover:bg-white/[0.03] transition-colors cursor-pointer group flex items-start justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-baseline gap-2.5">
                        <span className="text-sm font-medium text-white group-hover:text-[#E85A3C] transition-colors truncate">
                          {entry.word}
                        </span>
                        <span className="text-xs text-[#8E9094] lowercase font-mono">
                          {entry.partOfSpeech}
                        </span>
                        <span className="text-[11px] text-[#8E9094] italic ml-auto shrink-0 select-none">
                          from your dictionary
                        </span>
                      </div>
                      <p className="text-xs text-[#D1D2D6] truncate leading-normal">
                        {entry.meaning}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-[#686A70] shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: ADD / EDIT ENTRY FORM */}
        {(view === 'add' || view === 'edit') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8E9094]">
                {view === 'add' ? 'Add Word' : 'Edit Word'}
              </h2>
              <button
                type="button"
                onClick={() => setView('home')}
                className="text-xs text-[#8E9094] hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Cancel</span>
              </button>
            </div>

            <ErrorLine message={formError} />

            <SingleLineField
              label="Word"
              value={formWord}
              onChange={setFormWord}
              placeholder="e.g. wanderlust"
              maxLength={USER_DICT_LIMITS.maxWordChars}
            />

            <SegmentedChoice<UserPartOfSpeech>
              label="Part of speech"
              choices={POS_CHOICES}
              value={formPos}
              onChange={setFormPos}
            />

            <LabelledTextArea
              label="Meaning"
              value={formMeaning}
              onChange={setFormMeaning}
              placeholder="Enter definition or meaning..."
              rows={4}
              maxLength={USER_DICT_LIMITS.maxMeaningChars}
            />

            {/* More details disclosure */}
            <OptionsDisclosure title="More details" defaultOpen={showMoreDetails}>
              <div className="space-y-3 pt-1">
                <SingleLineField
                  label="Example sentence"
                  value={formExample}
                  onChange={setFormExample}
                  placeholder="Optional usage example..."
                  maxLength={USER_DICT_LIMITS.maxExampleChars}
                />

                <SingleLineField
                  label="Synonyms"
                  value={formSynonyms}
                  onChange={setFormSynonyms}
                  placeholder="Separate with commas (e.g. voyage, roam)"
                  hint="Up to 10 synonyms, each up to 60 characters."
                />
              </div>
            </OptionsDisclosure>

            {/* Form Actions */}
            <div className="flex items-center gap-2 pt-2">
              <PrimaryButton onClick={handleSaveEntry} className="flex-1">
                {view === 'add' ? 'Save word' : 'Update word'}
              </PrimaryButton>

              {view === 'edit' && (
                <button
                  type="button"
                  onClick={handleDeleteEntry}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#E85A3C]/15 hover:bg-[#E85A3C]/25 text-sm font-medium text-[#E85A3C] transition-colors cursor-pointer flex items-center gap-2"
                >
                  <Trash2 size={16} />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: IMPORT PROGRESS */}
        {view === 'importing' && (
          <div className="py-12 px-4 bg-[#18191C] border border-white/5 rounded-2xl text-center space-y-4">
            <h2 className="text-sm font-semibold text-white">Reading import file...</h2>
            <p className="text-xs text-[#8E9094]">
              Validating words without storing anything yet.
            </p>

            <div className="w-full bg-[#121315] rounded-full h-2.5 overflow-hidden border border-white/5 max-w-sm mx-auto">
              <div
                className="bg-[#E85A3C] h-2.5 transition-all duration-150 rounded-full"
                style={{ width: `${importProgress}%` }}
              />
            </div>
            <p className="text-xs font-mono text-[#8E9094]">{importProgress}%</p>

            <button
              type="button"
              onClick={handleCancelImport}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {/* VIEW 4: IMPORT STAGED REPORT */}
        {view === 'import-report' && importReport && (
          <div className="space-y-4 bg-[#18191C] border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h2 className="text-sm font-semibold text-white">Import Report</h2>
              <span className="text-xs text-[#8E9094]">Nothing stored yet</span>
            </div>

            {/* Summary sentence */}
            <p className="text-sm text-[#ECECEC] leading-relaxed">
              Will add{' '}
              <span className="font-semibold text-white">
                {importReport.stats.accepted.toLocaleString()}
              </span>{' '}
              words. Already yours:{' '}
              <span className="font-semibold text-white">
                {importReport.duplicates
                  .filter((d) => d.reason === 'already-yours')
                  .length.toLocaleString()}
              </span>
              . Also in the main dictionary:{' '}
              <span className="font-semibold text-white">
                {importReport.alsoInCore.length.toLocaleString()}
              </span>{' '}
              <span className="text-xs text-[#8E9094]">
                (it stays untouched)
              </span>
              . Problems:{' '}
              <span className="font-semibold text-white">
                {importReport.stats.rejected.toLocaleString()}
              </span>
              .
            </p>

            {/* Problems list */}
            {importReport.stats.rejected > 0 && (
              <div className="border border-white/5 rounded-xl overflow-hidden bg-[#161719]">
                <button
                  type="button"
                  onClick={() => setShowProblems(!showProblems)}
                  className="w-full min-h-[44px] px-4 py-2 flex items-center justify-between text-left text-xs font-semibold uppercase tracking-wider text-[#9A9B9F] hover:bg-white/5 cursor-pointer"
                >
                  <span>See problems ({importReport.stats.rejected})</span>
                  {showProblems ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {showProblems && (
                  <div className="p-3 border-t border-white/5 max-h-56 overflow-y-auto space-y-2">
                    {importReport.rejected.map((prob, idx) => (
                      <div
                        key={idx}
                        className="text-xs text-[#E0B4A8] bg-[#231A19] border border-[#E85A3C]/20 p-2.5 rounded-lg space-y-0.5"
                      >
                        <div className="font-semibold text-[#E85A3C]">
                          {prob.where}: {prob.reason}
                        </div>
                        {prob.text && (
                          <div className="text-[11px] font-mono text-[#D1D2D6] truncate">
                            {prob.text}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Confirm Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
              <PrimaryButton
                onClick={handleConfirmImport}
                disabled={importReport.stats.accepted === 0}
                className="flex-1"
              >
                Add {importReport.stats.accepted.toLocaleString()} words
              </PrimaryButton>

              <button
                type="button"
                onClick={handleCancelImport}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-medium text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* VIEW 5: ERASE ALL CONFIRMATION */}
        {view === 'erase-confirm' && (
          <div className="space-y-4 bg-[#231A19] border border-[#E85A3C]/30 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-[#E85A3C]">
              <AlertTriangle size={18} />
              <h2 className="text-sm font-semibold">Erase all dictionary entries</h2>
            </div>

            <p className="text-xs text-[#E0B4A8] leading-relaxed">
              This will remove all {totalDictionaryWords.toLocaleString()} entries from
              your dictionary. An undo copy will be kept in memory so you can restore
              them if needed.
            </p>

            <ErrorLine message={eraseError} />

            <div className="space-y-1.5">
              <label
                htmlFor="erase-input"
                className="block text-xs font-semibold uppercase tracking-wider text-[#8E9094]"
              >
                Type ERASE to confirm
              </label>
              <input
                id="erase-input"
                type="text"
                value={eraseConfirmText}
                onChange={(e) => setEraseConfirmText(e.target.value)}
                placeholder="ERASE"
                className="w-full min-h-[44px] px-3.5 bg-[#121315] border border-white/10 rounded-xl text-sm font-mono text-white placeholder-[#686A70] focus:outline-none focus:border-[#E85A3C]"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleEraseAll}
                disabled={eraseConfirmText !== 'ERASE'}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#E85A3C] hover:bg-[#D44F33] disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
                <span>Erase all</span>
              </button>

              <button
                type="button"
                onClick={() => setView('home')}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-medium text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </ToolScreenShell>
  );
};

export default MyDictionaryScreen;
