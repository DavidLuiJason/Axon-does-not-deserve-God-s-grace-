/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * JSON and Data Viewer Screen: Read and tidy JSON.
 * Uses pure engines in src/tools/engines/data/jsonTokens.ts and jsonView.ts.
 * Supports Tree and Text views, collapsible lazy windows with "Show more",
 * path copying on tap, file opening, pretty formatting, minification,
 * and error scrolling.
 */

import React, { useId, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  FolderOpen,
  X,
} from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  copyToClipboard,
  ErrorLine,
  OptionsDisclosure,
  ResultBox,
  SegmentedChoice,
} from '../tools/ToolParts';
import {
  JSON_LIMITS,
  minify,
  pretty,
  type JsonError,
  type JsonResult,
} from '../../tools/engines/data/jsonTokens';
import {
  buildTree,
  childrenOf,
  JSON_VIEW_LIMITS,
  stats,
  type JsonViewNode,
  type JsonViewResult,
} from '../../tools/engines/data/jsonView';

export const toolScreen = { toolId: 'json-viewer' };

export interface JsonViewerScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

type ViewMode = 'tree' | 'text';
type IndentOption = '2' | '4' | 'tab';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface TreeNodeItemProps {
  node: JsonViewNode;
  depth: number;
  onCopyPath: (path: string) => void;
}

