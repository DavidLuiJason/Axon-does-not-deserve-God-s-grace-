/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Tool Screen Registry:
 * Maps tool catalog IDs to their screen components using Vite's dynamic import.meta.glob.
 * Adding a tool later requires only adding a file to `src/components/toolScreens/*.tsx`.
 */

import React from 'react';

export interface ToolScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

export interface ToolScreenMeta {
  toolId: string;
}

export interface ToolScreenModule {
  toolScreen?: ToolScreenMeta;
  default?: React.ComponentType<ToolScreenProps>;
  [key: string]: unknown;
}

/** Registry mapping catalog toolId -> Screen Component */
export const TOOL_SCREEN_REGISTRY: Record<string, React.ComponentType<ToolScreenProps>> = {};

// Eagerly glob all screen definitions in src/components/toolScreens/
const screenModules = import.meta.glob<ToolScreenModule>(
  '../../components/toolScreens/*.tsx',
  { eager: true }
);

for (const path in screenModules) {
  const mod = screenModules[path];
  const toolId = mod.toolScreen?.toolId;
  // Pick default export or first exported React component
  let Component = mod.default;
  if (!Component) {
    for (const key of Object.keys(mod)) {
      if (key !== 'toolScreen' && typeof mod[key] === 'function') {
        Component = mod[key] as React.ComponentType<ToolScreenProps>;
        break;
      }
    }
  }

  if (toolId && Component) {
    TOOL_SCREEN_REGISTRY[toolId] = Component;
  }
}

/**
 * Retrieve the screen component for a given tool ID.
 */
export function getToolScreen(toolId: string): React.ComponentType<ToolScreenProps> | undefined {
  return TOOL_SCREEN_REGISTRY[toolId];
}

/**
 * ToolScreenHost: Renders the appropriate tool screen based on `tool:<id>`.
 */
export interface ToolScreenHostProps {
  screenId: string;
  onBack: () => void;
  onLogoClick: () => void;
}

export const ToolScreenHost: React.FC<ToolScreenHostProps> = ({
  screenId,
  onBack,
  onLogoClick,
}) => {
  const toolId = screenId.startsWith('tool:') ? screenId.slice(5) : screenId;
  const ScreenComponent = getToolScreen(toolId);

  if (!ScreenComponent) {
    return React.createElement(
      'div',
      {
        className:
          'flex-1 flex flex-col items-center justify-center p-6 text-center text-[#9A9B9F] bg-[#121315]',
      },
      React.createElement(
        'p',
        { className: 'text-sm font-medium text-white mb-1' },
        'Tool screen not found'
      ),
      React.createElement(
        'p',
        { className: 'text-xs text-[#8E9094] mb-4' },
        `No screen registered for tool "${toolId}".`
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: onBack,
          className:
            'min-h-[44px] px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer',
        },
        'Return to Tools'
      )
    );
  }

  return React.createElement(ScreenComponent, { onBack, onLogoClick });
};

export default ToolScreenHost;
