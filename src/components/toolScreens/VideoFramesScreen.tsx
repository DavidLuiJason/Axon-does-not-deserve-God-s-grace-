/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * VideoFramesScreen: Extract pictures from a video as a zip archive.
 * Drives the pure frame planner and run engine (src/tools/engines/video/framePlan.ts, C20).
 * Opens the video in a hidden attached <video> element, estimates frame rate,
 * plans frame extraction against device tier limits, seeks to frame midpoints,
 * extracts via canvas, yields between frames to prevent UI lock, handles memory
 * caps via part zips, and saves the final result archive via saveFile.ts.
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Camera,
  CheckCircle2,
  Download,
  Film,
  RotateCcw,
  Share2,
  StopCircle,
  Upload,
  XCircle,
} from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  ErrorLine,
  NumberField,
  OptionsDisclosure,
  PrimaryButton,
  SegmentedChoice,
  SingleLineField,
} from '../tools/ToolParts';
import {
  createFrameRun,
  FRAME_LIMITS,
  frameFileNames,
  maxFramesForTier,
  parseTime,
  planFrames,
  zipEntries,
  type DeviceTier,
  type FramePlan,
  type FramePlanError,
  type FrameSpec,
  type FrameVideo,
  type PlannedFrame,
} from '../../tools/engines/video/framePlan';
import { createZip } from '../../tools/engines/files/zipTool';
import { saveFile, type SaveFileResult } from '../../services/saveFile';
import { getDeviceTier } from '../tools/deviceTier';
import type { ToolScreenProps } from '../../tools/screens/registry';

export const toolScreen = { toolId: 'video-frames' };

type ExtractionMode =
  | 'everyNSeconds'
  | 'everyNFrames'
  | 'count'
  | 'specific'
  | 'all';

const MODE_CHOICES = [
  { id: 'everyNSeconds', label: 'Every N seconds' },
  { id: 'everyNFrames', label: 'Every N frames' },
  { id: 'count', label: 'Evenly spaced' },
  { id: 'specific', label: 'Chosen times' },
  { id: 'all', label: 'Every frame' },
] as const;

type ImageFormat = 'png' | 'jpg' | 'webp';

const FORMAT_CHOICES = [
  { id: 'jpg', label: 'JPG' },
  { id: 'png', label: 'PNG' },
  { id: 'webp', label: 'WebP' },
] as const;

const QUALITY_CHOICES = [
  { id: '0.9', label: 'High (90%)' },
  { id: '0.8', label: 'Medium (80%)' },
  { id: '0.6', label: 'Compact (60%)' },
] as const;

const LONGEST_SIDE_CHOICES = [
  { id: 'Original', label: 'Original' },
  { id: '1920', label: '1920 px' },
  { id: '1280', label: '1280 px' },
  { id: '720', label: '720 px' },
] as const;

interface ThumbnailItem {
  index: number;
  url: string;
  timeMs: number;
  frameNumber: number;
}

