/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * QR Code Maker Screen: Turn text into a QR code.
 * Uses pure QR engine in src/tools/engines/create/qrCode.ts.
 */

import React, { useId, useMemo, useRef, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  ErrorLine,
  LabelledTextArea,
  OptionsDisclosure,
  SegmentedChoice,
  SingleLineField,
  SwitchRow,
} from '../tools/ToolParts';
import {
  makeQr,
  qrToSvg,
  qrCapacity,
  wifiPayload,
  emailPayload,
  phonePayload,
  linkPayload,
  QR_LIMITS,
  type QrLevel,
  type QrResult,
} from '../../tools/engines/create/qrCode';
import { saveFile } from '../../services/saveFile';

export const toolScreen = { toolId: 'qr-maker' };

export interface QrMakerScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

type PayloadKind = 'text' | 'link' | 'wifi' | 'phone' | 'email';
type WifiSecurity = 'WPA' | 'WEP' | 'nopass';

export const QrMakerScreen: React.FC<QrMakerScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [kind, setKind] = useState<PayloadKind>('text');
  const [level, setLevel] = useState<QrLevel>('M');

  // Payload form states
  const [textContent, setTextContent] = useState('https://axon.local');
  const [linkContent, setLinkContent] = useState('https://example.com');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiSecurity, setWifiSecurity] = useState<WifiSecurity>('WPA');
  const [wifiHidden, setWifiHidden] = useState(false);
  const [phoneContent, setPhoneContent] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const uniqueId = useId();

  // Compute raw payload text based on chosen kind
  const { payload, payloadError } = useMemo<{ payload: string; payloadError: string | null }>(() => {
    switch (kind) {
      case 'text':
        return { payload: textContent, payloadError: null };
      case 'link': {
        if (!linkContent.trim()) return { payload: '', payloadError: null };
        const res = linkPayload(linkContent);
        return res.ok ? { payload: res.payload, payloadError: null } : { payload: '', payloadError: res.message };
      }
      case 'wifi': {
        if (!wifiSsid.trim()) return { payload: '', payloadError: null };
        const res = wifiPayload({
          ssid: wifiSsid,
          password: wifiPassword,
          security: wifiSecurity,
          hidden: wifiHidden,
        });
        return res.ok ? { payload: res.payload, payloadError: null } : { payload: '', payloadError: res.message };
      }
      case 'phone': {
        if (!phoneContent.trim()) return { payload: '', payloadError: null };
        const res = phonePayload(phoneContent);
        return res.ok ? { payload: res.payload, payloadError: null } : { payload: '', payloadError: res.message };
      }
      case 'email': {
        if (!emailTo.trim()) return { payload: '', payloadError: null };
        const res = emailPayload(emailTo, emailSubject);
        if (!res.ok) return { payload: '', payloadError: res.message };
        const base = res.payload;
        const full = emailBody.trim()
          ? `${base}${emailSubject ? '&' : '?'}body=${encodeURIComponent(emailBody)}`
          : base;
        return { payload: full, payloadError: null };
      }
    }
  }, [
    kind,
    textContent,
    linkContent,
    wifiSsid,
    wifiPassword,
    wifiSecurity,
    wifiHidden,
    phoneContent,
    emailTo,
    emailSubject,
    emailBody,
  ]);

  // Compute QR code
  const qrResult: QrResult | null = useMemo(() => {
    if (payloadError || !payload.trim()) return null;
    return makeQr(payload, { level });
  }, [payload, level, payloadError]);

  // Render SVG string
  const svgMarkup = useMemo(() => {
    if (!qrResult || !qrResult.ok) return '';
    return qrToSvg(qrResult.modules, { quietZone: 4, moduleSize: 8 });
  }, [qrResult]);

  // Generate 1024x1024 PNG Blob from modules
  const generatePngBlob = async (modules: boolean[][]): Promise<Blob | null> => {
    const size = modules.length;
    const quietZone = 4;
    const totalModules = size + 2 * quietZone;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Fill clean white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1024, 1024);

    const scale = 1024 / totalModules;
    ctx.fillStyle = '#000000';

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (modules[y][x]) {
          const px = Math.round((x + quietZone) * scale);
          const py = Math.round((y + quietZone) * scale);
          const pw = Math.round((x + quietZone + 1) * scale) - px;
          const ph = Math.round((y + quietZone + 1) * scale) - py;
          ctx.fillRect(px, py, pw, ph);
        }
      }
    }

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  };

  const handleSave = async () => {
    if (!qrResult || !qrResult.ok) return;
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const blob = await generatePngBlob(qrResult.modules);
      if (!blob) throw new Error('Could not create picture.');
      const res = await saveFile('qr-code.png', blob, 'image/png');
      if (res.success) {
        setSaveStatus(res.message || 'Saved qr-code.png');
        setTimeout(() => setSaveStatus(null), 4000);
      } else {
        setSaveStatus(res.error || 'Failed to save picture.');
      }
    } catch (err: any) {
      setSaveStatus(err.message || 'Error creating picture.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    if (!qrResult || !qrResult.ok) return;
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const blob = await generatePngBlob(qrResult.modules);
      if (!blob) throw new Error('Could not create picture.');
      const file = new File([blob], 'qr-code.png', { type: 'image/png' });
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'QR Code',
          text: payload,
        });
      } else {
        // Fallback to saveFile which triggers native Capacitor share on Android
        const res = await saveFile('qr-code.png', blob, 'image/png');
        if (res.canShare && res.share) {
          await res.share();
        } else if (res.success) {
          setSaveStatus(res.message || 'Downloaded qr-code.png');
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setSaveStatus('Sharing failed or cancelled.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const maxCapacityBytes = qrCapacity(level)[9] ?? QR_LIMITS.maxInputBytes;

  return (
    <ToolScreenShell
      toolName="QR Code Maker"
      tagline="Turn text into a QR code"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-5">
        <p className="text-xs text-[#8E9094] italic">Files stay on your phone.</p>

        {/* Payload Type Choice Row */}
        <SegmentedChoice<PayloadKind>
          choices={[
            { id: 'text', label: 'Text' },
            { id: 'link', label: 'Link' },
            { id: 'wifi', label: 'Wi-Fi' },
            { id: 'phone', label: 'Phone' },
            { id: 'email', label: 'Email' },
          ]}
          value={kind}
          onChange={setKind}
        />

        {/* Input Fields for Chosen Type */}
        <div className="space-y-3">
          {kind === 'text' && (
            <LabelledTextArea
              id={`${uniqueId}-qr-text`}
              label="Content text"
              value={textContent}
              onChange={setTextContent}
              placeholder="Enter text or message to encode..."
              rows={4}
              maxLength={QR_LIMITS.maxInputBytes}
            />
          )}

          {kind === 'link' && (
            <SingleLineField
              id={`${uniqueId}-qr-link`}
              label="Website link"
              value={linkContent}
              onChange={setLinkContent}
              placeholder="https://example.com"
              maxLength={QR_LIMITS.maxInputBytes}
            />
          )}

          {kind === 'wifi' && (
            <div className="space-y-3">
              <SingleLineField
                id={`${uniqueId}-qr-wifi-ssid`}
                label="Network name (SSID)"
                value={wifiSsid}
                onChange={setWifiSsid}
                placeholder="MyNetwork"
                maxLength={32}
              />
              <SingleLineField
                id={`${uniqueId}-qr-wifi-pass`}
                label="Password"
                value={wifiPassword}
                onChange={setWifiPassword}
                placeholder="Network password"
                type="password"
              />
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
                  Security
                </span>
                <SegmentedChoice<WifiSecurity>
                  choices={[
                    { id: 'WPA', label: 'WPA / WPA2' },
                    { id: 'WEP', label: 'WEP' },
                    { id: 'nopass', label: 'None' },
                  ]}
                  value={wifiSecurity}
                  onChange={setWifiSecurity}
                />
              </div>
              <SwitchRow
                label="Hidden network"
                description="Network does not broadcast its SSID"
                checked={wifiHidden}
                onChange={setWifiHidden}
              />
            </div>
          )}

          {kind === 'phone' && (
            <SingleLineField
              id={`${uniqueId}-qr-phone`}
              label="Phone number"
              value={phoneContent}
              onChange={setPhoneContent}
              placeholder="+1234567890"
              maxLength={30}
            />
          )}

          {kind === 'email' && (
            <div className="space-y-3">
              <SingleLineField
                id={`${uniqueId}-qr-email-to`}
                label="To"
                value={emailTo}
                onChange={setEmailTo}
                placeholder="recipient@example.com"
              />
              <SingleLineField
                id={`${uniqueId}-qr-email-sub`}
                label="Subject"
                value={emailSubject}
                onChange={setEmailSubject}
                placeholder="Email subject"
              />
              <LabelledTextArea
                id={`${uniqueId}-qr-email-body`}
                label="Message"
                value={emailBody}
                onChange={setEmailBody}
                placeholder="Email body text..."
                rows={3}
              />
            </div>
          )}
        </div>

        {/* Error Notice */}
        {payloadError && <ErrorLine message={payloadError} />}

        {qrResult && !qrResult.ok && (
          <ErrorLine
            message={
              qrResult.error === 'too-long'
                ? `Input is too long: maximum ${qrResult.maxBytes ?? maxCapacityBytes} bytes at error correction level ${level}. Please shorten your input.`
                : qrResult.message
            }
          />
        )}

        {/* Live Large QR Code Display */}
        {qrResult && qrResult.ok && svgMarkup && (
          <div className="p-6 bg-[#18191C] border border-white/10 rounded-2xl flex flex-col items-center justify-center space-y-4">
            <div
              className="w-64 h-64 sm:w-72 sm:h-72 bg-white rounded-2xl p-4 shadow-lg flex items-center justify-center"
              dangerouslySetInnerHTML={{ __html: svgMarkup }}
            />
            <div className="text-xs text-[#8E9094] font-mono text-center">
              Version {qrResult.version} • Level {qrResult.level} • {qrResult.size}×{qrResult.size} modules
            </div>

            {/* Action Buttons: Save picture & Share */}
            <div className="flex items-center gap-3 w-full max-w-xs pt-1">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-[#F0F0F0] transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Download size={16} />
                <span>Save picture</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                disabled={isSaving}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Share2 size={16} />
                <span>Share</span>
              </button>
            </div>

            {saveStatus && (
              <p className="text-xs text-emerald-400 text-center pt-1">{saveStatus}</p>
            )}
          </div>
        )}

        {!payload.trim() && !payloadError && (
          <div className="p-4 bg-[#18191C]/50 border border-white/5 rounded-2xl text-xs text-[#8E9094] italic text-center">
            Enter content above to create your QR code.
          </div>
        )}

        {/* Options Row */}
        <OptionsDisclosure title="Options">
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
                Error correction
              </span>
              <SegmentedChoice<QrLevel>
                choices={[
                  { id: 'L', label: 'L (7%)' },
                  { id: 'M', label: 'M (15%)' },
                  { id: 'Q', label: 'Q (25%)' },
                  { id: 'H', label: 'H (30%)' },
                ]}
                value={level}
                onChange={setLevel}
              />
              <p className="text-[12px] text-[#8E9094] leading-normal pt-1">
                Higher error correction can be read even if damaged or obscured, but holds less data.
              </p>
            </div>
          </div>
        </OptionsDisclosure>
      </div>
    </ToolScreenShell>
  );
};

export default QrMakerScreen;
