/** Wire types for AXON's own browsing session (the isolated tab that only AXON drives). */
export type AxonElementRisk = 'none' | 'submit' | 'sign-in' | 'payment';

export type AxonPageElement = Readonly<{
  id: string;
  role: string;
  tag: string;
  text: string;
  sensitive: boolean;
  risk: AxonElementRisk;
  href?: string;
  inputType?: string;
  name?: string;
  value?: string;
  checked?: boolean;
}>;

export type AxonAgentFailure = Readonly<{ ok: false; error: string; message: string; risk?: AxonElementRisk }>;
export type AxonSnapshotOk = Readonly<{ ok: true; url: string; title: string; text: string; elements: AxonPageElement[]; truncated: boolean; scrollY: number }>;
export type AxonSnapshotResult = AxonSnapshotOk | AxonAgentFailure;

export type AxonAction = Readonly<{
  type: 'click' | 'type' | 'select' | 'scroll';
  id?: string;
  text?: string;
  value?: string;
  dy?: number;
  /** The page URL of the snapshot the id came from; the page refuses if the page changed. */
  url?: string;
  /** Set only by the permission layer after the owner approved a form submit. */
  approved?: boolean;
}>;
export type AxonActOk = Readonly<{ ok: true; action: string; risk?: AxonElementRisk; y?: number }>;
export type AxonActResult = AxonActOk | AxonAgentFailure;

export type AxonSessionWireIdentity = Readonly<{
  owner: 'AXON';
  sessionId: string;
  engineContextId: string;
  cookiePartitionId: string;
  storagePartitionId: string;
  credentialStoreId: string | null;
  isolationKind: 'ENGINE_PROFILE';
  isolationVerified: boolean;
}>;

export type AxonSessionState = Readonly<{
  active: boolean;
  actionCount: number;
  lastAction: string;
  tabIndex?: number;
  url?: string;
  title?: string;
  identity?: AxonSessionWireIdentity;
  /** True when the browser screen was closed and has just been asked to open; poll axonState. */
  pending?: boolean;
}>;

export interface AxonSessionPlugin {
  axonOpen(options: { url: string }): Promise<AxonSessionState>;
  axonState(): Promise<AxonSessionState>;
  axonSnapshot(): Promise<AxonSnapshotResult>;
  axonAct(options: { action: AxonAction }): Promise<AxonActResult>;
  axonRelease(): Promise<AxonSessionState>;
}

export interface AxonSessionEngine extends AxonSessionPlugin {
  isAvailable(): boolean;
}
