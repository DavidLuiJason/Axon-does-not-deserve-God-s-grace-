/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Image Editor: multi-picture tray (open many, add, replace, remove), rotate, flip,
 * crop, resize, per-picture edits, undo, redo, reset, and save.
 * Follows THE AXON LOOK strictly.
 */

import React, { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react';
import { App } from '@capacitor/app';
import {
  Crop,
  FlipHorizontal,
  Image as ImageIcon,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Scaling,
  SlidersHorizontal,
  Trash2,
  Type,
  Undo2,
  Wand2,
} from 'lucide-react';
import { ScreenHeader } from '../ScreenHeader';
import { MediaStrip } from './MediaStrip';
import { CropOverlay } from './CropOverlay';
import { ZoomStage } from './ZoomStage';
import { renderOps } from './ImagePipeline';
import {
  applyOp,
  canRedo,
  canUndo,
  emptyHistory,
  outputSize,
  redo,
  reset,
  undo,
  type EditHistory,
  type EditOp,
} from '../../tools/imageEdit/history';
import {
  CROP_SHAPES,
  cropForShape,
  resizeTo,
  type Rect,
  type ResizeRequest,
} from '../../tools/imageEdit/cropResize';
import {
  activeEntry,
  addPictures,
  emptySet,
  removePictures,
  replacePicture,
  roomLeft,
  selectPicture,
  setHistory,
  type PictureSet,
} from '../../tools/imageEdit/pictureSet';
import { saveFile } from '../../services/saveFile';
import { AdjustPanel, FiltersPanel } from './AdjustFilterPanels';
import {
  applyAdjust,
  NEUTRAL_ADJUST,
  isNeutralAdjust,
  type AdjustParams,
} from '../../tools/imageEdit/adjust';
import {
  applyFilter,
  type FilterId,
} from '../../tools/imageEdit/filters';

interface ImageEditorScreenProps {
  onBack: () => void;
  onLogoClick?: () => void;
}

type ActivePanel =
  | 'rotate'
  | 'flip'
  | 'crop'
  | 'resize'
  | 'save'
  | 'adjust'
  | 'filters'
  | null;
type SaveFormat = 'png' | 'jpg' | 'webp';
type FilePickerMode = 'open' | 'add' | 'replace';
type ResizeMode = 'percent' | 'width' | 'height' | 'exact';

function formatTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const HH = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${YYYY}${MM}${DD}-${HH}${mm}${ss}`;
}

async function createThumbnail(file: File): Promise<string> {
  const tempBitmap = await createImageBitmap(file);
  const maxDim = Math.max(tempBitmap.width, tempBitmap.height);
  const scale = maxDim > 88 ? 88 / maxDim : 1;
  const tw = Math.max(1, Math.round(tempBitmap.width * scale));
  const th = Math.max(1, Math.round(tempBitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(tempBitmap, 0, 0, tw, th);
  }
  tempBitmap.close();
  return canvas.toDataURL('image/jpeg', 0.8);
}

async function loadBitmapFromFile(
  file: File
): Promise<{ bitmap: ImageBitmap; scaled: boolean }> {
  let loadedBitmap = await createImageBitmap(file);
  let scaled = false;
  const maxDim = Math.max(loadedBitmap.width, loadedBitmap.height);
  if (maxDim > 4096) {
    const ratio = 4096 / maxDim;
    const targetW = Math.round(loadedBitmap.width * ratio);
    const targetH = Math.round(loadedBitmap.height * ratio);

    const offscreen = document.createElement('canvas');
    offscreen.width = targetW;
    offscreen.height = targetH;
    const offCtx = offscreen.getContext('2d');
    if (offCtx) {
      offCtx.drawImage(loadedBitmap, 0, 0, targetW, targetH);
      loadedBitmap.close();
      loadedBitmap = await createImageBitmap(offscreen);
      scaled = true;
    }
  }
  return { bitmap: loadedBitmap, scaled };
}

export const ImageEditorScreen: React.FC<ImageEditorScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workAreaRef = useRef<HTMLDivElement>(null);
  const stageHostRef = useRef<HTMLDivElement>(null);
  const filePickerModeRef = useRef<FilePickerMode>('open');

  // PictureSet (state) and actual File map (keyed by picture id)
  const [pictureSet, setPictureSet] = useState<PictureSet>(emptySet);
  const filesMapRef = useRef<Map<string, File>>(new Map());
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  // Active picture bitmap (Phone safety: only one full-size bitmap kept decoded)
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const [hasPicture, setHasPicture] = useState(false);
  // Bumped every time a new picture finishes decoding, so the canvas redraws even when no other state changed
  const [bitmapVersion, setBitmapVersion] = useState(0);

  // Active sub-panel
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [fullPictureView, setFullPictureView] = useState(false);
  const toggleFullPictureView = useCallback(() => {
    if (activePanel === 'crop') return;
    setFullPictureView((current) => !current);
  }, [activePanel]);

  // Android Back exits full-picture view before leaving the editor.
  useEffect(() => {
    if (!fullPictureView) return;
    let disposed = false;
    let listener: { remove: () => Promise<void> } | undefined;
    App.addListener('backButton', () => setFullPictureView(false)).then((handle) => {
      if (disposed) void handle.remove();
      else listener = handle;
    }).catch(() => { /* Browser preview may not expose the native Back event. */ });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault();
        setFullPictureView(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      disposed = true;
      if (listener) void listener.remove();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [fullPictureView]);

  // Crop panel state
  const [selectedCropShape, setSelectedCropShape] = useState<string>('free');
  const [cropRect, setCropRect] = useState<Rect>({ x: 0, y: 0, width: 0, height: 0 });

  // Resize panel state
  const [resizeMode, setResizeMode] = useState<ResizeMode>('percent');
  const [resizePercent, setResizePercent] = useState<number>(50);
  const [resizeWidth, setResizeWidth] = useState<number>(0);
  const [resizeHeight, setResizeHeight] = useState<number>(0);

  // Adjust and Filters states
  const [adjustParams, setAdjustParams] = useState<AdjustParams>(NEUTRAL_ADJUST);
  const [selectedFilter, setSelectedFilter] = useState<FilterId | null>(null);
  const [filterStrength, setFilterStrength] = useState<number>(100);

  // Live preview refs and state (Phone safety: max 1024px longest side preview)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const basePreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const basePixelsRef = useRef<Uint8ClampedArray | null>(null);
  const baseDimsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const lastPreviewTimeRef = useRef<number>(0);
  const previewTimerRef = useRef<number | null>(null);
  const latestParamsRef = useRef<{
    adjust: AdjustParams;
    filterId: FilterId | null;
    strength: number;
  }>({ adjust: NEUTRAL_ADJUST, filterId: null, strength: 100 });

  // Canvas display coordinates for crop overlay
  const [canvasDisplayBox, setCanvasDisplayBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  }>({ left: 0, top: 0, width: 0, height: 0 });

  // Remove mode state
  const [removeMode, setRemoveMode] = useState(false);
  const [selectedRemoveIds, setSelectedRemoveIds] = useState<string[]>([]);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  // Save format & status
  const [saveFormat, setSaveFormat] = useState<SaveFormat>('png');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'error' | null>(null);

  // Notices
  const [scaledNotice, setScaledNotice] = useState(false);
  const [limitNotice, setLimitNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Clean up bitmap and preview resources on unmount
  useEffect(() => {
    return () => {
      if (previewTimerRef.current !== null) {
        clearTimeout(previewTimerRef.current);
      }
      if (bitmapRef.current) {
        bitmapRef.current.close();
        bitmapRef.current = null;
      }
      if (basePreviewCanvasRef.current) {
        basePreviewCanvasRef.current.width = 0;
        basePreviewCanvasRef.current.height = 0;
        basePreviewCanvasRef.current = null;
      }
    };
  }, []);

  const active = activeEntry(pictureSet);
  const currentHistory: EditHistory = active ? active.history : emptyHistory();

  // Current output dimensions of active picture
  const currentOutputSize = bitmapRef.current
    ? outputSize(bitmapRef.current.width, bitmapRef.current.height, currentHistory.ops)
    : { width: 0, height: 0 };

  const updateCanvasDisplayBox = useCallback(() => {
    const canvas = canvasRef.current;
    const container = stageHostRef.current || workAreaRef.current;
    if (!canvas || !container) return;
    const cRect = canvas.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();
    setCanvasDisplayBox({
      left: Math.round(cRect.left - contRect.left),
      top: Math.round(cRect.top - contRect.top),
      width: Math.round(cRect.width),
      height: Math.round(cRect.height),
    });
  }, []);

  // Window resize updates canvas display box
  useEffect(() => {
    window.addEventListener('resize', updateCanvasDisplayBox);
    return () => {
      window.removeEventListener('resize', updateCanvasDisplayBox);
    };
  }, [updateCanvasDisplayBox]);

  // Redraw canvas via the step-by-step pipeline
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const bitmap = bitmapRef.current;
    if (!canvas || !bitmap) return;

    const rendered = renderOps(bitmap, currentHistory.ops);
    canvas.width = rendered.width;
    canvas.height = rendered.height;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(rendered, 0, 0);
    }

    // Release intermediate rendered canvas
    rendered.width = 0;
    rendered.height = 0;

    requestAnimationFrame(updateCanvasDisplayBox);
  }, [currentHistory.ops, updateCanvasDisplayBox, bitmapVersion]);

  useLayoutEffect(() => {
    if (hasPicture) {
      redrawCanvas();
    }
  }, [hasPicture, redrawCanvas]);

  // Initialize base downscaled copy when adjust or filters panel opens
  useEffect(() => {
    if (activePanel !== 'adjust' && activePanel !== 'filters') {
      if (previewTimerRef.current !== null) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
      if (basePreviewCanvasRef.current) {
        basePreviewCanvasRef.current.width = 0;
        basePreviewCanvasRef.current.height = 0;
        basePreviewCanvasRef.current = null;
      }
      basePixelsRef.current = null;
      baseDimsRef.current = { width: 0, height: 0 };
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const maxSide = Math.max(cw, ch);
    const scale = maxSide > 1024 ? 1024 / maxSide : 1;
    const pw = Math.max(1, Math.round(cw * scale));
    const ph = Math.max(1, Math.round(ch * scale));

    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = pw;
    baseCanvas.height = ph;
    const bCtx = baseCanvas.getContext('2d');
    if (bCtx) {
      bCtx.drawImage(canvas, 0, 0, pw, ph);
      try {
        const data = bCtx.getImageData(0, 0, pw, ph);
        basePixelsRef.current = new Uint8ClampedArray(data.data);
      } catch {
        basePixelsRef.current = null;
      }
    }
    basePreviewCanvasRef.current = baseCanvas;
    baseDimsRef.current = { width: pw, height: ph };
    lastPreviewTimeRef.current = 0;
  }, [activePanel]);

  const updatePreview = useCallback(
    (
      panel: 'adjust' | 'filters',
      adjust: AdjustParams,
      filterId: FilterId | null,
      strength: number
    ) => {
      const previewCanvas = previewCanvasRef.current;
      const baseCanvas = basePreviewCanvasRef.current;
      const basePixels = basePixelsRef.current;
      const { width: pw, height: ph } = baseDimsRef.current;

      if (!previewCanvas || pw === 0 || ph === 0) return;

      if (previewCanvas.width !== pw || previewCanvas.height !== ph) {
        previewCanvas.width = pw;
        previewCanvas.height = ph;
      }

      const ctx = previewCanvas.getContext('2d');
      if (!ctx) return;

      if (!basePixels || !baseCanvas) {
        // If unreadable canvas, show unmodified picture and do not crash
        if (baseCanvas) {
          ctx.clearRect(0, 0, pw, ph);
          ctx.drawImage(baseCanvas, 0, 0);
        } else if (canvasRef.current) {
          ctx.clearRect(0, 0, pw, ph);
          ctx.drawImage(canvasRef.current, 0, 0, pw, ph);
        }
        return;
      }

      try {
        let resultPixels: Uint8ClampedArray = basePixels;
        if (panel === 'adjust') {
          resultPixels = applyAdjust(basePixels, adjust);
        } else if (panel === 'filters') {
          if (filterId && strength > 0) {
            resultPixels = applyFilter(basePixels, filterId, strength);
          }
        }
        const imgData = ctx.createImageData(pw, ph);
        imgData.data.set(resultPixels);
        ctx.putImageData(imgData, 0, 0);
      } catch {
        // Unreadable canvas fallback: show unmodified picture and do not crash
        if (baseCanvas) {
          ctx.clearRect(0, 0, pw, ph);
          ctx.drawImage(baseCanvas, 0, 0);
        }
      }
    },
    []
  );

  // Throttled preview updater (recompute at most about every 80 ms while sliders move)
  useEffect(() => {
    if (activePanel !== 'adjust' && activePanel !== 'filters') return;

    latestParamsRef.current = {
      adjust: adjustParams,
      filterId: selectedFilter,
      strength: filterStrength,
    };

    const runUpdate = () => {
      lastPreviewTimeRef.current = performance.now();
      updatePreview(
        activePanel,
        latestParamsRef.current.adjust,
        latestParamsRef.current.filterId,
        latestParamsRef.current.strength
      );
    };

    const now = performance.now();
    const elapsed = now - lastPreviewTimeRef.current;

    if (elapsed >= 80) {
      if (previewTimerRef.current !== null) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
      runUpdate();
    } else {
      if (previewTimerRef.current === null) {
        previewTimerRef.current = window.setTimeout(() => {
          previewTimerRef.current = null;
          runUpdate();
        }, 80 - elapsed);
      }
    }
  }, [activePanel, adjustParams, selectedFilter, filterStrength, updatePreview]);

  // Handle switching picture selection in the tray
  const handleSelectPicture = async (id: string) => {
    if (id === pictureSet.activeId) return;

    const nextSet = selectPicture(pictureSet, id);
    setPictureSet(nextSet);
    setErrorMessage(null);
    setSaveStatus(null);
    setActivePanel(null);

    if (bitmapRef.current) {
      bitmapRef.current.close();
      bitmapRef.current = null;
    }

    const file = filesMapRef.current.get(id);
    if (file) {
      try {
        const { bitmap, scaled } = await loadBitmapFromFile(file);
        bitmapRef.current = bitmap;
        setBitmapVersion((v) => v + 1);
        setScaledNotice(scaled);
      } catch {
        setErrorMessage('That file could not be opened as a picture.');
      }
    }
  };

  // Open file handler (handles Open, Add, Replace)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const selectedFiles = Array.from(fileList);

    // Reset input so picking identical files works
    e.target.value = '';

    setErrorMessage(null);
    setSaveStatus(null);
    const mode = filePickerModeRef.current;

    if (mode === 'replace') {
      const activeEntryItem = activeEntry(pictureSet);
      if (!activeEntryItem) return;

      const file = selectedFiles[0];
      try {
        const { bitmap, scaled } = await loadBitmapFromFile(file);
        if (bitmapRef.current) {
          bitmapRef.current.close();
        }
        bitmapRef.current = bitmap;
        setBitmapVersion((v) => v + 1);
        filesMapRef.current.set(activeEntryItem.id, file);

        const thumb = await createThumbnail(file);
        setThumbnails((prev) => ({ ...prev, [activeEntryItem.id]: thumb }));

        const nextSet = replacePicture(pictureSet, activeEntryItem.id, file.name);
        setPictureSet(nextSet);
        setScaledNotice(scaled);
        setActivePanel(null);
      } catch {
        setErrorMessage('That file could not be opened as a picture.');
      }
      return;
    }

    // Open or Add mode
    const names = selectedFiles.map((f) => f.name);
    const isInitial = pictureSet.items.length === 0;
    const { set: nextSet, addedIds, refused } = addPictures(
      pictureSet,
      names,
      isInitial
    );

    if (refused > 0) {
      setLimitNotice('Up to 8 pictures at a time, to keep your phone fast.');
    } else {
      setLimitNotice(null);
    }

    if (addedIds.length === 0) return;

    // Store accepted files into map and create thumbnails
    const newThumbs: Record<string, string> = {};
    for (let i = 0; i < addedIds.length; i++) {
      const id = addedIds[i];
      const file = selectedFiles[i];
      filesMapRef.current.set(id, file);
      try {
        const thumb = await createThumbnail(file);
        newThumbs[id] = thumb;
      } catch {
        // Thumbnail generation failed, fallback handled gracefully
      }
    }
    setThumbnails((prev) => ({ ...prev, ...newThumbs }));

    // If no active bitmap or activeId changed, decode the active one
    const activeTargetId = nextSet.activeId;
    if (activeTargetId && (!bitmapRef.current || isInitial)) {
      if (bitmapRef.current) {
        bitmapRef.current.close();
        bitmapRef.current = null;
      }
      const activeFile = filesMapRef.current.get(activeTargetId);
      if (activeFile) {
        try {
          const { bitmap, scaled } = await loadBitmapFromFile(activeFile);
          bitmapRef.current = bitmap;
          setBitmapVersion((v) => v + 1);
          setScaledNotice(scaled);
        } catch {
          setErrorMessage('That file could not be opened as a picture.');
        }
      }
    }

    setPictureSet(nextSet);
    setHasPicture(true);
    setActivePanel(null);
  };

  // Operation dispatch for active picture
  const handleApplyOp = (op: EditOp) => {
    const activeItem = activeEntry(pictureSet);
    if (!activeItem) return;
    const nextHistory = applyOp(activeItem.history, op);
    setPictureSet((prev) => setHistory(prev, activeItem.id, nextHistory));
  };

  const handleUndo = () => {
    const activeItem = activeEntry(pictureSet);
    if (!activeItem || !canUndo(activeItem.history) || activePanel !== null) return;
    const nextHistory = undo(activeItem.history);
    setPictureSet((prev) => setHistory(prev, activeItem.id, nextHistory));
  };

  const handleRedo = () => {
    const activeItem = activeEntry(pictureSet);
    if (!activeItem || !canRedo(activeItem.history) || activePanel !== null) return;
    const nextHistory = redo(activeItem.history);
    setPictureSet((prev) => setHistory(prev, activeItem.id, nextHistory));
  };

  const handleReset = () => {
    const activeItem = activeEntry(pictureSet);
    if (!activeItem || activePanel !== null) return;
    const nextHistory = reset(activeItem.history);
    setPictureSet((prev) => setHistory(prev, activeItem.id, nextHistory));
    setActivePanel(null);
  };

  const togglePanel = (panel: ActivePanel) => {
    if (!hasPicture) return;
    setRemoveMode(false);
    setSelectedRemoveIds([]);
    setConfirmingRemove(false);

    if (activePanel === panel) {
      setActivePanel(null);
      return;
    }

    if (panel === 'crop') {
      const curSize = currentOutputSize;
      setSelectedCropShape('free');
      setCropRect(cropForShape(curSize.width, curSize.height, null));
      setActivePanel('crop');
      requestAnimationFrame(updateCanvasDisplayBox);
    } else if (panel === 'resize') {
      const curSize = currentOutputSize;
      setResizeMode('percent');
      setResizePercent(50);
      setResizeWidth(curSize.width);
      setResizeHeight(curSize.height);
      setActivePanel('resize');
    } else if (panel === 'adjust') {
      setAdjustParams({ ...NEUTRAL_ADJUST });
      setActivePanel('adjust');
    } else if (panel === 'filters') {
      setSelectedFilter(null);
      setFilterStrength(100);
      setActivePanel('filters');
    } else {
      setActivePanel(panel);
    }
  };

  // Crop panel handlers
  const handleSelectCropShape = (shapeId: string, ratio: number | null) => {
    setSelectedCropShape(shapeId);
    setCropRect(cropForShape(currentOutputSize.width, currentOutputSize.height, ratio));
  };

  const handleApplyCrop = () => {
    if (cropRect.width <= 0 || cropRect.height <= 0) {
      setActivePanel(null);
      return;
    }
    handleApplyOp({
      type: 'crop',
      x: cropRect.x,
      y: cropRect.y,
      width: cropRect.width,
      height: cropRect.height,
    });
    setActivePanel(null);
  };

  const handleCancelCrop = () => {
    setActivePanel(null);
  };

  // Resize panel handlers
  const currentResizeRequest: ResizeRequest =
    resizeMode === 'percent'
      ? { mode: 'percent', value: resizePercent }
      : resizeMode === 'width'
      ? { mode: 'width', value: resizeWidth }
      : resizeMode === 'height'
      ? { mode: 'height', value: resizeHeight }
      : { mode: 'exact', width: resizeWidth, height: resizeHeight };

  const resizeResult = resizeTo(
    currentOutputSize.width,
    currentOutputSize.height,
    currentResizeRequest
  );

  const handleApplyResize = () => {
    handleApplyOp({
      type: 'resize',
      width: resizeResult.width,
      height: resizeResult.height,
    });
    setActivePanel(null);
  };

  const handleCancelResize = () => {
    setActivePanel(null);
  };

  // Adjust panel handlers
  const handleApplyAdjust = () => {
    if (!isNeutralAdjust(adjustParams)) {
      handleApplyOp({
        type: 'adjust',
        brightness: adjustParams.brightness,
        contrast: adjustParams.contrast,
        saturation: adjustParams.saturation,
        warmth: adjustParams.warmth,
      });
    }
    setActivePanel(null);
  };

  const handleCancelAdjust = () => {
    setActivePanel(null);
  };

  // Filters panel handlers
  const handleApplyFilters = () => {
    if (selectedFilter !== null && filterStrength > 0) {
      handleApplyOp({
        type: 'filter',
        id: selectedFilter,
        strength: filterStrength,
      });
    }
    setActivePanel(null);
  };

  const handleCancelFilters = () => {
    setActivePanel(null);
  };

  // Remove mode handlers
  const handleToggleSelectRemove = (id: string) => {
    setSelectedRemoveIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleExecuteRemove = async () => {
    const idsToRemove = selectedRemoveIds;
    if (idsToRemove.length === 0) return;

    idsToRemove.forEach((id) => filesMapRef.current.delete(id));
    setThumbnails((prev) => {
      const next = { ...prev };
      idsToRemove.forEach((id) => delete next[id]);
      return next;
    });

    const nextSet = removePictures(pictureSet, idsToRemove);
    setPictureSet(nextSet);
    setSelectedRemoveIds([]);
    setConfirmingRemove(false);
    setRemoveMode(false);
    setLimitNotice(null);

    if (nextSet.items.length === 0 || nextSet.activeId === null) {
      if (bitmapRef.current) {
        bitmapRef.current.close();
        bitmapRef.current = null;
      }
      setHasPicture(false);
      setActivePanel(null);
      setScaledNotice(false);
      return;
    }

    // Decode the new active picture
    if (nextSet.activeId !== pictureSet.activeId || !bitmapRef.current) {
      if (bitmapRef.current) {
        bitmapRef.current.close();
        bitmapRef.current = null;
      }
      const nextFile = filesMapRef.current.get(nextSet.activeId);
      if (nextFile) {
        try {
          const { bitmap, scaled } = await loadBitmapFromFile(nextFile);
          bitmapRef.current = bitmap;
          setBitmapVersion((v) => v + 1);
          setScaledNotice(scaled);
        } catch {
          setErrorMessage('That file could not be opened as a picture.');
        }
      }
    }
  };

  // Save handler for active picture (always matches on-screen canvas)
  const handleSavePicture = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasPicture) return;

    setSaveStatus(null);

    let exportCanvas: HTMLCanvasElement = canvas;
    if (saveFormat === 'jpg') {
      exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const ctx = exportCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        ctx.drawImage(canvas, 0, 0);
      }
    }

    const mimeType =
      saveFormat === 'png'
        ? 'image/png'
        : saveFormat === 'jpg'
        ? 'image/jpeg'
        : 'image/webp';
    const quality = saveFormat === 'png' ? undefined : 0.92;

    exportCanvas.toBlob(
      async (blob) => {
        if (exportCanvas !== canvas) {
          exportCanvas.width = 0;
          exportCanvas.height = 0;
        }
        if (!blob) {
          setSaveStatus('error');
          return;
        }
        const stamp = formatTimestamp(new Date());
        const filename = `axon-image-${stamp}.${saveFormat}`;
        const res = await saveFile(filename, blob, mimeType);
        if (res.success) {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus(null), 3000);
        } else {
          setSaveStatus('error');
        }
      },
      mimeType,
      quality
    );
  };

  const stripItems = pictureSet.items.map((p) => ({
    id: p.id,
    name: p.name,
    thumb: thumbnails[p.id],
  }));

  const canAdd = roomLeft(pictureSet) > 0;
  const isToolInactive = !hasPicture || activePanel !== null;
  const isPreviewActive =
    hasPicture && (activePanel === 'adjust' || activePanel === 'filters');

  const currentCropShapeObj = CROP_SHAPES.find((s) => s.id === selectedCropShape);
  const currentRatio = currentCropShapeObj ? currentCropShapeObj.ratio : null;

  return (
    <div className="relative w-full h-full flex flex-col bg-[#121315] text-[#ECECEC] overflow-hidden font-sans">
      {!fullPictureView && <ScreenHeader
        title="Image Editor"
        tagline="IMAGE EDITOR"
        backLabel="MEDIA"
        collapsible
        onBack={onBack}
        onLogoClick={onLogoClick ?? (() => {})}
      />}

      {/* Hidden file input with multiple support */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* A. Action row */}
      {!fullPictureView && <div className="px-5 h-12 flex items-center justify-between border-b border-white/5 bg-[#121315] shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!hasPicture || activePanel !== null || !canUndo(currentHistory)}
            aria-label="Undo"
            title="Undo"
            className="w-11 h-11 rounded-xl hover:bg-white/5 text-[#D0D2D6] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center cursor-pointer transition-colors"
          >
            <Undo2 size={18} />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={!hasPicture || activePanel !== null || !canRedo(currentHistory)}
            aria-label="Redo"
            title="Redo"
            className="w-11 h-11 rounded-xl hover:bg-white/5 text-[#D0D2D6] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center cursor-pointer transition-colors"
          >
            <Redo2 size={18} />
          </button>
        </div>

        <div>
          <button
            type="button"
            onClick={() => togglePanel('save')}
            disabled={
              !hasPicture ||
              activePanel === 'crop' ||
              activePanel === 'resize' ||
              activePanel === 'adjust' ||
              activePanel === 'filters'
            }
            className="px-4 py-2 rounded-xl bg-white text-black font-medium text-sm hover:bg-[#F0F0F0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>}

      {/* B. Work area */}
      <div
        ref={workAreaRef}
        className={fullPictureView
          ? 'fixed inset-0 z-50 bg-[#141517] overflow-hidden'
          : 'relative flex-1 min-h-0 bg-[#141517] overflow-hidden'}
        style={fullPictureView ? {
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)'
        } : undefined}
      >
        {!hasPicture ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center space-y-3 p-4">
            <ImageIcon size={36} className="text-[#5A5C62]" />
            <p className="text-sm text-[#8E9094]">Open a picture to start.</p>
            <button
              type="button"
              onClick={() => {
                filePickerModeRef.current = 'open';
                fileInputRef.current?.click();
              }}
              className="px-5 py-2.5 rounded-xl bg-white text-black font-medium text-sm hover:bg-[#F0F0F0] transition-colors cursor-pointer"
            >
              Open picture
            </button>
            <p className="text-[11.5px] text-[#7A7C82]">
              The picture stays on your phone.
            </p>
            {limitNotice && (
              <p className="text-xs text-[#707277] text-center pt-1">
                {limitNotice}
              </p>
            )}
            {errorMessage && (
              <p className="text-[13px] text-[#E0B4A8] pt-1">{errorMessage}</p>
            )}
          </div>
        ) : (
          <div
            ref={stageHostRef}
            className={fullPictureView
              ? 'absolute inset-0 overflow-hidden'
              : 'absolute inset-4 overflow-hidden'}
          >
            <ZoomStage
              pictureWidth={currentOutputSize.width}
              pictureHeight={currentOutputSize.height}
              enabled={activePanel !== 'crop'}
              resetKey={`${active?.id ?? ''}:${currentOutputSize.width}x${currentOutputSize.height}:${activePanel === 'crop' ? 'crop' : 'normal'}`}
              onToggleFull={toggleFullPictureView}
            >
              <canvas
                ref={canvasRef}
                className={`w-full h-full select-none ${isPreviewActive ? 'hidden' : 'block'}`}
                style={{ touchAction: 'none' }}
              />
              {isPreviewActive && (
                <canvas
                  ref={previewCanvasRef}
                  className="w-full h-full select-none block"
                  style={{ touchAction: 'none' }}
                />
              )}
            </ZoomStage>

            {/* Crop Overlay rectangle */}
            {activePanel === 'crop' && (
              <CropOverlay
                rect={cropRect}
                imageWidth={currentOutputSize.width}
                imageHeight={currentOutputSize.height}
                ratio={currentRatio}
                displayBox={canvasDisplayBox}
                onChange={setCropRect}
              />
            )}

            {scaledNotice && activePanel !== 'crop' && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg bg-[#141517]/90 border border-white/5 text-[11.5px] text-[#7A7C82] pointer-events-none text-center z-10 select-none">
                Large pictures are reduced to 4096 px to keep your phone fast.
              </div>
            )}
          </div>
        )}
      </div>

      {/* C. Bottom area */}
      {!fullPictureView && <div className="shrink-0 bg-[#141517] border-t border-white/5">
        {/* Optional limit notice */}
        {hasPicture && limitNotice && (
          <div className="py-1 px-4 text-center text-xs text-[#707277] border-b border-white/5 bg-[#121315]">
            {limitNotice}
          </div>
        )}

        {/* 1. Tool panels */}
        {activePanel && hasPicture && !removeMode && (
          <div className="px-5 py-3 border-b border-white/5 flex flex-wrap items-center gap-3">
            {/* Rotate panel */}
            {activePanel === 'rotate' && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    handleApplyOp({ type: 'rotate', quarterTurns: -1 })
                  }
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-[#D0D2D6] text-sm hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1.5 min-h-[44px]"
                >
                  Left 90°
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleApplyOp({ type: 'rotate', quarterTurns: 1 })
                  }
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-[#D0D2D6] text-sm hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1.5 min-h-[44px]"
                >
                  Right 90°
                </button>
              </>
            )}

            {/* Flip panel */}
            {activePanel === 'flip' && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    handleApplyOp({ type: 'flip', axis: 'horizontal' })
                  }
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-[#D0D2D6] text-sm hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1.5 min-h-[44px]"
                >
                  Horizontal
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleApplyOp({ type: 'flip', axis: 'vertical' })
                  }
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-[#D0D2D6] text-sm hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1.5 min-h-[44px]"
                >
                  Vertical
                </button>
              </>
            )}

            {/* Crop panel */}
            {activePanel === 'crop' && (
              <div className="w-full flex flex-col gap-3">
                {/* Row of shape chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#8E9094] mr-1 shrink-0">
                    SHAPE
                  </span>
                  {CROP_SHAPES.map((shape) => {
                    const isSelected = selectedCropShape === shape.id;
                    return (
                      <button
                        key={shape.id}
                        type="button"
                        onClick={() =>
                          handleSelectCropShape(shape.id, shape.ratio)
                        }
                        className={`px-3 py-1.5 rounded-xl text-sm transition-colors cursor-pointer min-h-[44px] shrink-0 ${
                          isSelected
                            ? 'bg-white/10 text-white font-medium'
                            : 'bg-white/5 text-[#8E9094] hover:bg-white/10'
                        }`}
                      >
                        {shape.label}
                      </button>
                    );
                  })}
                </div>

                {/* Primary Apply & Quiet Cancel buttons */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleApplyCrop}
                    className="px-5 py-2.5 rounded-xl bg-white text-black font-medium text-sm hover:bg-[#F0F0F0] transition-colors cursor-pointer min-h-[44px]"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelCrop}
                    className="px-4 py-2 rounded-xl hover:bg-white/5 text-[#D0D2D6] text-sm font-medium cursor-pointer transition-colors min-h-[44px]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Resize panel */}
            {activePanel === 'resize' && (
              <div className="w-full flex flex-col gap-3">
                {/* Four quiet choices: Percent, Width, Height, Exact */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {(['percent', 'width', 'height', 'exact'] as const).map(
                    (mode) => {
                      const labels: Record<ResizeMode, string> = {
                        percent: 'Percent',
                        width: 'Width',
                        height: 'Height',
                        exact: 'Exact',
                      };
                      const isSelected = resizeMode === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setResizeMode(mode)}
                          className={`px-3 py-1.5 rounded-xl text-sm transition-colors cursor-pointer min-h-[44px] shrink-0 ${
                            isSelected
                              ? 'bg-white/10 text-white font-medium'
                              : 'bg-white/5 text-[#8E9094] hover:bg-white/10'
                          }`}
                        >
                          {labels[mode]}
                        </button>
                      );
                    }
                  )}
                </div>

                {/* Number field(s) */}
                {resizeMode === 'percent' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="500"
                      value={Number.isFinite(resizePercent) ? resizePercent : ''}
                      onChange={(e) =>
                        setResizePercent(
                          e.target.value === ''
                            ? ('' as unknown as number)
                            : parseInt(e.target.value, 10) || 0
                        )
                      }
                      className="w-28 px-3 py-2 rounded-xl bg-[#1C1D21] border border-white/10 text-sm text-white placeholder-[#686A70] focus:outline-none focus:border-white/30 min-h-[44px]"
                    />
                    <span className="text-sm text-[#8E9094]">%</span>
                  </div>
                )}

                {resizeMode === 'width' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={Number.isFinite(resizeWidth) ? resizeWidth : ''}
                      onChange={(e) =>
                        setResizeWidth(
                          e.target.value === ''
                            ? ('' as unknown as number)
                            : parseInt(e.target.value, 10) || 0
                        )
                      }
                      className="w-32 px-3 py-2 rounded-xl bg-[#1C1D21] border border-white/10 text-sm text-white placeholder-[#686A70] focus:outline-none focus:border-white/30 min-h-[44px]"
                    />
                    <span className="text-sm text-[#8E9094]">px wide</span>
                  </div>
                )}

                {resizeMode === 'height' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={Number.isFinite(resizeHeight) ? resizeHeight : ''}
                      onChange={(e) =>
                        setResizeHeight(
                          e.target.value === ''
                            ? ('' as unknown as number)
                            : parseInt(e.target.value, 10) || 0
                        )
                      }
                      className="w-32 px-3 py-2 rounded-xl bg-[#1C1D21] border border-white/10 text-sm text-white placeholder-[#686A70] focus:outline-none focus:border-white/30 min-h-[44px]"
                    />
                    <span className="text-sm text-[#8E9094]">px high</span>
                  </div>
                )}

                {resizeMode === 'exact' && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        placeholder="Width"
                        value={Number.isFinite(resizeWidth) ? resizeWidth : ''}
                        onChange={(e) =>
                          setResizeWidth(
                            e.target.value === ''
                              ? ('' as unknown as number)
                              : parseInt(e.target.value, 10) || 0
                          )
                        }
                        className="w-28 px-3 py-2 rounded-xl bg-[#1C1D21] border border-white/10 text-sm text-white placeholder-[#686A70] focus:outline-none focus:border-white/30 min-h-[44px]"
                      />
                      <span className="text-sm text-[#8E9094]">×</span>
                      <input
                        type="number"
                        min="1"
                        placeholder="Height"
                        value={
                          Number.isFinite(resizeHeight) ? resizeHeight : ''
                        }
                        onChange={(e) =>
                          setResizeHeight(
                            e.target.value === ''
                              ? ('' as unknown as number)
                              : parseInt(e.target.value, 10) || 0
                          )
                        }
                        className="w-28 px-3 py-2 rounded-xl bg-[#1C1D21] border border-white/10 text-sm text-white placeholder-[#686A70] focus:outline-none focus:border-white/30 min-h-[44px]"
                      />
                      <span className="text-sm text-[#8E9094]">px</span>
                    </div>
                    <span className="text-xs text-[#707277]">Shape not kept</span>
                  </div>
                )}

                {/* ONE quiet line for calculated size */}
                <div className="text-xs text-[#707277]">
                  {resizeResult.limited
                    ? 'Limited to 4096 px to keep your phone fast.'
                    : `New size: ${resizeResult.width} × ${resizeResult.height} px`}
                </div>

                {/* Primary Apply & Quiet Cancel buttons */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleApplyResize}
                    className="px-5 py-2.5 rounded-xl bg-white text-black font-medium text-sm hover:bg-[#F0F0F0] transition-colors cursor-pointer min-h-[44px]"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelResize}
                    className="px-4 py-2 rounded-xl hover:bg-white/5 text-[#D0D2D6] text-sm font-medium cursor-pointer transition-colors min-h-[44px]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Adjust panel */}
            {activePanel === 'adjust' && (
              <AdjustPanel
                values={adjustParams}
                onChange={setAdjustParams}
                onReset={() => setAdjustParams({ ...NEUTRAL_ADJUST })}
                onApply={handleApplyAdjust}
                onCancel={handleCancelAdjust}
              />
            )}

            {/* Filters panel */}
            {activePanel === 'filters' && (
              <FiltersPanel
                selectedFilter={selectedFilter}
                strength={filterStrength}
                onSelectFilter={setSelectedFilter}
                onChangeStrength={setFilterStrength}
                onApply={handleApplyFilters}
                onCancel={handleCancelFilters}
              />
            )}

            {/* Save panel */}
            {activePanel === 'save' && (
              <div className="w-full flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#8E9094] mr-1">
                    FORMAT
                  </span>
                  {(['png', 'jpg', 'webp'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setSaveFormat(fmt)}
                      className={`px-4 py-2 rounded-xl text-sm transition-colors cursor-pointer min-h-[44px] ${
                        saveFormat === fmt
                          ? 'bg-white text-black font-medium'
                          : 'bg-white/5 text-[#D0D2D6] hover:bg-white/10'
                      }`}
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSavePicture}
                    className="px-5 py-2.5 rounded-xl bg-white text-black font-medium text-sm hover:bg-[#F0F0F0] transition-colors cursor-pointer min-h-[44px]"
                  >
                    Save picture
                  </button>

                  {saveStatus === 'saved' && (
                    <span className="text-[11.5px] text-[#7A7C82]">Saved.</span>
                  )}
                  {saveStatus === 'error' && (
                    <span className="text-[13px] text-[#E0B4A8]">
                      The picture could not be saved.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. Remove action row (appears above the strip in remove mode) */}
        {hasPicture && removeMode && (
          <div className="px-5 py-2.5 border-b border-white/5 flex items-center justify-between min-h-[44px] bg-[#141517]">
            {!confirmingRemove ? (
              <>
                <span className="text-xs text-[#8E9094]">
                  Pick the pictures to remove
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRemoveMode(false);
                      setSelectedRemoveIds([]);
                    }}
                    className="px-3 py-1.5 rounded-xl hover:bg-white/5 text-[#D0D2D6] text-xs font-medium cursor-pointer transition-colors min-h-[36px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={selectedRemoveIds.length === 0}
                    onClick={() => setConfirmingRemove(true)}
                    className="px-3 py-1.5 rounded-xl hover:bg-white/5 text-[#D0D2D6] text-xs font-medium cursor-pointer transition-colors disabled:opacity-30 disabled:pointer-events-none min-h-[36px]"
                  >
                    {selectedRemoveIds.length > 0
                      ? `Remove ${selectedRemoveIds.length}`
                      : 'Remove'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="text-xs text-[#8E9094]">
                  {selectedRemoveIds.length === 1
                    ? 'Remove 1 picture? Its edits are lost.'
                    : `Remove ${selectedRemoveIds.length} pictures? Their edits are lost.`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingRemove(false)}
                    className="px-3 py-1.5 rounded-xl hover:bg-white/5 text-[#D0D2D6] text-xs font-medium cursor-pointer transition-colors min-h-[36px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteRemove}
                    className="px-3 py-1.5 rounded-xl bg-white text-black font-medium text-xs hover:bg-[#F0F0F0] cursor-pointer transition-colors min-h-[36px]"
                  >
                    Remove
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* 3. The picture tray strip (MediaStrip) */}
        {hasPicture && (
          <MediaStrip
            items={stripItems}
            activeId={pictureSet.activeId}
            removeMode={removeMode}
            selectedIds={selectedRemoveIds}
            onSelect={handleSelectPicture}
            onToggleSelect={handleToggleSelectRemove}
            onAdd={() => {
              filePickerModeRef.current = 'add';
              fileInputRef.current?.click();
            }}
            canAdd={canAdd && !isToolInactive}
          />
        )}

        {/* 4. Tool strip */}
        <div className="px-3 py-2 flex overflow-x-auto gap-1">
          {/* Add */}
          <button
            type="button"
            disabled={!hasPicture || !canAdd || activePanel !== null}
            onClick={() => {
              filePickerModeRef.current = 'add';
              fileInputRef.current?.click();
            }}
            aria-label="Add picture"
            className="min-w-[64px] min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/5 text-[#D0D2D6] disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors shrink-0"
          >
            <Plus size={20} strokeWidth={1.8} />
            <span className="text-[10.5px] uppercase tracking-wider">Add</span>
          </button>

          {/* Replace */}
          <button
            type="button"
            disabled={!hasPicture || activePanel !== null}
            onClick={() => {
              filePickerModeRef.current = 'replace';
              fileInputRef.current?.click();
            }}
            aria-label="Replace picture"
            className="min-w-[64px] min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/5 text-[#D0D2D6] disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors shrink-0"
          >
            <ImageIcon size={20} strokeWidth={1.8} />
            <span className="text-[10.5px] uppercase tracking-wider">Replace</span>
          </button>

          {/* Remove */}
          <button
            type="button"
            disabled={!hasPicture || activePanel !== null}
            onClick={() => {
              setRemoveMode((prev) => !prev);
              setSelectedRemoveIds([]);
              setConfirmingRemove(false);
              setActivePanel(null);
            }}
            aria-label="Remove pictures"
            className={`min-w-[64px] min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/5 cursor-pointer transition-colors shrink-0 ${
              !hasPicture || activePanel !== null
                ? 'opacity-30 pointer-events-none text-[#5A5C62]'
                : removeMode
                ? 'text-[#E85A3C]'
                : 'text-[#D0D2D6]'
            }`}
          >
            <Trash2 size={20} strokeWidth={1.8} />
            <span className="text-[10.5px] uppercase tracking-wider">Remove</span>
          </button>

          {/* Rotate tool */}
          <button
            type="button"
            disabled={!hasPicture || (activePanel !== null && activePanel !== 'rotate')}
            onClick={() => togglePanel('rotate')}
            aria-label="Rotate"
            className={`min-w-[64px] min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/5 cursor-pointer transition-colors shrink-0 ${
              !hasPicture || (activePanel !== null && activePanel !== 'rotate')
                ? 'opacity-30 pointer-events-none text-[#5A5C62]'
                : activePanel === 'rotate'
                ? 'text-[#E85A3C]'
                : 'text-[#D0D2D6]'
            }`}
          >
            <RotateCw size={20} strokeWidth={1.8} />
            <span className="text-[10.5px] uppercase tracking-wider">Rotate</span>
          </button>

          {/* Flip tool */}
          <button
            type="button"
            disabled={!hasPicture || (activePanel !== null && activePanel !== 'flip')}
            onClick={() => togglePanel('flip')}
            aria-label="Flip"
            className={`min-w-[64px] min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/5 cursor-pointer transition-colors shrink-0 ${
              !hasPicture || (activePanel !== null && activePanel !== 'flip')
                ? 'opacity-30 pointer-events-none text-[#5A5C62]'
                : activePanel === 'flip'
                ? 'text-[#E85A3C]'
                : 'text-[#D0D2D6]'
            }`}
          >
            <FlipHorizontal size={20} strokeWidth={1.8} />
            <span className="text-[10.5px] uppercase tracking-wider">Flip</span>
          </button>

          {/* Reset tool */}
          <button
            type="button"
            disabled={!hasPicture || activePanel !== null}
            onClick={handleReset}
            aria-label="Reset edits"
            className="min-w-[64px] min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/5 text-[#D0D2D6] disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors shrink-0"
          >
            <RotateCcw size={20} strokeWidth={1.8} />
            <span className="text-[10.5px] uppercase tracking-wider">Reset</span>
          </button>

          {/* Crop tool (active/built) */}
          <button
            type="button"
            disabled={!hasPicture || (activePanel !== null && activePanel !== 'crop')}
            onClick={() => togglePanel('crop')}
            aria-label="Crop"
            className={`min-w-[64px] min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/5 cursor-pointer transition-colors shrink-0 ${
              !hasPicture || (activePanel !== null && activePanel !== 'crop')
                ? 'opacity-30 pointer-events-none text-[#5A5C62]'
                : activePanel === 'crop'
                ? 'text-[#E85A3C]'
                : 'text-[#D0D2D6]'
            }`}
          >
            <Crop size={20} strokeWidth={1.8} />
            <span className="text-[10.5px] uppercase tracking-wider">Crop</span>
          </button>

          {/* Resize tool (active/built) */}
          <button
            type="button"
            disabled={!hasPicture || (activePanel !== null && activePanel !== 'resize')}
            onClick={() => togglePanel('resize')}
            aria-label="Resize"
            className={`min-w-[64px] min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/5 cursor-pointer transition-colors shrink-0 ${
              !hasPicture || (activePanel !== null && activePanel !== 'resize')
                ? 'opacity-30 pointer-events-none text-[#5A5C62]'
                : activePanel === 'resize'
                ? 'text-[#E85A3C]'
                : 'text-[#D0D2D6]'
            }`}
          >
            <Scaling size={20} strokeWidth={1.8} />
            <span className="text-[10.5px] uppercase tracking-wider">Resize</span>
          </button>

          {/* Adjust tool */}
          <button
            type="button"
            disabled={!hasPicture || (activePanel !== null && activePanel !== 'adjust')}
            onClick={() => togglePanel('adjust')}
            aria-label="Adjust"
            className={`min-w-[64px] min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/5 cursor-pointer transition-colors shrink-0 ${
              !hasPicture || (activePanel !== null && activePanel !== 'adjust')
                ? 'opacity-30 pointer-events-none text-[#5A5C62]'
                : activePanel === 'adjust'
                ? 'text-[#E85A3C]'
                : 'text-[#D0D2D6]'
            }`}
          >
            <SlidersHorizontal size={20} strokeWidth={1.8} />
            <span className="text-[10.5px] uppercase tracking-wider">Adjust</span>
          </button>

          {/* Filters tool */}
          <button
            type="button"
            disabled={!hasPicture || (activePanel !== null && activePanel !== 'filters')}
            onClick={() => togglePanel('filters')}
            aria-label="Filters"
            className={`min-w-[64px] min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/5 cursor-pointer transition-colors shrink-0 ${
              !hasPicture || (activePanel !== null && activePanel !== 'filters')
                ? 'opacity-30 pointer-events-none text-[#5A5C62]'
                : activePanel === 'filters'
                ? 'text-[#E85A3C]'
                : 'text-[#D0D2D6]'
            }`}
          >
            <Wand2 size={20} strokeWidth={1.8} />
            <span className="text-[10.5px] uppercase tracking-wider">Filters</span>
          </button>

          <div
            className="min-w-[64px] min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl text-[#5A5C62] cursor-not-allowed shrink-0 select-none"
            aria-disabled="true"
          >
            <Type size={20} strokeWidth={1.8} />
            <span className="text-[10.5px] uppercase tracking-wider">Text</span>
          </div>

          <div
            className="min-w-[64px] min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl text-[#5A5C62] cursor-not-allowed shrink-0 select-none"
            aria-disabled="true"
          >
            <Pencil size={20} strokeWidth={1.8} />
            <span className="text-[10.5px] uppercase tracking-wider">Draw</span>
          </div>
        </div>

        {/* Footnote */}
        <p className="text-xs text-[#707277] text-center pb-2">
          Dimmed tools are coming soon.
        </p>
      </div>}
    </div>
  );
};

export default ImageEditorScreen;
