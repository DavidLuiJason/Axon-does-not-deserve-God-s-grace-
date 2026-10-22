/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Encoder and Decoder Screen: Translate text to and from codes.
 * Uses the pure encodeDecode engine in src/tools/engines/create/encodeDecode.ts.
 */

import React, { useMemo, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  ErrorLine,
  LabelledTextArea,
  ResultBox,
  SegmentedChoice,
} from '../tools/ToolParts';
import {
  encodeDecode,
  type Encoding,
} from '../../tools/engines/create/encodeDecode';

export const toolScreen = { toolId: 'encoder-decoder' };

export interface EncoderDecoderScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

type Direction = 'encode' | 'decode';

const FORMAT_CHOICES: { id: Encoding; label: string }[] = [
  { id: 'base64', label: 'Base64' },
  { id: 'base64url', label: 'Base64URL' },
  { id: 'url', label: 'URL' },
  { id: 'html', label: 'HTML' },
  { id: 'hex', label: 'Hex' },
  { id: 'binary', label: 'Binary' },
  { id: 'rot13', label: 'ROT13' },
];

const DIRECTION_CHOICES: { id: Direction; label: string }[] = [
  { id: 'encode', label: 'Encode' },
  { id: 'decode', label: 'Decode' },
];

export const EncoderDecoderScreen: React.FC<EncoderDecoderScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [format, setFormat] = useState<Encoding>('base64');
  const [direction, setDirection] = useState<Direction>('encode');
  const [input, setInput] = useState('');

  // Process live conversion
  const result = useMemo(() => {
    if (!input) return null;
    return encodeDecode(direction, format, input);
  }, [direction, format, input]);

  const handleSwap = () => {
    if (result && result.ok) {
      setInput(result.value);
      setDirection(direction === 'encode' ? 'decode' : 'encode');
    }
  };

  const getErrorMessage = (error: string) => {
    switch (error) {
      case 'invalid-base64':
        return 'Invalid Base64 encoded string. Check characters and padding.';
      case 'invalid-hex':
        return 'Invalid hexadecimal format. Must contain an even number of hex digits (0-9, a-f).';
      case 'invalid-binary':
        return 'Invalid binary format. Must consist of 8-bit bytes (e.g. 01000001).';
      case 'invalid-html-entity':
        return 'Invalid HTML entity sequence.';
      case 'invalid-encoded-input':
        return 'Unable to decode input with the chosen format.';
      case 'invalid-input':
        return 'Invalid text input.';
      default:
        return `Error: ${error}`;
    }
  };

  return (
    <ToolScreenShell
      toolName="Encoder and Decoder"
      tagline="Translate text to and from codes"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-4">
        {/* Format choice row */}
        <SegmentedChoice<Encoding>
          label="Format"
          choices={FORMAT_CHOICES}
          value={format}
          onChange={setFormat}
        />

        {/* Direction choice row (Encode / Decode) */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <SegmentedChoice<Direction>
              label="Action"
              choices={DIRECTION_CHOICES}
              value={direction}
              onChange={setDirection}
            />
          </div>
          {result && result.ok && (
            <button
              type="button"
              onClick={handleSwap}
              className="mt-5 min-h-[44px] px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#9A9B9F] hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
              title="Swap input and result"
            >
              <ArrowLeftRight size={14} />
              <span>Swap</span>
            </button>
          )}
        </div>

        {/* Multi-line Input Field */}
        <LabelledTextArea
          id="encode-decode-input"
          label="Input"
          value={input}
          onChange={setInput}
          placeholder={
            direction === 'encode'
              ? 'Paste or type plain text to encode...'
              : `Paste ${format} encoded code to decode...`
          }
          rows={5}
          onClear={() => setInput('')}
        />

        {/* Error Line */}
        {result && !result.ok && (
          <ErrorLine message={getErrorMessage(result.error)} />
        )}

        {/* Result Box with Copy */}
        <ResultBox
          title={direction === 'encode' ? 'Encoded Output' : 'Decoded Output'}
          text={result && result.ok ? result.value : ''}
          emptyNotice="Result will appear here live..."
          onClear={() => setInput('')}
        />
      </div>
    </ToolScreenShell>
  );
};

export default EncoderDecoderScreen;
