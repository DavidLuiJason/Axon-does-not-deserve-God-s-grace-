/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * User Dictionary Storage Adapter:
 * Backed by localStorage with safe try/catch error handling around every call.
 * If storage is unavailable or quota is exceeded, throws an error so createUserDictionary
 * catches and converts it into the engine's plain error without crashing.
 */

import type { UserDictionaryStorage } from '../tools/engines/dictionary/userDictionary';

export class LocalStorageUserDictionaryStorage implements UserDictionaryStorage {
  get(key: string): string | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        throw new Error('localStorage is not available');
      }
      return window.localStorage.getItem(key);
    } catch (e) {
      throw new Error(`Failed to read from localStorage: ${(e as Error).message}`);
    }
  }

  set(key: string, value: string): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        throw new Error('localStorage is not available');
      }
      window.localStorage.setItem(key, value);
    } catch (e) {
      throw new Error(`Failed to write to localStorage: ${(e as Error).message}`);
    }
  }

  remove(key: string): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        throw new Error('localStorage is not available');
      }
      window.localStorage.removeItem(key);
    } catch (e) {
      throw new Error(`Failed to remove from localStorage: ${(e as Error).message}`);
    }
  }
}

export const userDictionaryStorage = new LocalStorageUserDictionaryStorage();

/**
 * 32-bit FNV-1a hash producing an 8-character hex string.
 * Deterministic, fast, and dependency-free.
 */
export function hashEntryKey(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
