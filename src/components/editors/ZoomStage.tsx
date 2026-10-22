import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { createGestureState, reduceGesture, type GestureEvent, type GestureState } from '../../tools/imageEdit/gesture';
import { fitView, refitKeepingCentre, type ViewSize, type ViewState } from '../../tools/imageEdit/viewTransform';

export interface ZoomStageProps {
  pictureWidth: number;
  pictureHeight: number;
  enabled?: boolean;
  resetKey: string | number;
  onToggleFull: () => void;
  onViewCommit?: (view: ViewState) => void;
  className?: string;
  children: React.ReactNode;
}

// Rule 8: DEBUG_VIEW constant kept false; nothing temporary remains on screen.
const DEBUG_VIEW = false;

/** Touch-only interaction shell; it never draws or changes the canvas pixels. */
export const ZoomStage: React.FC<ZoomStageProps> = ({
  pictureWidth,
  pictureHeight,
  enabled = true,
  resetKey,
  onToggleFull,
  onViewCommit,
  className = '',
  children,
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const pictureRef = useRef<HTMLDivElement>(null);
  const debugRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<ViewState>({ scale: 1, tx: 0, ty: 0 });
  const gestureRef = useRef<GestureState | null>(null);
  const stageSizeRef = useRef<ViewSize>({ width: 0, height: 0 });
  const pictureSizeRef = useRef<ViewSize>({ width: pictureWidth, height: pictureHeight });
  const frameRef = useRef<number | null>(null);
  const onToggleRef = useRef(onToggleFull);
  const onCommitRef = useRef(onViewCommit);
  onToggleRef.current = onToggleFull;
  onCommitRef.current = onViewCommit;
  pictureSizeRef.current = { width: pictureWidth, height: pictureHeight };

  const updateDebugReadout = useCallback(() => {
    if (!DEBUG_VIEW || !debugRef.current) return;
    const stage = stageSizeRef.current;
    const picture = pictureSizeRef.current;
    const view = viewRef.current;
    const fit = (stage.width > 0 && picture.width > 0 && stage.height > 0 && picture.height > 0)
      ? Math.min(stage.width / picture.width, stage.height / picture.height)
      : 0;
    const ptrs = gestureRef.current?.pointers.length ?? 0;
    const mode = gestureRef.current?.mode ?? 'idle';
    debugRef.current.textContent =
      `stage: ${Math.round(stage.width)}x${Math.round(stage.height)}\n` +
      `picture: ${Math.round(picture.width)}x${Math.round(picture.height)}\n` +
      `fit: ${fit.toFixed(4)}\n` +
      `scale: ${view.scale.toFixed(4)}\n` +
      `tx,ty: ${Math.round(view.tx)}, ${Math.round(view.ty)}\n` +
      `ptrs: ${ptrs}\n` +
      `mode: ${mode}`;
  }, []);

  const writeTransformSync = useCallback(() => {
    frameRef.current = null;
    const element = pictureRef.current;
    const stage = stageSizeRef.current;
    const picture = pictureSizeRef.current;
    if (!element || stage.width <= 0 || stage.height <= 0 || picture.width <= 0 || picture.height <= 0) {
      updateDebugReadout();
      return;
    }
    const fit = Math.min(stage.width / picture.width, stage.height / picture.height);
    const view = viewRef.current;
    element.style.transform = `translate3d(${view.tx}px, ${view.ty}px, 0) scale(${fit * view.scale})`;
    element.style.visibility = 'visible';
    updateDebugReadout();
  }, [updateDebugReadout]);

  const scheduleTransform = useCallback(() => {
    if (frameRef.current === null) frameRef.current = requestAnimationFrame(writeTransformSync);
  }, [writeTransformSync]);

  const resetToFit = useCallback(() => {
    const stage = stageSizeRef.current;
    const picture = pictureSizeRef.current;
    if (stage.width <= 0 || stage.height <= 0 || picture.width <= 0 || picture.height <= 0) return;
    const result = fitView(stage, picture);
    if (result.ok === false) return;
    viewRef.current = result.value;
    const created = createGestureState(result.value, stage, picture);
    gestureRef.current = created.ok === true ? created.state : null;
    writeTransformSync();
    onCommitRef.current?.(result.value);
  }, [writeTransformSync]);

  const updateSize = useCallback((width: number, height: number) => {
    if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height))) return;
    const oldStage = stageSizeRef.current;
    const nextStage = { width, height };
    stageSizeRef.current = nextStage;
    const picture = pictureSizeRef.current;
    if (picture.width <= 0 || picture.height <= 0) return;

    if (oldStage.width > 0 && oldStage.height > 0) {
      if (Math.abs(viewRef.current.scale - 1) < 1e-4) {
        const fit = fitView(nextStage, picture);
        if (fit.ok) viewRef.current = fit.value;
      } else {
        const resized = refitKeepingCentre(viewRef.current, oldStage, picture, nextStage, picture);
        if (resized.ok) viewRef.current = resized.value;
        else {
          const fit = fitView(nextStage, picture);
          if (fit.ok) viewRef.current = fit.value;
        }
      }
    } else {
      const fit = fitView(nextStage, picture);
      if (fit.ok) viewRef.current = fit.value;
    }

    const created = createGestureState(viewRef.current, nextStage, picture);
    gestureRef.current = created.ok === true ? created.state : null;
    writeTransformSync();
    onCommitRef.current?.(viewRef.current);
  }, [writeTransformSync]);

  useLayoutEffect(() => {
    const element = stageRef.current;
    if (!element) return;

    const measureAndApply = () => {
      const rect = element.getBoundingClientRect();
      const w = rect.width || element.clientWidth;
      const h = rect.height || element.clientHeight;
      if (w > 0 && h > 0) {
        updateSize(w, h);
      }
    };

    measureAndApply();

    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver((entries) => {
          const entry = entries[0];
          if (entry) {
            const ew = entry.contentRect.width || entry.target.clientWidth;
            const eh = entry.contentRect.height || entry.target.clientHeight;
            if (ew > 0 && eh > 0) updateSize(ew, eh);
          }
        })
      : null;

    observer?.observe(element);
    const onResize = () => measureAndApply();
    window.addEventListener('resize', onResize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [updateSize]);

  useLayoutEffect(() => {
    resetToFit();
  }, [resetKey, pictureWidth, pictureHeight, resetToFit]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  const dispatch = useCallback((event: GestureEvent, commit = false) => {
    const current = gestureRef.current;
    if (!current) return;
    const result = reduceGesture(current, event);
    if (result.ok === false) return;
    gestureRef.current = result.state;
    viewRef.current = result.state.view;
    scheduleTransform();
    updateDebugReadout();
    if (result.effects.includes('toggle-full')) onToggleRef.current();
    if (commit) onCommitRef.current?.(result.state.view);
  }, [scheduleTransform, updateDebugReadout]);

  useEffect(() => {
    updateDebugReadout();
  }, [updateDebugReadout]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    if (!gestureRef.current && stageRef.current) {
      const rect = stageRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        updateSize(rect.width, rect.height);
      }
    }
    if (!gestureRef.current) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // The first contact must begin on the visible picture; a second pinch finger may land outside it.
    if (gestureRef.current.pointers.length === 0) {
      const stage = stageSizeRef.current;
      const picture = pictureSizeRef.current;
      const fit = Math.min(stage.width / picture.width, stage.height / picture.height);
      const view = viewRef.current;
      const right = view.tx + picture.width * fit * view.scale;
      const bottom = view.ty + picture.height * fit * view.scale;
      const tol = 8;
      if (x < view.tx - tol || x > right + tol || y < view.ty - tol || y > bottom + tol) return;
    }
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    dispatch({ type: 'down', id: event.pointerId, x, y, time: event.timeStamp });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled || !gestureRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dispatch({ type: 'move', id: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top, time: event.timeStamp });
  };

  const finishPointer = (event: React.PointerEvent<HTMLDivElement>, cancel: boolean) => {
    if (!gestureRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (cancel) dispatch({ type: 'cancel', id: event.pointerId, time: event.timeStamp }, true);
    else dispatch({ type: 'up', id: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top, time: event.timeStamp }, true);
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      /* ignore */
    }
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!enabled || !gestureRef.current) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    dispatch({ type: 'wheel', x: event.clientX - rect.left, y: event.clientY - rect.top, deltaY: event.deltaY, ctrlKey: event.ctrlKey, time: event.timeStamp }, true);
  };

  return (
    <div
      ref={stageRef}
      className={`absolute inset-0 overflow-hidden select-none ${className}`}
      style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishPointer(event, false)}
      onPointerCancel={(event) => finishPointer(event, true)}
      onLostPointerCapture={(event) => {
        if (gestureRef.current?.pointers.some((p) => p.id === event.pointerId)) {
          dispatch({ type: 'cancel', id: event.pointerId, time: event.timeStamp }, true);
        }
      }}
      onWheel={handleWheel}
    >
      <div
        ref={pictureRef}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: pictureWidth,
          height: pictureHeight,
          transformOrigin: '0 0',
          willChange: 'transform',
          visibility: 'hidden',
          touchAction: 'none',
        }}
      >
        {children}
      </div>
      {DEBUG_VIEW && (
        <div
          ref={debugRef}
          className="absolute top-2 right-2 z-50 bg-black/85 text-[#ECECEC] font-mono text-[10.5px] leading-tight p-2 rounded border border-white/20 whitespace-pre pointer-events-none select-none shadow-lg"
        />
      )}
    </div>
  );
};

export default ZoomStage;