const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  depth,
  onCopyPath,
}) => {
  const [isExpanded, setIsExpanded] = useState(depth === 0);
  const [windowLimit, setWindowLimit] = useState<number>(
    JSON_VIEW_LIMITS.defaultWindow
  );

  const childrenData = useMemo(() => {
    if (!isExpanded || !node.hasChildren) return null;
    const res = childrenOf(node, 0, windowLimit);
    return res.ok ? res.value : null;
  }, [node, isExpanded, windowLimit]);

  const handleShowMore = (e: React.MouseEvent) => {
    e.stopPropagation();
    setWindowLimit((prev) =>
      Math.min(prev + JSON_VIEW_LIMITS.defaultWindow, JSON_VIEW_LIMITS.maxWindow)
    );
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'object':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'array':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'string':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'number':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'boolean':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'null':
        return 'text-[#8E9094] bg-white/5 border-white/10';
      default:
        return 'text-[#8E9094] bg-white/5 border-white/10';
    }
  };

  const handleRowClick = () => {
    if (node.path) {
      onCopyPath(node.path);
    }
  };

  return (
    <div className="select-none font-mono text-xs">
      <div
        onClick={handleRowClick}
        className="group flex items-center gap-1.5 py-1 px-1.5 rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer"
        style={{ paddingLeft: `${Math.max(6, depth * 16)}px` }}
        title={`Click to copy path: ${node.path || '$'}`}
      >
        {node.hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-1 -ml-1 text-[#8E9094] group-hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Key name */}
        {node.key !== null && (
          <span className="text-[#D0D2D6] font-medium">
            {typeof node.key === 'number' ? `[${node.key}]` : `${node.key}:`}
          </span>
        )}

        {/* Type tag */}
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getTypeBadgeClass(
            node.type
          )}`}
        >
          {node.type}
        </span>

        {/* Preview / Child count */}
        {node.hasChildren ? (
          <span className="text-[#8E9094] text-[11px]">
            {node.type === 'array'
              ? `${node.size} item${node.size === 1 ? '' : 's'}`
              : `${node.size} key${node.size === 1 ? '' : 's'}`}
          </span>
        ) : (
          <span className="text-white truncate max-w-[260px] sm:max-w-md">
            {node.preview}
          </span>
        )}

        {/* Copy path indicator on hover */}
        <span className="ml-auto opacity-0 group-hover:opacity-100 text-[10px] text-[#8E9094] transition-opacity">
          Copy path
        </span>
      </div>

      {/* Children list */}
      {isExpanded && childrenData && (
        <div className="space-y-0.5">
          {childrenData.children.map((child, idx) => (
            <TreeNodeItem
              key={`${child.path}-${idx}`}
              node={child}
              depth={depth + 1}
              onCopyPath={onCopyPath}
            />
          ))}

          {/* Show more window button */}
          {childrenData.remaining > 0 && (
            <div
              className="py-1"
              style={{ paddingLeft: `${(depth + 1) * 16}px` }}
            >
              <button
                type="button"
                onClick={handleShowMore}
                className="text-xs text-[#E85A3C] hover:underline cursor-pointer py-1 font-sans font-medium"
              >
                Show more ({childrenData.remaining.toLocaleString()} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SAMPLE_JSON = `{
  "name": "AXON",
  "version": "1.0.0",
  "features": [
    "Offline-first",
    "Private memory",
    "Tools ecosystem"
  ],
  "stats": {
    "speed": "instant",
    "heapMB": 42
  }
}`;

export const JsonViewerScreen: React.FC<JsonViewerScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [jsonText, setJsonText] = useState(SAMPLE_JSON);
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [indent, setIndent] = useState<IndentOption>('2');
  const [copiedNotification, setCopiedNotification] = useState<string | null>(
    null
  );
  const [sortKeysError, setSortKeysError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const uniqueId = useId();

  // Parse and build tree using engine
  const treeResult = useMemo<JsonViewResult<JsonViewNode>>(() => {
    if (!jsonText.trim()) {
      return { ok: false, error: 'invalid-input', message: 'Enter JSON text.' };
    }
    return buildTree(jsonText);
  }, [jsonText]);

  // Document statistics
  const statsResult = useMemo(() => {
    if (!jsonText.trim()) return null;
    const res = stats(jsonText);
    return res.ok ? res.value : null;
  }, [jsonText]);

  // Formatted text representation for "Text" view
  const formattedTextResult = useMemo<JsonResult<string>>(() => {
    if (!jsonText.trim()) {
      return {
        ok: false,
        error: 'empty-input',
        message: 'Empty JSON input',
        line: 1,
        column: 1,
      };
    }
    const indentVal = indent === 'tab' ? 'tab' : (parseInt(indent, 10) as 2 | 4);
    return pretty(jsonText, { indent: indentVal });
  }, [jsonText, indent]);

  // Handle path copying on tree row tap
  const handleCopyPath = async (path: string) => {
    const success = await copyToClipboard(path);
    if (success) {
      setCopiedNotification(`Path copied: ${path}`);
      setTimeout(() => setCopiedNotification(null), 2500);
    }
  };

  // Scroll to error position in textarea
  const scrollToError = (line: number, column: number) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const lines = jsonText.split('\n');
    let charIndex = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) {
      charIndex += lines[i].length + 1;
    }
    charIndex += Math.max(0, column - 1);
    charIndex = Math.min(charIndex, jsonText.length);

    textarea.focus();
    textarea.setSelectionRange(charIndex, charIndex + 1);

    // Estimate line height ~20px to scroll into view
    const approxScroll = Math.max(0, (line - 2) * 20);
    textarea.scrollTop = approxScroll;
  };

  // Open file handler
  const handleOpenFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > JSON_VIEW_LIMITS.maxBytes) {
      setFileError('JSON input exceeds the viewer limit of 512 KB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setJsonText(content);
        setSortKeysError(null);
      }
    };
    reader.onerror = () => {
      setFileError('Could not read the selected file.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Minify action
  const handleMinify = () => {
    setSortKeysError(null);
    const res = minify(jsonText);
    if (res.ok) {
      setJsonText(res.value);
    }
  };

  // Sort keys action using engine
  const handleSortKeys = () => {
    const res = pretty(jsonText, { indent: 2, sortKeys: true });
    if (!res.ok) {
      setSortKeysError(res.message);
    } else {
      setJsonText(res.value);
      setSortKeysError(null);
    }
  };

  // Extract parse error if any
  const parseError: { message: string; line?: number; column?: number } | null =
    useMemo(() => {
      if (!jsonText.trim()) return null;
      if (!treeResult.ok) {
        // Try getting line and column from tokenization
        const formatted = formattedTextResult;
        if (!formatted.ok) {
          return {
            message: formatted.message,
            line: formatted.line,
            column: formatted.column,
          };
        }
        return { message: treeResult.message };
      }
      return null;
    }, [jsonText, treeResult, formattedTextResult]);

  return (
    <ToolScreenShell
      toolName="JSON and Data Viewer"
      tagline="Read and tidy JSON"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-5">
        {/* Top actions: Open file & View Switcher */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json,text/plain"
              onChange={handleOpenFile}
              className="hidden"
              id={`${uniqueId}-file-input`}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-2"
            >
              <FolderOpen size={16} />
              <span>Open a file</span>
            </button>
          </div>

          <div className="w-48">
            <SegmentedChoice<ViewMode>
              choices={[
                { id: 'tree', label: 'Tree' },
                { id: 'text', label: 'Text' },
              ]}
              value={viewMode}
              onChange={setViewMode}
            />
          </div>
        </div>

        {/* File error if file size exceeded limit */}
        {fileError && <ErrorLine message={fileError} />}

        {/* JSON Input Area */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label
              htmlFor={`${uniqueId}-json-input`}
              className="font-semibold uppercase tracking-wider text-[#8E9094]"
            >
              JSON input
            </label>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-[#8E9094]">
                {formatBytes(new TextEncoder().encode(jsonText).length)} / max 512 KB
              </span>
              {jsonText.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setJsonText('');
                    setSortKeysError(null);
                  }}
                  aria-label="Clear JSON"
                  className="text-[#8E9094] hover:text-white transition-colors cursor-pointer p-0.5"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <textarea
            ref={textareaRef}
            id={`${uniqueId}-json-input`}
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setSortKeysError(null);
            }}
            placeholder="Paste JSON here or open a file..."
            rows={6}
            className="w-full bg-[#1C1D21] border border-white/10 rounded-2xl p-3.5 text-xs text-white font-mono leading-relaxed placeholder-[#8E9094] focus:outline-none focus:border-[#E85A3C] transition-colors resize-y"
          />
        </div>

        {/* Parse error line with clickable scroll */}
        {parseError && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between gap-3 text-xs">
            <span className="text-red-400 font-medium">
              {parseError.message}
              {parseError.line !== undefined && parseError.column !== undefined
                ? ` (line ${parseError.line}, column ${parseError.column})`
                : ''}
            </span>
            {parseError.line !== undefined && (
              <button
                type="button"
                onClick={() =>
                  scrollToError(parseError.line!, parseError.column ?? 1)
                }
                className="text-xs text-red-300 hover:underline cursor-pointer font-semibold whitespace-nowrap"
              >
                Go to error
              </button>
            )}
          </div>
        )}

        {/* Stats line */}
        {statsResult && !parseError && (
          <div className="px-3.5 py-2.5 bg-[#18191C] border border-white/10 rounded-xl text-xs text-[#8E9094] flex items-center justify-between flex-wrap gap-2">
            <span>
              Stats: depth {statsResult.depth} • {statsResult.values.toLocaleString()}{' '}
              values • {statsResult.keys.toLocaleString()} keys
            </span>
            <span className="font-mono text-[11px]">
              {formatBytes(statsResult.sizeBytes)}
            </span>
          </div>
        )}

        {/* Options Row (Pretty indentation, Minify, Sort keys) */}
        <OptionsDisclosure title="Options">
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
                Pretty indentation
              </span>
              <SegmentedChoice<IndentOption>
                choices={[
                  { id: '2', label: '2 spaces' },
                  { id: '4', label: '4 spaces' },
                  { id: 'tab', label: 'Tab' },
                ]}
                value={indent}
                onChange={setIndent}
              />
            </div>

            <div className="flex items-center gap-3 flex-wrap pt-1">
              <button
                type="button"
                onClick={handleMinify}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors cursor-pointer"
              >
                Minify JSON
              </button>

              <button
                type="button"
                onClick={handleSortKeys}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors cursor-pointer"
              >
                Sort keys
              </button>
            </div>

            {sortKeysError && <ErrorLine message={sortKeysError} />}
          </div>
        </OptionsDisclosure>

        {/* Copied notification */}
        {copiedNotification && (
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 text-center font-mono">
            {copiedNotification}
          </div>
        )}

        {/* Views: Tree or Text */}
        {!parseError && jsonText.trim() && (
          <div className="space-y-2">
            {viewMode === 'tree' ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-[#8E9094]">
                  <span className="font-semibold uppercase tracking-wider">
                    Tree view
                  </span>
                  <span>Tap a row to copy path</span>
                </div>
                <div className="p-3 bg-[#18191C] border border-white/10 rounded-2xl max-h-96 overflow-y-auto">
                  {treeResult.ok ? (
                    <TreeNodeItem
                      node={treeResult.value}
                      depth={0}
                      onCopyPath={handleCopyPath}
                    />
                  ) : (
                    <div className="text-xs text-[#8E9094] italic text-center p-4">
                      Cannot build tree: {treeResult.message}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
                  Formatted text
                </span>
                {formattedTextResult.ok ? (
                  <ResultBox
                    title="Formatted JSON"
                    text={formattedTextResult.value}
                  />
                ) : (
                  <ErrorLine message={formattedTextResult.message} />
                )}
              </div>
            )}
          </div>
        )}

        {!jsonText.trim() && (
          <div className="p-4 bg-[#18191C]/50 border border-white/5 rounded-2xl text-xs text-[#8E9094] italic text-center">
            Paste JSON or open a file above to explore and format your data.
          </div>
        )}
      </div>
    </ToolScreenShell>
  );
};

export default JsonViewerScreen;
