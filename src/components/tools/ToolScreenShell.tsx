/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ToolScreenShell: The shared shell wrapping every individual tool screen in AXON.
 * Renders the persistent ScreenHeader band with the tool name and small-caps tagline,
 * the back row underneath returning to the Tools menu, and a scrolling viewport with safe padding.
 */

import React from 'react';
import { ScreenHeader } from '../ScreenHeader';

export interface ToolScreenShellProps {
  toolName: string;
  tagline: string;
  onBack: () => void;
  onLogoClick: () => void;
  children: React.ReactNode;
}

export const ToolScreenShell: React.FC<ToolScreenShellProps> = ({
  toolName,
  tagline,
  onBack,
  onLogoClick,
  children,
}) => {
  return (
    <div className="relative w-full h-full flex flex-col bg-[#121315] text-[#ECECEC] overflow-hidden font-sans">
      {/* 1. Header Band and Back Navigation Row */}
      <ScreenHeader
        title={toolName}
        tagline={tagline}
        backLabel="TOOLS"
        onBack={onBack}
        onLogoClick={onLogoClick}
      />

      {/* 2. Scrolling Body with safe-area padding */}
      <main className="flex-1 overflow-y-auto px-5 py-4 pb-12 space-y-5 max-w-2xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
};

export default ToolScreenShell;
