/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B04B4P1 (Director). Tools the brain must not route to yet: planned or waiting for the owner's own test.
 * Data, not brain code: the guard forbids string lists under src/brain/mind.
 * Source: tests/fixtures/toolFacts.json (five ids). The Video Downloader and Text to Speech are NOT in this list (owner, 2026-10-27).
 */
export const LEFT_OUT_TOOL_IDS: readonly string[] = [
  'collage-maker',
  'picture-to-table',
  'voice-library',
  'voice-cloner',
  'market-scope',
];
