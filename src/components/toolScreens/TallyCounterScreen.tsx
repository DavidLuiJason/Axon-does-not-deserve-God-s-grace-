/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Tally Counter Screen: Count anything, as many as you like.
 * Uses the pure tally engine in src/tools/engines/time/tally.ts.
 * Counters and actions persist across reloads and screen switches via toolStore.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Minus,
  Plus,
  PlusCircle,
  RotateCcw,
  Trash2,
  Undo2,
} from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import { ErrorLine, OptionsDisclosure } from '../tools/ToolParts';
import {
  addCounter,
  changeTally,
  createTally,
  resetTally,
  undoTally,
  type TallyState,
} from '../../tools/engines/time/tally';
import { createToolStore } from '../../tools/shared/toolStore';

export const toolScreen = { toolId: 'tally-counter' };

export interface TallyCounterScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

export const TallyCounterScreen: React.FC<TallyCounterScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const store = useMemo(
    () =>
      createToolStore(
        'tally-counter',
        typeof window !== 'undefined' ? window.localStorage : undefined
      ),
    []
  );

  const [tally, setTally] = useState<TallyState>(() => createTally());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add counter state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCounterName, setNewCounterName] = useState('');
  const [newCounterStep, setNewCounterStep] = useState('1');

  // Rename counter state
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Confirmation state
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  // Restore saved state from toolStore on mount
  useEffect(() => {
    const res = store.get('saved_tally');
    if (res.ok && res.value && typeof res.value === 'object') {
      const restored = res.value as TallyState;
      if (restored.counters && typeof restored.counters === 'object') {
        setTally(restored);
        return;
      }
    }

    // Default first counter if completely brand new
    const init = addCounter(createTally(), 'Counter 1', 1);
    if (init.ok) {
      setTally(init.value);
      store.set('saved_tally', init.value);
    }
  }, [store]);

  const saveTally = (next: TallyState) => {
    setTally(next);
    store.set('saved_tally', next);
  };

  const handleIncrement = (name: string) => {
    setErrorMessage(null);
    const res = changeTally(tally, name, 1);
    if (!res.ok) {
      setErrorMessage(`Cannot count up: ${res.error}`);
      return;
    }
    saveTally(res.value);
  };

  const handleDecrement = (name: string) => {
    setErrorMessage(null);
    const res = changeTally(tally, name, -1);
    if (!res.ok) {
      setErrorMessage(`Cannot count down: ${res.error}`);
      return;
    }
    saveTally(res.value);
  };

  const handleUndo = () => {
    setErrorMessage(null);
    const res = undoTally(tally);
    if (!res.ok) {
      setErrorMessage(
        res.error === 'nothing-to-undo'
          ? 'Nothing to undo.'
          : `Cannot undo: ${res.error}`
      );
      return;
    }
    saveTally(res.value);
  };

  const handleAddCounterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const trimmed = newCounterName.trim();
    if (!trimmed) {
      setErrorMessage('Provide a name for the counter.');
      return;
    }

    const step = parseInt(newCounterStep, 10);
    const safeStep = isNaN(step) || step <= 0 ? 1 : step;

    const res = addCounter(tally, trimmed, safeStep);
    if (!res.ok) {
      if (res.error === 'counter-exists') {
        setErrorMessage(`A counter named "${trimmed}" already exists.`);
      } else {
        setErrorMessage(`Cannot add counter: ${res.error}`);
      }
      return;
    }

    saveTally(res.value);
    setNewCounterName('');
    setNewCounterStep('1');
    setShowAddForm(false);
  };

  const handleDelete = (name: string) => {
    setErrorMessage(null);
    const nextCounters = { ...tally.counters };
    delete nextCounters[name];
    const nextState: TallyState = {
      counters: nextCounters,
      history: tally.history,
    };
    saveTally(nextState);
    setConfirmDelete(null);
  };

  const handleRenameSubmit = (oldName: string) => {
    setErrorMessage(null);
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setErrorMessage('Provide a valid new name.');
      return;
    }
    if (trimmed !== oldName && tally.counters[trimmed]) {
      setErrorMessage(`A counter named "${trimmed}" already exists.`);
      return;
    }

    const current = tally.counters[oldName];
    if (!current) return;

    const nextCounters = { ...tally.counters };
    delete nextCounters[oldName];
    nextCounters[trimmed] = { ...current, name: trimmed };

    const nextState: TallyState = {
      counters: nextCounters,
      history: tally.history,
    };
    saveTally(nextState);
    setRenamingKey(null);
    setRenameValue('');
  };

  const handleResetAll = () => {
    setErrorMessage(null);
    const res = resetTally(tally);
    if (!res.ok) {
      setErrorMessage(`Cannot reset counters: ${res.error}`);
      return;
    }
    saveTally(res.value);
    setConfirmResetAll(false);
  };

  const handleResetSingle = (name: string) => {
    setErrorMessage(null);
    const res = resetTally(tally, name);
    if (!res.ok) {
      setErrorMessage(`Cannot reset counter: ${res.error}`);
      return;
    }
    saveTally(res.value);
  };

  const counterList = Object.values(tally.counters);

  return (
    <ToolScreenShell
      toolName="Tally Counter"
      tagline="Count anything, as many as you like"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-5">
        {errorMessage && <ErrorLine message={errorMessage} />}

        {/* Counter Rows */}
        <div className="space-y-3">
          {counterList.length === 0 ? (
            <div className="p-6 bg-[#18191C]/60 border border-white/5 rounded-2xl text-center space-y-2">
              <p className="text-sm font-medium text-white">No counters</p>
              <p className="text-xs text-[#8E9094]">
                Tap Add a counter below to start.
              </p>
            </div>
          ) : (
            counterList.map((counter) => (
              <div
                key={counter.name}
                className="p-4 bg-[#18191C] border border-white/10 rounded-2xl flex items-center justify-between gap-4"
              >
                {/* Name and step details */}
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-medium text-white truncate">
                    {counter.name}
                  </h3>
                  <div className="text-xs text-[#8E9094] flex items-center gap-2 mt-0.5">
                    {counter.step > 1 && <span>Step: {counter.step}</span>}
                    {counter.min !== undefined && <span>Min: {counter.min}</span>}
                    {counter.max !== undefined && <span>Max: {counter.max}</span>}
                  </div>
                </div>

                {/* Big Count and Buttons */}
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDecrement(counter.name)}
                    aria-label={`Decrement ${counter.name}`}
                    className="w-12 h-12 rounded-xl bg-white/10 hover:bg-white/15 text-white active:bg-white/20 transition-colors flex items-center justify-center cursor-pointer select-none"
                  >
                    <Minus size={20} />
                  </button>

                  <div className="min-w-[56px] text-center font-mono text-2xl sm:text-3xl font-medium text-white select-text tabular-nums px-1">
                    {counter.value.toLocaleString()}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleIncrement(counter.name)}
                    aria-label={`Increment ${counter.name}`}
                    className="w-12 h-12 rounded-xl bg-white text-black hover:bg-[#F0F0F0] active:bg-[#D0D0D0] transition-colors flex items-center justify-center cursor-pointer select-none shadow-sm"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Primary Screen Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex-1 min-h-[48px] px-5 py-2.5 rounded-xl bg-white text-black font-medium text-sm hover:bg-[#F0F0F0] transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            <PlusCircle size={17} />
            <span>Add a counter</span>
          </button>

          <button
            type="button"
            onClick={handleUndo}
            disabled={tally.history.length === 0}
            className="min-h-[48px] px-4 py-2.5 rounded-xl bg-white/10 text-white text-sm hover:bg-white/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            title="Undo last count"
          >
            <Undo2 size={16} />
            <span>Undo</span>
          </button>
        </div>

        {/* Add Counter Modal/Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddCounterSubmit}
            className="p-4 bg-[#18191C] border border-white/15 rounded-2xl space-y-3"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-white">
              Add New Counter
            </span>

            <div>
              <label
                htmlFor="counter-name"
                className="block text-xs text-[#8E9094] mb-1"
              >
                Counter Name
              </label>
              <input
                id="counter-name"
                type="text"
                value={newCounterName}
                onChange={(e) => setNewCounterName(e.target.value)}
                placeholder="e.g. Visitors, Laps, Items"
                autoFocus
                className="w-full min-h-[44px] bg-[#121315] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#E85A3C] transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="counter-step"
                className="block text-xs text-[#8E9094] mb-1"
              >
                Count Step (optional)
              </label>
              <input
                id="counter-step"
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min={1}
                value={newCounterStep}
                onChange={(e) => setNewCounterStep(e.target.value)}
                placeholder="1"
                className="w-full min-h-[44px] bg-[#121315] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#E85A3C] transition-colors font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewCounterName('');
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl text-xs text-[#8E9094] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 py-2 rounded-xl bg-white text-black font-medium text-xs hover:bg-[#F0F0F0] transition-colors cursor-pointer"
              >
                Add counter
              </button>
            </div>
          </form>
        )}

        {/* Options & Management */}
        <OptionsDisclosure title="Options">
          <div className="space-y-4 pt-1">
            {/* Manage Named Counters */}
            {counterList.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
                  Manage Counters
                </span>
                <div className="divide-y divide-white/5 border border-white/5 rounded-xl overflow-hidden bg-[#121315]">
                  {counterList.map((counter) => (
                    <div
                      key={counter.name}
                      className="p-3 flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        {renamingKey === counter.name ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              className="min-h-[36px] bg-[#1C1D21] border border-white/20 rounded-lg px-2.5 text-xs text-white flex-1"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleRenameSubmit(counter.name)}
                              className="px-2.5 py-1.5 rounded-lg bg-white text-black text-xs font-medium cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setRenamingKey(null)}
                              className="px-2 py-1.5 text-xs text-[#8E9094] hover:text-white cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-white truncate">
                              {counter.name}
                            </span>
                            <span className="text-xs text-[#8E9094] font-mono">
                              ({counter.value})
                            </span>
                          </div>
                        )}
                      </div>

                      {renamingKey !== counter.name && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingKey(counter.name);
                              setRenameValue(counter.name);
                            }}
                            className="min-h-[44px] px-2.5 py-1 text-xs text-[#9A9B9F] hover:text-white transition-colors cursor-pointer"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResetSingle(counter.name)}
                            className="min-h-[44px] px-2.5 py-1 text-xs text-[#9A9B9F] hover:text-white transition-colors cursor-pointer"
                          >
                            Reset
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(counter.name)}
                            className="min-h-[44px] px-2.5 py-1 text-xs text-[#E85A3C] hover:text-[#ff7455] transition-colors cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Delete Confirmation Dialog */}
            {confirmDelete && (
              <div className="p-3.5 rounded-xl bg-[#231A19] border border-[#E85A3C]/40 space-y-2">
                <div className="flex items-center gap-2 text-xs text-[#E0B4A8]">
                  <AlertTriangle size={15} className="text-[#E85A3C]" />
                  <span>
                    Delete &ldquo;{confirmDelete}&rdquo;? This cannot be undone.
                  </span>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(null)}
                    className="min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs text-[#ECECEC] hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(confirmDelete)}
                    className="min-h-[44px] px-4 py-1.5 rounded-lg bg-[#E85A3C] text-white text-xs font-medium hover:bg-[#ff6849] transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 size={13} />
                    <span>Confirm delete</span>
                  </button>
                </div>
              </div>
            )}

            {/* Reset All Counters */}
            {counterList.length > 0 && (
              <div className="pt-2 border-t border-white/5 space-y-2">
                {!confirmResetAll ? (
                  <button
                    type="button"
                    onClick={() => setConfirmResetAll(true)}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#D0D2D6] transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <RotateCcw size={14} />
                    <span>Reset all counters</span>
                  </button>
                ) : (
                  <div className="p-3.5 rounded-xl bg-[#231A19] border border-[#E85A3C]/40 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-[#E0B4A8]">
                      <AlertTriangle size={15} className="text-[#E85A3C]" />
                      <span>Reset all counters to zero?</span>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setConfirmResetAll(false)}
                        className="min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs text-[#ECECEC] hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleResetAll}
                        className="min-h-[44px] px-4 py-1.5 rounded-lg bg-[#E85A3C] text-white text-xs font-medium hover:bg-[#ff6849] transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <RotateCcw size={13} />
                        <span>Confirm reset all</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Engine Limits Notice */}
            <div className="pt-2 text-xs text-[#8E9094] space-y-1">
              <p>Engine limit: Up to 100 recent count actions kept in undo history.</p>
              <p>Numbers are limited to safe integers (9,007,199,254,740,991).</p>
            </div>
          </div>
        </OptionsDisclosure>
      </div>
    </ToolScreenShell>
  );
};

export default TallyCounterScreen;
