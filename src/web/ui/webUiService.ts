import { MockWebUiService } from './mockWebUiService.ts';
import type { WebUiService } from './webUiTypes.ts';

let service: WebUiService | null = null;

/**
 * The one place screens get the Web service. It returns the in-memory preview now.
 * Director 204 replaces this file with a version that returns the real Android engine; screens never change.
 */
export function getWebUiService(): WebUiService {
  if (!service) service = new MockWebUiService();
  return service;
}