interface CompletedItem {
  index: number;
  frame: PlannedFrame;
  bytes: Uint8Array;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    const remMin = minutes % 60;
    return `${hours}:${String(remMin).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function VideoFramesScreen({
  onBack,
  onLogoClick,
}: ToolScreenProps) {
  const deviceTier: DeviceTier = useMemo(() => getDeviceTier(), []);

  // Video State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<FrameVideo | null>(null);
  const [fpsEstimatedNotice, setFpsEstimatedNotice] = useState<string>('');
  const [videoError, setVideoError] = useState<string | null>(null);

  // Settings State
  const [mode, setMode] = useState<ExtractionMode>('everyNSeconds');
  const [everySeconds, setEverySeconds] = useState<string>('2');
  const [everyFrames, setEveryFrames] = useState<string>('30');
  const [totalCount, setTotalCount] = useState<string>('10');
  const [specificTimesText, setSpecificTimesText] = useState<string>('');
  const [specificTimesError, setSpecificTimesError] = useState<string | null>(
    null
  );

  // Range State
  const [startTimeText, setStartTimeText] = useState<string>('');
  const [endTimeText, setEndTimeText] = useState<string>('');
  const [rangeError, setRangeError] = useState<string | null>(null);

  // Options State
  const [format, setFormat] = useState<ImageFormat>('jpg');
  const [qualityStr, setQualityStr] = useState<string>('0.8');
  const [longestSide, setLongestSide] = useState<string>(
    deviceTier === 'low' ? '1280' : 'Original'
  );
  const [customFpsText, setCustomFpsText] = useState<string>('30');

  // Execution State
  const [runState, setRunState] = useState<
    'idle' | 'running' | 'cancelled' | 'done'
  >('idle');
  const [snapshot, setSnapshot] = useState<{
    total: number;
    done: number;
    failed: number;
  }>({ total: 0, done: 0, failed: 0 });
  const [completedItems, setCompletedItems] = useState<CompletedItem[]>([]);
  const [thumbnails, setThumbnails] = useState<ThumbnailItem[]>([]);
  const [partZipsNotice, setPartZipsNotice] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<SaveFileResult | null>(null);
  const [isSavingZip, setIsSavingZip] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cancelledRef = useRef(false);
  const createdUrlsRef = useRef<string[]>([]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      for (const u of createdUrlsRef.current) {
        try {
          URL.revokeObjectURL(u);
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const handleChooseFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset previous run and video state
    if (videoObjectUrl) {
      URL.revokeObjectURL(videoObjectUrl);
    }
    for (const u of createdUrlsRef.current) {
      try {
        URL.revokeObjectURL(u);
      } catch {
        // ignore
      }
    }
    createdUrlsRef.current = [];

    setSelectedFile(file);
    setVideoInfo(null);
    setVideoError(null);
    setRunState('idle');
    setCompletedItems([]);
    setThumbnails([]);
    setPartZipsNotice([]);
    setStatusMessage(null);
    setSaveResult(null);

    const objUrl = URL.createObjectURL(file);
    setVideoObjectUrl(objUrl);
    createdUrlsRef.current.push(objUrl);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Inspect video metadata and estimate fps when video loads
  useEffect(() => {
    if (!videoObjectUrl || !videoRef.current) return;
    const video = videoRef.current;
    let cancelled = false;

    const onLoadedMetadata = async () => {
      if (cancelled) return;
      const durationSec = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;

      if (!Number.isFinite(durationSec) || durationSec <= 0 || width <= 0 || height <= 0) {
        setVideoError('This phone cannot play this kind of video.');
        return;
      }

      const durationMs = Math.round(durationSec * 1000);

      // Estimate FPS with requestVideoFrameCallback or fallback to 30
      let estimatedFps = 30;
      let usedAssumed = true;

      if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
        try {
          const fpsMeasurePromise = new Promise<{ fps: number; measured: boolean }>(
            (resolve) => {
              const timestamps: number[] = [];
              let frameHandle: number | null = null;
              let timer: any = null;

              const cleanup = () => {
                if (timer) clearTimeout(timer);
                try {
                  video.pause();
                  video.currentTime = 0;
                } catch {
                  // ignore
                }
              };

              const onFrame = (now: DOMHighResTimeStamp, metadata?: any) => {
                if (cancelled) {
                  cleanup();
                  resolve({ fps: 30, measured: false });
                  return;
                }
                const t =
                  metadata?.mediaTime !== undefined
                    ? metadata.mediaTime * 1000
                    : now;
                timestamps.push(t);

                if (timestamps.length >= 45 || video.ended) {
                  cleanup();
                  compute();
                } else {
                  frameHandle = (video as any).requestVideoFrameCallback(onFrame);
                }
              };

              const compute = () => {
                if (timestamps.length < 5) {
                  resolve({ fps: 30, measured: false });
                  return;
                }
                const intervals: number[] = [];
                for (let i = 1; i < timestamps.length; i++) {
                  const d = timestamps[i] - timestamps[i - 1];
                  if (d > 0 && d < 400) intervals.push(d);
                }
                if (intervals.length < 4) {
                  resolve({ fps: 30, measured: false });
                  return;
                }
                intervals.sort((a, b) => a - b);
                const medianInterval = intervals[Math.floor(intervals.length / 2)];
                if (medianInterval <= 0) {
                  resolve({ fps: 30, measured: false });
                  return;
                }
                let rawFps = 1000 / medianInterval;
                const standardValues = [24, 25, 29.97, 30, 50, 59.94, 60];
                for (const std of standardValues) {
                  if (Math.abs(rawFps - std) < 1.25) {
                    rawFps = std;
                    break;
                  }
                }
                resolve({ fps: Math.round(rawFps * 100) / 100, measured: true });
              };

              timer = setTimeout(() => {
                cleanup();
                compute();
              }, 2000);

              video.currentTime = 0;
              video
                .play()
                .then(() => {
                  frameHandle = (video as any).requestVideoFrameCallback(onFrame);
                })
                .catch(() => {
                  cleanup();
                  resolve({ fps: 30, measured: false });
                });
            }
          );

          const result = await fpsMeasurePromise;
          if (!cancelled && result.measured) {
            estimatedFps = result.fps;
            usedAssumed = false;
          }
        } catch {
          estimatedFps = 30;
          usedAssumed = true;
        }
      }

      if (cancelled) return;

      const vInfo: FrameVideo = {
        durationMs,
        fps: estimatedFps,
        width,
        height,
      };

      setVideoInfo(vInfo);
      setCustomFpsText(String(estimatedFps));
      setFpsEstimatedNotice(
        usedAssumed
          ? `about ${estimatedFps} frames a second (assumed)`
          : `about ${estimatedFps} frames a second`
      );
      setVideoError(null);
    };

    const onError = () => {
      if (!cancelled) {
        setVideoError('This phone cannot play this kind of video.');
      }
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
    video.addEventListener('error', onError, { once: true });

    return () => {
      cancelled = true;
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('error', onError);
    };
  }, [videoObjectUrl]);

  // Active FPS (from videoInfo or user override)
  const currentFps = useMemo(() => {
    const val = Number(customFpsText);
    if (Number.isFinite(val) && val > 0 && val <= 240) {
      return val;
    }
    return videoInfo?.fps ?? 30;
  }, [customFpsText, videoInfo]);

  // Parse range
  const parsedRange = useMemo(() => {
    setRangeError(null);
    if (!videoInfo) return undefined;
    const startStr = startTimeText.trim();
    const endStr = endTimeText.trim();

    if (!startStr && !endStr) return undefined;

    let startMs = 0;
    let endMs = videoInfo.durationMs;

    if (startStr) {
      const p = parseTime(startStr);
      if (!p.ok) {
        setRangeError(`Start time: ${p.message}`);
        return null;
      }
      startMs = p.milliseconds;
    }

    if (endStr) {
      const p = parseTime(endStr);
      if (!p.ok) {
        setRangeError(`End time: ${p.message}`);
        return null;
      }
      endMs = p.milliseconds;
    }

    if (startMs >= endMs) {
      setRangeError('Start time must be strictly before end time.');
      return null;
    }
    if (endMs > videoInfo.durationMs) {
      setRangeError('End time exceeds the video duration.');
      return null;
    }

    return { startMs, endMs };
  }, [startTimeText, endTimeText, videoInfo]);

  // Parse specific times
  const parsedSpecificTimes = useMemo(() => {
    setSpecificTimesError(null);
    if (mode !== 'specific') return undefined;
    const text = specificTimesText.trim();
    if (!text) {
      setSpecificTimesError('Enter one or more times (e.g. 5s, 1:23.5).');
      return null;
    }

    const tokens = text.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean);
    if (tokens.length === 0) {
      setSpecificTimesError('Enter one or more times.');
      return null;
    }

    const timesMs: number[] = [];
    for (const t of tokens) {
      const res = parseTime(t);
      if (!res.ok) {
        setSpecificTimesError(`"${t}": ${res.message}`);
        return null;
      }
      timesMs.push(res.milliseconds);
    }
    return timesMs;
  }, [mode, specificTimesText]);

  // Plan frames
  const planResult = useMemo<FramePlan | FramePlanError | null>(() => {
    if (!videoInfo || parsedRange === null) return null;

    const effectiveVideo: FrameVideo = {
      ...videoInfo,
      fps: currentFps,
    };

    let spec: FrameSpec;

    if (mode === 'everyNSeconds') {
      const sec = Number(everySeconds);
      if (!Number.isFinite(sec) || sec < 0.001) return null;
      spec = { mode: 'everyNSeconds', seconds: sec };
    } else if (mode === 'everyNFrames') {
      const n = Number(everyFrames);
      if (!Number.isSafeInteger(n) || n < 1) return null;
      spec = { mode: 'everyNFrames', n };
    } else if (mode === 'count') {
      const c = Number(totalCount);
      if (!Number.isSafeInteger(c) || c < 1) return null;
      spec = { mode: 'count', count: c };
    } else if (mode === 'specific') {
      if (!parsedSpecificTimes || parsedSpecificTimes.length === 0) return null;
      spec = { mode: 'specific', timesMs: parsedSpecificTimes };
    } else {
      spec = { mode: 'all' };
    }

    if (parsedRange) {
      spec.range = parsedRange;
    }

    return planFrames(effectiveVideo, spec, deviceTier);
  }, [
    videoInfo,
    currentFps,
    mode,
    everySeconds,
    everyFrames,
    totalCount,
    parsedSpecificTimes,
    parsedRange,
    deviceTier,
  ]);

  // Estimated bytes for current format
  const estimatedBytes = useMemo(() => {
    if (!planResult || !planResult.ok) return 0;
    return format === 'png'
      ? planResult.estimate.estimatedPngBytes
      : planResult.estimate.estimatedJpgBytes;
  }, [planResult, format]);

  // Seek video with timeout
  const seekVideoTo = useCallback(
    (video: HTMLVideoElement, timeSeconds: number): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        let timer: any = null;
        const onSeeked = () => {
          clearTimeout(timer);
          video.removeEventListener('seeked', onSeeked);
          resolve(true);
        };
        timer = setTimeout(() => {
          video.removeEventListener('seeked', onSeeked);
          resolve(false);
        }, 8000);
        video.addEventListener('seeked', onSeeked);

        const clamped = Math.min(Math.max(0, timeSeconds), video.duration || timeSeconds);
        video.currentTime = clamped;
      });
    },
    []
  );

  // Handle saving part zip when memory cap is reached
  const savePartZip = async (
    items: { index: number; frame: PlannedFrame; bytes: Uint8Array }[],
    partIndex: number,
    baseName: string
  ) => {
    try {
      const namesRes = frameFileNames(
        baseName,
        items.map((it) => it.frame),
        format
      );
      if (!namesRes.ok) return;

      const zipRows = items.map((it, i) => ({
        name: namesRes.names[i],
        bytes: it.bytes,
      }));
      const entriesRes = zipEntries(zipRows);
      if (!entriesRes.ok) return;

      const zipRes = await createZip(entriesRes.entries, { store: false });
      if (!zipRes.ok) return;

      const partFileName = `${baseName}_part${partIndex}.zip`;
      const blob = new Blob([zipRes.value], { type: 'application/zip' });
      await saveFile(partFileName, blob);
      setPartZipsNotice((prev) => [
        ...prev,
        `Part ${partIndex} (${items.length} pictures) saved to prevent memory limit`,
      ]);
    } catch (err: any) {
      console.warn('Failed to save part zip:', err);
    }
  };

  // Run frame extraction
  const handleTakePictures = async () => {
    if (!videoRef.current || !planResult || !planResult.ok || !selectedFile) {
      return;
    }

    const video = videoRef.current;
    const plan = planResult;
    const baseName = selectedFile.name.replace(/\.[^/.]+$/, '') || 'video';

    setRunState('running');
    setStatusMessage(null);
    setSaveResult(null);
    setCompletedItems([]);
    setThumbnails([]);
    setPartZipsNotice([]);
    cancelledRef.current = false;

    const run = createFrameRun(plan, {
      maxHeldBytes: FRAME_LIMITS.defaultMaxHeldBytes,
    });
    setSnapshot(run.snapshot());

    // Canvas setup
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setStatusMessage('Canvas 2D context unavailable.');
      setRunState('idle');
      return;
    }

    const newThumbnails: ThumbnailItem[] = [];
    const allCompleted: CompletedItem[] = [];
    let partIndex = 1;
    let isCancelled = false;

    try {
      while (true) {
        if (cancelledRef.current) {
          run.cancel();
          isCancelled = true;
          break;
        }

        const item = run.next();
        if (!item) break;

        setSnapshot(run.snapshot());

        // Seek to middle of frame: (frameNumber + 0.5) / fps
        const seekSeconds = (item.frameNumber + 0.5) / currentFps;
        const seekSuccess = await seekVideoTo(video, seekSeconds);

        if (!seekSuccess) {
          run.complete(item.index, {
            ok: false,
            message: 'Seek timed out after 8 seconds.',
          });
          setSnapshot(run.snapshot());
          continue;
        }

        // Draw frame to canvas at chosen size
        let targetW = video.videoWidth;
        let targetH = video.videoHeight;

        if (longestSide !== 'Original') {
          const maxDim = Number(longestSide);
          if (Math.max(targetW, targetH) > maxDim) {
            if (targetW >= targetH) {
              targetH = Math.round((targetH * maxDim) / targetW);
              targetW = maxDim;
            } else {
              targetW = Math.round((targetW * maxDim) / targetH);
              targetH = maxDim;
            }
          }
        }

        canvas.width = targetW;
        canvas.height = targetH;
        ctx.drawImage(video, 0, 0, targetW, targetH);

        const mimeType =
          format === 'png'
            ? 'image/png'
            : format === 'jpg'
            ? 'image/jpeg'
            : 'image/webp';
        const qualityVal = format === 'png' ? undefined : Number(qualityStr);

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, mimeType, qualityVal)
        );

        if (!blob) {
          run.complete(item.index, {
            ok: false,
            message: 'Could not create image blob.',
          });
          setSnapshot(run.snapshot());
          continue;
        }

        // Keep thumbnail for first 12 pictures
        if (newThumbnails.length < 12) {
          const thumbUrl = URL.createObjectURL(blob);
          createdUrlsRef.current.push(thumbUrl);
          newThumbnails.push({
            index: item.index,
            url: thumbUrl,
            timeMs: item.timeMs,
            frameNumber: item.frameNumber,
          });
          setThumbnails([...newThumbnails]);
        }

        const arrayBuf = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);

        let compRes = run.complete(item.index, { ok: true, bytes });
        allCompleted.push({ index: item.index, frame: item, bytes });

        if (!compRes.ok && compRes.error === 'memory-cap') {
          const drained = run.drain();
          if (drained.length > 0) {
            await savePartZip(drained, partIndex++, baseName);
          }
          compRes = run.complete(item.index, { ok: true, bytes });
        }

        setSnapshot(run.snapshot());

        // Yield to browser/UI paint
        await new Promise((r) => setTimeout(r, 0));
      }
    } finally {
      // Free canvas
      canvas.width = 0;
      canvas.height = 0;

      const finalSnap = run.snapshot();
      setSnapshot(finalSnap);
      setCompletedItems(allCompleted);
      setRunState(isCancelled ? 'cancelled' : 'done');
    }
  };

  const handleCancel = () => {
    cancelledRef.current = true;
  };

  const handleSaveAllZip = async () => {
    if (!selectedFile || completedItems.length === 0) return;
    setIsSavingZip(true);
    setStatusMessage(null);
    setSaveResult(null);

    try {
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '') || 'video';
      const namesRes = frameFileNames(
        baseName,
        completedItems.map((c) => c.frame),
        format
      );

      if (!namesRes.ok) {
        setStatusMessage(namesRes.message);
        setIsSavingZip(false);
        return;
      }

      const zipRows = completedItems.map((c, i) => ({
        name: namesRes.names[i],
        bytes: c.bytes,
      }));

      const validated = zipEntries(zipRows);
      if (!validated.ok) {
        setStatusMessage(validated.message);
        setIsSavingZip(false);
        return;
      }

      const zipRes = await createZip(validated.entries, { store: false });
      if (!zipRes.ok) {
        setStatusMessage(zipRes.message);
        setIsSavingZip(false);
        return;
      }

      const zipFileName = `${baseName}_frames.zip`;
      const blob = new Blob([zipRes.value], { type: 'application/zip' });
      const result = await saveFile(zipFileName, blob);
      setSaveResult(result);
      if (!result.success) {
        setStatusMessage(result.message || 'Saving zip failed.');
      }
    } catch (err: any) {
      setStatusMessage(err?.message || 'Error creating ZIP file.');
    } finally {
      setIsSavingZip(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setVideoInfo(null);
    setVideoError(null);
    setRunState('idle');
    setCompletedItems([]);
    setThumbnails([]);
    setPartZipsNotice([]);
    setStatusMessage(null);
    setSaveResult(null);
    if (videoObjectUrl) {
      URL.revokeObjectURL(videoObjectUrl);
      setVideoObjectUrl(null);
    }
    for (const u of createdUrlsRef.current) {
      try {
        URL.revokeObjectURL(u);
      } catch {
        // ignore
      }
    }
    createdUrlsRef.current = [];
  };

  return (
    <ToolScreenShell
      toolName="Video Frames"
      tagline="Extract pictures from a video as a zip archive"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-4">
        {/* Hidden attached video element for frame extraction and playback */}
        <video
          ref={videoRef}
          src={videoObjectUrl ?? undefined}
          muted
          playsInline
          preload="metadata"
          className="fixed -left-[9999px] top-0 opacity-0 pointer-events-none w-1 h-1"
          aria-hidden="true"
        />

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Choose video file"
        />

        {/* 1. CHOOSE A VIDEO */}
        <div className="p-4 rounded-xl bg-[#18191C] border border-white/10 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
              Video Source
            </span>
            {selectedFile && runState !== 'running' && (
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-[#8E9094] hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Change video</span>
              </button>
            )}
          </div>

          {!selectedFile ? (
            <button
              type="button"
              onClick={handleChooseFileClick}
              className="w-full min-h-[52px] px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium text-[#ECECEC] transition-colors cursor-pointer flex items-center justify-center gap-2.5 border border-white/10"
            >
              <Upload size={16} className="text-[#8E9094]" />
              <span>Choose a video</span>
            </button>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-[#ECECEC]">
                <Film size={16} className="text-[#8E9094] shrink-0" />
                <span className="font-medium truncate">{selectedFile.name}</span>
                <span className="text-xs text-[#8E9094] shrink-0">
                  ({formatBytes(selectedFile.size)})
                </span>
              </div>

              {/* Quiet video stats line */}
              {videoInfo && !videoError && (
                <p className="text-xs text-[#8E9094] pl-6 break-words">
                  {videoInfo.width} × {videoInfo.height},{' '}
                  {formatDuration(videoInfo.durationMs)}, {fpsEstimatedNotice}
                </p>
              )}
            </div>
          )}

          {/* Plain unplayable video error */}
          {videoError && <ErrorLine message={videoError} />}
        </div>

        {/* CONTROLS (Only visible if video is loaded and playable) */}
        {videoInfo && !videoError && (
          <>
            {/* 2. WHAT TO TAKE (One Picker) */}
            <div className="space-y-3">
              <SegmentedChoice<ExtractionMode>
                label="What to take"
                choices={MODE_CHOICES}
                value={mode}
                onChange={(m) => {
                  setMode(m);
                  setRunState('idle');
                }}
              />

              {/* Individual field for the chosen mode */}
              {mode === 'everyNSeconds' && (
                <NumberField
                  label="Interval in seconds"
                  value={everySeconds}
                  onChange={setEverySeconds}
                  min={0.01}
                  step={0.5}
                  numeric="decimal"
                  placeholder="e.g. 2"
                  hint="Takes a picture every N seconds throughout the video or selected range"
                />
              )}

              {mode === 'everyNFrames' && (
                <NumberField
                  label="Interval in frames"
                  value={everyFrames}
                  onChange={setEveryFrames}
                  min={1}
                  step={1}
                  numeric="integer"
                  placeholder="e.g. 30"
                  hint="Takes every Nth video frame"
                />
              )}

              {mode === 'count' && (
                <NumberField
                  label="Number of pictures"
                  value={totalCount}
                  onChange={setTotalCount}
                  min={1}
                  step={1}
                  numeric="integer"
                  placeholder="e.g. 10"
                  hint="Takes evenly spaced pictures across the video"
                />
              )}

              {mode === 'specific' && (
                <div className="space-y-1">
                  <SingleLineField
                    label="Chosen times"
                    value={specificTimesText}
                    onChange={(v) => {
                      setSpecificTimesText(v);
                      setRunState('idle');
                    }}
                    placeholder="e.g. 5s, 12.5s, 01:23.5"
                    hint="Enter times separated by commas or spaces"
                  />
                  {specificTimesError && (
                    <ErrorLine message={specificTimesError} />
                  )}
                </div>
              )}
            </div>

            {/* PART OF THE VIDEO (Start and End Times) */}
            <OptionsDisclosure title="Part of the video">
              <div className="space-y-2.5 pt-1">
                <p className="text-xs text-[#8E9094]">
                  Leave empty to extract across the entire video.
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <SingleLineField
                    label="Start time"
                    value={startTimeText}
                    onChange={(v) => {
                      setStartTimeText(v);
                      setRunState('idle');
                    }}
                    placeholder="e.g. 0 or 10s"
                  />
                  <SingleLineField
                    label="End time"
                    value={endTimeText}
                    onChange={(v) => {
                      setEndTimeText(v);
                      setRunState('idle');
                    }}
                    placeholder={`e.g. ${formatDuration(videoInfo.durationMs)}`}
                  />
                </div>
                {rangeError && <ErrorLine message={rangeError} />}
              </div>
            </OptionsDisclosure>

            {/* OPTIONS (Picture Type, Quality, Longest Side, Frame Rate) */}
            <OptionsDisclosure title="Options">
              <div className="space-y-3.5 pt-1">
                <SegmentedChoice<ImageFormat>
                  label="Picture type"
                  choices={FORMAT_CHOICES}
                  value={format}
                  onChange={setFormat}
                />

                {(format === 'jpg' || format === 'webp') && (
                  <SegmentedChoice<string>
                    label="Quality"
                    choices={QUALITY_CHOICES}
                    value={qualityStr}
                    onChange={setQualityStr}
                  />
                )}

                <SegmentedChoice<string>
                  label="Longest side"
                  choices={LONGEST_SIDE_CHOICES}
                  value={longestSide}
                  onChange={setLongestSide}
                />

                <NumberField
                  label="Frame rate (fps)"
                  value={customFpsText}
                  onChange={setCustomFpsText}
                  min={1}
                  max={240}
                  step={1}
                  numeric="decimal"
                  hint="Adjust if the automatic estimate does not match the video"
                />
              </div>
            </OptionsDisclosure>

            {/* 3. PLAN BEFORE RUNNING */}
            <div className="p-3.5 rounded-xl bg-[#161719] border border-white/5 space-y-1.5">
              {planResult && planResult.ok && (
                <p className="text-xs text-[#ECECEC] leading-relaxed break-words">
                  This will make {planResult.estimate.count.toLocaleString()}{' '}
                  pictures, about {formatBytes(estimatedBytes)} (an estimate).
                </p>
              )}

              {/* Too-many pictures refusal from the planner */}
              {planResult && !planResult.ok && planResult.error === 'too-many' && (
                <div className="space-y-1">
                  <p className="text-xs text-[#E0B4A8] leading-normal font-medium">
                    Too many pictures requested ({planResult.count?.toLocaleString()} requested, device cap is {planResult.cap?.toLocaleString()}).
                  </p>
                  {planResult.suggestion && (
                    <p className="text-xs text-[#8E9094] leading-normal">
                      {planResult.suggestion}
                    </p>
                  )}
                </div>
              )}

              {/* Other planner error */}
              {planResult &&
                !planResult.ok &&
                planResult.error !== 'too-many' && (
                  <ErrorLine
                    message={planResult.message || 'Invalid planning options.'}
                  />
                )}

              {/* Planner warnings */}
              {planResult &&
                planResult.ok &&
                planResult.warnings.length > 0 && (
                  <div className="space-y-0.5 pt-1">
                    {planResult.warnings.map((w, idx) => (
                      <p key={idx} className="text-[11px] text-[#8E9094]">
                        {w}
                      </p>
                    ))}
                  </div>
                )}
            </div>

            {/* 4. RUN ACTION OR PROGRESS */}
            {runState === 'idle' && (
              <PrimaryButton
                onClick={handleTakePictures}
                disabled={!planResult || !planResult.ok}
                className="w-full"
                icon={<Camera size={16} />}
              >
                Take pictures
              </PrimaryButton>
            )}

            {runState === 'running' && (
              <div className="space-y-3 p-4 rounded-xl bg-[#18191C] border border-white/10">
                <div className="flex items-center justify-between text-xs text-[#ECECEC]">
                  <span className="font-medium">
                    Extracting pictures ({snapshot.done} of {snapshot.total})
                  </span>
                  <span className="text-[#8E9094]">
                    {snapshot.total > 0
                      ? `${Math.round((snapshot.done * 100) / snapshot.total)}%`
                      : '0%'}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#E85A3C] transition-all duration-150"
                    style={{
                      width: `${
                        snapshot.total > 0
                          ? Math.min(100, (snapshot.done / snapshot.total) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-[#8E9094]">
                    {snapshot.failed > 0 && `${snapshot.failed} failed • `}
                    Yielding between frames
                  </span>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-[#E0B4A8] hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 border border-white/5"
                  >
                    <StopCircle size={14} />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>
            )}

            {/* Error or status message */}
            <ErrorLine message={statusMessage} />

            {/* Part zips notices if memory cap was triggered */}
            {partZipsNotice.length > 0 && (
              <div className="space-y-1 p-3 bg-white/5 rounded-xl border border-white/5 text-xs text-[#8E9094]">
                {partZipsNotice.map((notice, idx) => (
                  <p key={idx}>{notice}</p>
                ))}
              </div>
            )}

            {/* 5. RESULTS PRESENTATION */}
            {(runState === 'done' || runState === 'cancelled') && (
              <div className="space-y-4 pt-2">
                {/* Result counts header */}
                <div className="p-3.5 rounded-xl bg-[#18191C] border border-white/10 space-y-1">
                  <div className="flex items-center gap-2">
                    {runState === 'done' ? (
                      <CheckCircle2 size={16} className="text-emerald-400" />
                    ) : (
                      <XCircle size={16} className="text-amber-400" />
                    )}
                    <span className="text-sm font-medium text-white">
                      {completedItems.length}{' '}
                      {completedItems.length === 1 ? 'picture' : 'pictures'}{' '}
                      made
                      {snapshot.failed > 0 && `, ${snapshot.failed} failed`}
                      {runState === 'cancelled' && ' (cancelled)'}
                    </span>
                  </div>
                </div>

                {/* Thumbnails grid (first 12 pictures) */}
                {thumbnails.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
                      Preview (First {thumbnails.length})
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {thumbnails.map((thumb) => (
                        <div
                          key={thumb.index}
                          className="relative aspect-video rounded-lg overflow-hidden bg-black/40 border border-white/10 group"
                        >
                          <img
                            src={thumb.url}
                            alt={`Frame ${thumb.frameNumber}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-0 inset-x-0 bg-black/75 px-1.5 py-0.5 text-[10px] text-[#ECECEC] font-mono truncate">
                            {formatDuration(thumb.timeMs)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Save and Share Actions */}
                <div className="space-y-2">
                  <PrimaryButton
                    onClick={handleSaveAllZip}
                    disabled={completedItems.length === 0 || isSavingZip}
                    loading={isSavingZip}
                    className="w-full"
                    icon={<Download size={16} />}
                  >
                    Save all as zip
                  </PrimaryButton>

                  {saveResult?.success && (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                      <p className="text-xs text-emerald-400">
                        {saveResult.message || `Saved ${saveResult.fileName}`}
                      </p>
                      {saveResult.canShare && saveResult.share && (
                        <button
                          type="button"
                          onClick={() => saveResult.share?.()}
                          className="min-h-[44px] w-full px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-[#ECECEC] transition-colors cursor-pointer flex items-center justify-center gap-2 border border-white/5"
                        >
                          <Share2 size={14} className="text-[#8E9094]" />
                          <span>Share zip archive</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ToolScreenShell>
  );
}
