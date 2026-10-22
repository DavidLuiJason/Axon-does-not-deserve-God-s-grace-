/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Crop rectangle overlay for the Image Editor.
 * Strictly follows THE AXON LOOK:
 * 1 px border-white, area outside dimmed with bg-black/50, four corner handles 24 px touch size.
 * Drag inside to move; dragging always passes through clampCrop.
 * Preserves fixed shape ratio when dragging corner handles.
 */

import React, { useRef } from 'react';
import {
  clampCrop,
  MIN_CROP,
  type Rect,
} from '../../tools/imageEdit/cropResize';

export interface CropOverlayProps {
  rect: Rect;
  imageWidth: number;
  imageHeight: number;
  ratio: number | null;
  displayBox: { left: number; top: number; width: number; height: number };
  onChange: (nextRect: Rect) => void;
}

type Corner = 'tl' | 'tr' | 'bl' | 'br';

function computeCornerDrag(
  corner: Corner,
  startRect: Rect,
  deltaX: number,
  deltaY: number,
  ratio: number | null,
  imgW: number,
  imgH: number
): Rect {
  if (ratio === null || !(ratio > 0)) {
    // Free ratio
    let x = startRect.x;
    let y = startRect.y;
    let w = startRect.width;
    let h = startRect.height;
    if (corner === 'tl') {
      const right = startRect.x + startRect.width;
      const bottom = startRect.y + startRect.height;
      x = startRect.x + deltaX;
      y = startRect.y + deltaY;
      w = right - x;
      h = bottom - y;
    } else if (corner === 'tr') {
      const bottom = startRect.y + startRect.height;
      y = startRect.y + deltaY;
      w = startRect.width + deltaX;
      h = bottom - y;
    } else if (corner === 'bl') {
      const right = startRect.x + startRect.width;
      x = startRect.x + deltaX;
      w = right - x;
      h = startRect.height + deltaY;
    } else {
      // br
      w = startRect.width + deltaX;
      h = startRect.height + deltaY;
    }
    return clampCrop({ x, y, width: w, height: h }, imgW, imgH);
  }

  // Fixed ratio: width / height = ratio
  if (corner === 'br') {
    const anchorX = startRect.x;
    const anchorY = startRect.y;
    const maxW = imgW - anchorX;
    const maxH = imgH - anchorY;
    let w = Math.max(MIN_CROP, startRect.width + deltaX);
    let h = Math.round(w / ratio);
    if (h > maxH) {
      h = maxH;
      w = Math.round(h * ratio);
    }
    if (w > maxW) {
      w = maxW;
      h = Math.round(w / ratio);
    }
    return clampCrop({ x: anchorX, y: anchorY, width: w, height: h }, imgW, imgH);
  }

  if (corner === 'bl') {
    const anchorX = startRect.x + startRect.width;
    const anchorY = startRect.y;
    const maxW = anchorX;
    const maxH = imgH - anchorY;
    let w = Math.max(MIN_CROP, startRect.width - deltaX);
    let h = Math.round(w / ratio);
    if (h > maxH) {
      h = maxH;
      w = Math.round(h * ratio);
    }
    if (w > maxW) {
      w = maxW;
      h = Math.round(w / ratio);
    }
    return clampCrop({ x: anchorX - w, y: anchorY, width: w, height: h }, imgW, imgH);
  }

  if (corner === 'tr') {
    const anchorX = startRect.x;
    const anchorY = startRect.y + startRect.height;
    const maxW = imgW - anchorX;
    const maxH = anchorY;
    let w = Math.max(MIN_CROP, startRect.width + deltaX);
    let h = Math.round(w / ratio);
    if (h > maxH) {
      h = maxH;
      w = Math.round(h * ratio);
    }
    if (w > maxW) {
      w = maxW;
      h = Math.round(w / ratio);
    }
    return clampCrop({ x: anchorX, y: anchorY - h, width: w, height: h }, imgW, imgH);
  }

  // tl
  const anchorX = startRect.x + startRect.width;
  const anchorY = startRect.y + startRect.height;
  const maxW = anchorX;
  const maxH = anchorY;
  let w = Math.max(MIN_CROP, startRect.width - deltaX);
  let h = Math.round(w / ratio);
  if (h > maxH) {
    h = maxH;
    w = Math.round(h * ratio);
  }
  if (w > maxW) {
    w = maxW;
    h = Math.round(w / ratio);
  }
  return clampCrop({ x: anchorX - w, y: anchorY - h, width: w, height: h }, imgW, imgH);
}

