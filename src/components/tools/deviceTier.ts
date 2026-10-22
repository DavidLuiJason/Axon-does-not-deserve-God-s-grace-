/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Temporary device tier derivation based on hardware heuristics.
 * NOTE: This is a temporary rule until the measured Device Profile tier exists.
 *
 * Returns 'low', 'mid' or 'high':
 * - 'low': memory is 2 GB or less, OR cores are 4 or fewer.
 * - 'high': memory is 6 GB or more, AND cores are 8 or more.
 * - 'mid': otherwise.
 * - 'low': when either value is unknown (unknown must never be treated as strong).
 */

import type { DeviceTier } from '../../tools/engines/video/framePlan';

export function getDeviceTier(): DeviceTier {
  if (typeof navigator === 'undefined') {
    return 'low';
  }

  // navigator.deviceMemory is in GB (e.g. 0.5, 1, 2, 4, 8)
  const nav = navigator as Navigator & { deviceMemory?: number };
  const memory = nav.deviceMemory;
  const cores = navigator.hardwareConcurrency;

  // Unknown must never be treated as strong -> fallback to 'low'
  if (
    typeof memory !== 'number' ||
    !Number.isFinite(memory) ||
    memory <= 0 ||
    typeof cores !== 'number' ||
    !Number.isFinite(cores) ||
    cores <= 0
  ) {
    return 'low';
  }

  if (memory <= 2 || cores <= 4) {
    return 'low';
  }

  if (memory >= 6 && cores >= 8) {
    return 'high';
  }

  return 'mid';
}
