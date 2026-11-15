import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBrowserDeviceProfile, withKernelDeviceProfile } from '../src/web/browserDeviceProfile.ts';

test('responsive policy uses window width rather than Android version or device brand', () => {
  const compact = resolveBrowserDeviceProfile({ viewportWidthCssPx: 360, hasCoarsePointer: true });
  const medium = resolveBrowserDeviceProfile({ viewportWidthCssPx: 768, hasCoarsePointer: true });
  const expanded = resolveBrowserDeviceProfile({ viewportWidthCssPx: 1280, hasFinePointer: true, hasKeyboard: true });
  assert.equal(compact.windowClass, 'COMPACT');
  assert.equal(medium.windowClass, 'MEDIUM');
  assert.equal(expanded.windowClass, 'EXPANDED');
  assert.equal(expanded.useSidebar, true);
});

test('compact phones and large touch devices retain touch-friendly layout', () => {
  for (const width of [320, 360, 393, 480, 600, 768, 900]) {
    const profile = resolveBrowserDeviceProfile({ viewportWidthCssPx: width, hasCoarsePointer: true });
    assert.equal(profile.touchFriendly, true);
    assert.equal(profile.liveRendererBudget, 1);
  }
});

test('expanded windows with keyboard and pointer receive wide controls and sidebar', () => {
  const profile = resolveBrowserDeviceProfile({ viewportWidthCssPx: 1024, hasFinePointer: true, hasKeyboard: true, memoryGb: 4 });
  assert.equal(profile.toolbarMode, 'WIDE');
  assert.equal(profile.quickActionColumns, 4);
  assert.equal(profile.useSidebar, true);
  assert.equal(profile.memoryTier, 'HIGH');
});

test('foldable and split-window widths are reclassified from current available width', () => {
  const unfolded = resolveBrowserDeviceProfile({ viewportWidthCssPx: 850 });
  const foldedOrSplit = resolveBrowserDeviceProfile({ viewportWidthCssPx: 412 });
  assert.equal(unfolded.windowClass, 'EXPANDED');
  assert.equal(foldedOrSplit.windowClass, 'COMPACT');
});

test('low-memory signal overrides reported memory class without increasing renderer count', () => {
  const profile = resolveBrowserDeviceProfile({ viewportWidthCssPx: 1280, memoryGb: 8, lowMemory: true });
  assert.equal(profile.memoryTier, 'LOW');
  assert.equal(profile.liveRendererBudget, 1);
});

test('invalid or missing widths fail safely to compact layout', () => {
  for (const width of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const profile = resolveBrowserDeviceProfile({ viewportWidthCssPx: width });
    assert.equal(profile.windowClass, 'COMPACT');
  }
});


test('browser policy consumes shared kernel Device Profile readings without guessing missing RAM', () => {
  const base = { viewportWidthCssPx: 1000 };
  const known = withKernelDeviceProfile(base, { memoryGb: { known: true, value: 3 } });
  const unknown = withKernelDeviceProfile(base, { memoryGb: { known: false } });
  assert.equal(resolveBrowserDeviceProfile(known).memoryTier, 'STANDARD');
  assert.equal(resolveBrowserDeviceProfile(unknown).memoryTier, 'UNKNOWN');
});