export const CropOverlay: React.FC<CropOverlayProps> = ({
  rect,
  imageWidth,
  imageHeight,
  ratio,
  displayBox,
  onChange,
}) => {
  const activeDragRef = useRef<{
    mode: 'move' | Corner;
    startPointerX: number;
    startPointerY: number;
    startRect: Rect;
  } | null>(null);

  if (imageWidth <= 0 || imageHeight <= 0 || displayBox.width <= 0 || displayBox.height <= 0) {
    return null;
  }

  const scaleX = displayBox.width / imageWidth;
  const scaleY = displayBox.height / imageHeight;

  // Screen coordinates relative to the displayBox
  const screenLeft = Math.round(rect.x * scaleX);
  const screenTop = Math.round(rect.y * scaleY);
  const screenWidth = Math.round(rect.width * scaleX);
  const screenHeight = Math.round(rect.height * scaleY);

  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    mode: 'move' | Corner
  ) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    activeDragRef.current = {
      mode,
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      startRect: { ...rect },
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeDragRef.current) return;
    e.stopPropagation();
    e.preventDefault();

    const { mode, startPointerX, startPointerY, startRect } = activeDragRef.current;
    const deltaScreenX = e.clientX - startPointerX;
    const deltaScreenY = e.clientY - startPointerY;

    // Convert screen deltas to image pixels
    const deltaImgX = deltaScreenX / scaleX;
    const deltaImgY = deltaScreenY / scaleY;

    if (mode === 'move') {
      const nextX = startRect.x + deltaImgX;
      const nextY = startRect.y + deltaImgY;
      const clamped = clampCrop(
        { x: nextX, y: nextY, width: startRect.width, height: startRect.height },
        imageWidth,
        imageHeight
      );
      onChange(clamped);
    } else {
      const nextRect = computeCornerDrag(
        mode,
        startRect,
        deltaImgX,
        deltaImgY,
        ratio,
        imageWidth,
        imageHeight
      );
      onChange(nextRect);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeDragRef.current) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture already released
    }
    activeDragRef.current = null;
  };

  return (
    <div
      className="absolute pointer-events-auto select-none overflow-hidden touch-none"
      style={{
        left: displayBox.left,
        top: displayBox.top,
        width: displayBox.width,
        height: displayBox.height,
      }}
    >
      {/* Dimmed outside areas (bg-black/50) */}
      {/* Top dimmed strip */}
      <div
        className="absolute bg-black/50 pointer-events-none"
        style={{
          top: 0,
          left: 0,
          right: 0,
          height: Math.max(0, screenTop),
        }}
      />
      {/* Bottom dimmed strip */}
      <div
        className="absolute bg-black/50 pointer-events-none"
        style={{
          top: screenTop + screenHeight,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />
      {/* Left dimmed strip */}
      <div
        className="absolute bg-black/50 pointer-events-none"
        style={{
          top: screenTop,
          left: 0,
          width: Math.max(0, screenLeft),
          height: screenHeight,
        }}
      />
      {/* Right dimmed strip */}
      <div
        className="absolute bg-black/50 pointer-events-none"
        style={{
          top: screenTop,
          left: screenLeft + screenWidth,
          right: 0,
          height: screenHeight,
        }}
      />

      {/* The 1 px border-white crop rectangle */}
      <div
        className="absolute border border-white box-border touch-none"
        style={{
          left: screenLeft,
          top: screenTop,
          width: screenWidth,
          height: screenHeight,
        }}
      >
        {/* Drag inside to move */}
        <div
          className="w-full h-full cursor-move touch-none"
          onPointerDown={(e) => handlePointerDown(e, 'move')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />

        {/* Four corner handles: 24 px touch size */}
        {/* Top-Left */}
        <div
          aria-label="Crop top left"
          className="absolute -top-3 -left-3 w-6 h-6 flex items-center justify-center cursor-nwse-resize touch-none z-10"
          onPointerDown={(e) => handlePointerDown(e, 'tl')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="w-2.5 h-2.5 bg-white border border-black/40 pointer-events-none" />
        </div>

        {/* Top-Right */}
        <div
          aria-label="Crop top right"
          className="absolute -top-3 -right-3 w-6 h-6 flex items-center justify-center cursor-nesw-resize touch-none z-10"
          onPointerDown={(e) => handlePointerDown(e, 'tr')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="w-2.5 h-2.5 bg-white border border-black/40 pointer-events-none" />
        </div>

        {/* Bottom-Left */}
        <div
          aria-label="Crop bottom left"
          className="absolute -bottom-3 -left-3 w-6 h-6 flex items-center justify-center cursor-nesw-resize touch-none z-10"
          onPointerDown={(e) => handlePointerDown(e, 'bl')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="w-2.5 h-2.5 bg-white border border-black/40 pointer-events-none" />
        </div>

        {/* Bottom-Right */}
        <div
          aria-label="Crop bottom right"
          className="absolute -bottom-3 -right-3 w-6 h-6 flex items-center justify-center cursor-nwse-resize touch-none z-10"
          onPointerDown={(e) => handlePointerDown(e, 'br')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="w-2.5 h-2.5 bg-white border border-black/40 pointer-events-none" />
        </div>
      </div>
    </div>
  );
};

export default CropOverlay;
