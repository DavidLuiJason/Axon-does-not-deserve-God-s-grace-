/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Adjust and Filter tool sub-panels for ImageEditorScreen.
 * Matches THE AXON LOOK and existing sub-panels (Rotate, Flip, Crop, Resize) exactly.
 */

import React from 'react';
import type { AdjustParams } from '../../tools/imageEdit/adjust';
import { FILTERS, type FilterId } from '../../tools/imageEdit/filters';

interface AdjustPanelProps {
  values: AdjustParams;
  onChange: (next: AdjustParams) => void;
  onReset: () => void;
  onApply: () => void;
  onCancel: () => void;
}

export const AdjustPanel: React.FC<AdjustPanelProps> = ({
  values,
  onChange,
  onReset,
  onApply,
  onCancel,
}) => {
  const updateField = (key: keyof AdjustParams, val: number) => {
    onChange({
      ...values,
      [key]: val,
    });
  };

  const fields: { key: keyof AdjustParams; label: string }[] = [
    { key: 'brightness', label: 'Brightness' },
    { key: 'contrast', label: 'Contrast' },
    { key: 'saturation', label: 'Saturation' },
    { key: 'warmth', label: 'Warmth' },
  ];

  return (
    <div className="w-full flex flex-col gap-3">
      {/* 4 sliders: Brightness, Contrast, Saturation, Warmth */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
        {fields.map(({ key, label }) => {
          const val = values[key];
          return (
            <div key={key} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
                  {label}
                </span>
                <span className="text-sm text-[#D0D2D6]">
                  {val > 0 ? `+${val}` : val}
                </span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                step="1"
                value={val}
                onChange={(e) =>
                  updateField(key, parseInt(e.target.value, 10) || 0)
                }
                className="w-full h-2 rounded-lg bg-[#1C1D21] border border-white/10 accent-white cursor-pointer"
              />
            </div>
          );
        })}
      </div>

      {/* Buttons row: Apply, Cancel, and quiet Reset */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onApply}
          className="px-5 py-2.5 rounded-xl bg-white text-black font-medium text-sm hover:bg-[#F0F0F0] transition-colors cursor-pointer min-h-[44px]"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl hover:bg-white/5 text-[#D0D2D6] text-sm font-medium cursor-pointer transition-colors min-h-[44px]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onReset}
          className="px-4 py-2 rounded-xl hover:bg-white/5 text-[#8E9094] hover:text-[#D0D2D6] text-sm font-medium cursor-pointer transition-colors min-h-[44px]"
        >
          Reset
        </button>
      </div>
    </div>
  );
};

interface FiltersPanelProps {
  selectedFilter: FilterId | null;
  strength: number;
  onSelectFilter: (id: FilterId | null) => void;
  onChangeStrength: (val: number) => void;
  onApply: () => void;
  onCancel: () => void;
}

export const FiltersPanel: React.FC<FiltersPanelProps> = ({
  selectedFilter,
  strength,
  onSelectFilter,
  onChangeStrength,
  onApply,
  onCancel,
}) => {
  return (
    <div className="w-full flex flex-col gap-3">
      {/* Horizontal scrolling row of choices: None first, then each filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => onSelectFilter(null)}
          className={`px-3 py-1.5 rounded-xl text-sm transition-colors cursor-pointer min-h-[44px] shrink-0 ${
            selectedFilter === null
              ? 'bg-white/10 text-white font-medium'
              : 'bg-white/5 text-[#8E9094] hover:bg-white/10'
          }`}
        >
          None
        </button>
        {FILTERS.map((f) => {
          const isSelected = selectedFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onSelectFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-sm transition-colors cursor-pointer min-h-[44px] shrink-0 ${
                isSelected
                  ? 'bg-white/10 text-white font-medium'
                  : 'bg-white/5 text-[#8E9094] hover:bg-white/10'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* ONE slider Strength from 0 to 100, default 100, number shown */}
      <div className="flex flex-col gap-1.5 max-w-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
            Strength
          </span>
          <span className="text-sm text-[#D0D2D6]">{strength}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={strength}
          onChange={(e) =>
            onChangeStrength(parseInt(e.target.value, 10) || 0)
          }
          className="w-full h-2 rounded-lg bg-[#1C1D21] border border-white/10 accent-white cursor-pointer"
        />
      </div>

      {/* Primary Apply & Quiet Cancel buttons */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onApply}
          className="px-5 py-2.5 rounded-xl bg-white text-black font-medium text-sm hover:bg-[#F0F0F0] transition-colors cursor-pointer min-h-[44px]"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl hover:bg-white/5 text-[#D0D2D6] text-sm font-medium cursor-pointer transition-colors min-h-[44px]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
