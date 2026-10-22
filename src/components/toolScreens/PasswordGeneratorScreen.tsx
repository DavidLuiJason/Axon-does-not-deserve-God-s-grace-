/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Password Generator Screen: Strong passwords on demand.
 * Uses the pure passwordGenerator engine in src/tools/engines/create/passwordGenerator.ts.
 */

import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, RefreshCw } from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  ErrorLine,
  NumberField,
  OptionsDisclosure,
  PrimaryButton,
  ResultBox,
  SwitchRow,
} from '../tools/ToolParts';
import {
  passwordGenerator,
  type PasswordOutput,
} from '../../tools/engines/create/passwordGenerator';

export const toolScreen = { toolId: 'password-generator' };

export interface PasswordGeneratorScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

export const PasswordGeneratorScreen: React.FC<PasswordGeneratorScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [length, setLength] = useState('16');
  const [lower, setLower] = useState(true);
  const [upper, setUpper] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [excludeLookAlikes, setExcludeLookAlikes] = useState(false);

  // Display state
  const [showPassword, setShowPassword] = useState(true);
  const [output, setOutput] = useState<PasswordOutput | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Generate password using engine with browser crypto
  const generate = () => {
    const len = Number(length);
    if (!Number.isInteger(len) || len < 4 || len > 128) {
      setErrorMsg('Password length must be an integer between 4 and 128 characters.');
      setOutput(null);
      return;
    }

    if (!lower && !upper && !digits && !symbols) {
      setErrorMsg('Select at least one character set (lowercase, uppercase, digits, or symbols).');
      setOutput(null);
      return;
    }

    const res = passwordGenerator({
      length: len,
      lower,
      upper,
      digits,
      symbols,
      excludeLookAlikes,
    });

    if (res.ok) {
      setOutput(res);
      setErrorMsg(null);
    } else {
      setOutput(null);
      switch (res.error) {
        case 'invalid-length':
          setErrorMsg('Length must be between 4 and 128 characters.');
          break;
        case 'no-character-sets':
          setErrorMsg('At least one character set must be enabled.');
          break;
        case 'length-too-short-for-sets':
          setErrorMsg('Length is too short to include all chosen character sets.');
          break;
        default:
          setErrorMsg(`Generation failed: ${res.error}`);
      }
    }
  };

  // Generate on initial mount
  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maskedPassword = output
    ? showPassword
      ? output.password
      : '•'.repeat(output.password.length)
    : '';

  return (
    <ToolScreenShell
      toolName="Password Generator"
      tagline="Strong passwords on demand"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-4">
        {/* Length Input */}
        <div className="space-y-2">
          <NumberField
            id="password-length"
            label="Length (4 to 128)"
            value={length}
            numeric="integer"
            onChange={(v) => setLength(String(v))}
            placeholder="16"
            min={4}
            max={128}
          />
          <div className="flex gap-2">
            {[12, 16, 24, 32].map((quickLen) => (
              <button
                key={quickLen}
                type="button"
                onClick={() => setLength(String(quickLen))}
                className={`min-h-[40px] flex-1 py-1 px-2 rounded-xl text-xs font-mono font-medium transition-colors cursor-pointer ${
                  length === String(quickLen)
                    ? 'bg-white text-black font-semibold'
                    : 'bg-[#1C1D21] text-[#9A9B9F] hover:bg-white/5 hover:text-white border border-white/5'
                }`}
              >
                {quickLen}
              </button>
            ))}
          </div>
        </div>

        {/* Character Set Switches */}
        <div className="p-3 bg-[#18191C] border border-white/5 rounded-xl space-y-1">
          <SwitchRow
            label="Lowercase letters"
            description="abcdefghijklmnopqrstuvwxyz"
            checked={lower}
            onChange={setLower}
          />
          <SwitchRow
            label="Uppercase letters"
            description="ABCDEFGHIJKLMNOPQRSTUVWXYZ"
            checked={upper}
            onChange={setUpper}
          />
          <SwitchRow
            label="Digits"
            description="0123456789"
            checked={digits}
            onChange={setDigits}
          />
          <SwitchRow
            label="Symbols"
            description="!@#$%^&*()-_=+[]{};:,."
            checked={symbols}
            onChange={setSymbols}
          />
        </div>

        {/* Generate Button */}
        <div className="pt-1">
          <PrimaryButton
            onClick={generate}
            icon={<RefreshCw size={16} />}
            className="w-full"
          >
            Generate
          </PrimaryButton>
        </div>

        {/* Error Line */}
        {errorMsg && <ErrorLine message={errorMsg} />}

        {/* Result Box with Show/Hide toggle and Copy */}
        {output && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-semibold uppercase tracking-wider text-[#8E9094]">
                Password
              </span>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-[#9A9B9F] hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>{showPassword ? 'Hide' : 'Show'}</span>
              </button>
            </div>

            <ResultBox
              title="Generated Password"
              text={maskedPassword}
              copyText={output.password}
            />

            {/* Engine strength / entropy line */}
            <div className="flex items-center gap-2 px-1 text-xs text-[#9A9B9F]">
              <KeyRound size={13} className="text-[#E85A3C]" />
              <span>
                Strength: ~{Math.round(output.entropyBits)} bits of entropy
              </span>
            </div>
          </div>
        )}

        {/* Options */}
        <OptionsDisclosure title="Options">
          <SwitchRow
            label="Exclude look-alike characters"
            description="Avoid ambiguous characters: 0, O, 1, l, I, |"
            checked={excludeLookAlikes}
            onChange={setExcludeLookAlikes}
          />
        </OptionsDisclosure>
      </div>
    </ToolScreenShell>
  );
};

export default PasswordGeneratorScreen;
