import { registerCapability, getCapability } from './registry';

const SCREEN_INTELLIGENCE_CAPABILITY = {
  id: 'cap.screen-intelligence-engine',
  displayName: 'Screen Intelligence Engine',
  contractVersion: '1.0.0',
  implementationVersion: '0.1.0-prototype',
  permissions: ['android.permission.FOREGROUND_SERVICE', 'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION', 'android.permission.POST_NOTIFICATIONS', 'Android MediaProjection user consent per session'],
  noChatAction: 'Prototype capture foundation: user-initiated Android MediaProjection video segments with keyframe thumbnails, and AXON-owned browser DOM observation. No OCR, image recognition, accessibility-tree capture, or screen actions yet.',
};

export function registerScreenIntelligenceCapability(): void {
  registerCapability({ ...SCREEN_INTELLIGENCE_CAPABILITY });
  console.log('[AXON capability registry] Screen Intelligence Engine registered:', getCapability(SCREEN_INTELLIGENCE_CAPABILITY.id));
}
