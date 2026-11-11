const SEMANTIC_TAGS = new Set(['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'IMG', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'NAV', 'MAIN', 'HEADER', 'FOOTER', 'FORM', 'UL', 'OL', 'LI', 'DIALOG', 'SUMMARY']);

function isHidden(element, view) {
  if (element.hidden || element.getAttribute('aria-hidden') === 'true' || element.getAttribute('type')?.toLowerCase() === 'hidden') return true;
  const style = view?.getComputedStyle?.(element);
  if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) return true;
  // A visible child of a hidden ancestor is not actually visible.
  let parent = element.parentElement;
  while (parent) {
    if (parent.hidden || parent.getAttribute?.('aria-hidden') === 'true') return true;
    const parentStyle = view?.getComputedStyle?.(parent);
    if (parentStyle && (parentStyle.display === 'none' || parentStyle.visibility === 'hidden' || parentStyle.opacity === '0')) return true;
    parent = parent.parentElement;
  }
  return false;
}

function elementType(element) {
  const tag = element.tagName;
  if (tag === 'A') return 'link';
  if (tag === 'BUTTON') return 'button';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return 'field';
  if (tag === 'IMG') return 'image';
  if (/^H[1-6]$/.test(tag)) return 'heading';
  if (tag === 'NAV') return 'navigation';
  if (tag === 'UL' || tag === 'OL' || tag === 'LI') return 'list';
  if (tag === 'DIALOG') return 'dialog';
  const role = element.getAttribute('role');
  return role || 'text';
}

function safeUrl(value, base) {
  try { const url = new URL(value, base ?? 'about:blank'); if (!['http:', 'https:'].includes(url.protocol)) return null; return `${url.origin}${url.pathname}`; } catch { return null; }
}

function safeLabel(element) {
  const type = element.getAttribute('type')?.toLowerCase();
  if (type === 'password' || type === 'hidden') return '[REDACTED]';
  const aria = element.getAttribute('aria-label');
  const alt = element.getAttribute('alt');
  const title = element.getAttribute('title');
  const text = element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT'
    ? ''
    : (element.innerText || element.textContent || '');
  return String(aria || alt || title || text).replace(/\s+/g, ' ').trim().slice(0, 1000);
}

export function captureDocumentSnapshot(documentRef = globalThis.document, { maxNodes = 5000, maxCharacters = 50000 } = {}) {
  if (!documentRef?.documentElement) throw new Error('A live document is required.');
  const view = documentRef.defaultView ?? globalThis;
  const nodes = [];
  const elementIds = new WeakMap();
  let characters = 0;
  const walker = documentRef.createTreeWalker(documentRef.documentElement, view.NodeFilter?.SHOW_ELEMENT ?? 1);
  let element = walker.currentNode;
  while (element && nodes.length < maxNodes && characters < maxCharacters) {
    if (!isHidden(element, view)) {
      const tag = element.tagName;
      const role = element.getAttribute('role');
      if (SEMANTIC_TAGS.has(tag) || role || element.hasAttribute('aria-label')) {
        const label = safeLabel(element);
        const rect = element.getBoundingClientRect?.();
        const box = rect ? { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) } : null;
        const id = `dom-${nodes.length + 1}`;
        let parent = element.parentElement;
        let parentId = null;
        while (parent && !parentId) { parentId = elementIds.get(parent) ?? null; parent = parent.parentElement; }
        const node = {
          id,
          type: elementType(element),
          tag: tag.toLowerCase(),
          parentId,
          role: role || null,
          label,
          bounds: box,
          actions: ['button', 'link', 'field'].includes(elementType(element)) ? ['user-interaction-available'] : [],
          href: tag === 'A' && element.getAttribute('href') ? safeUrl(element.getAttribute('href'), documentRef.location?.href) : null,
          sensitive: tag === 'INPUT' && ['password', 'hidden'].includes(element.getAttribute('type')?.toLowerCase()),
        };
        nodes.push(node);
        elementIds.set(element, id);
        characters += label.length;
      }
    }
    element = walker.nextNode();
  }
  let safePageUrl = null;
  try { const pageUrl = new URL(documentRef.location?.href ?? 'about:blank'); if (['http:', 'https:'].includes(pageUrl.protocol)) safePageUrl = `${pageUrl.origin}${pageUrl.pathname}`; } catch { /* malformed location: retain a null URL */ }
  return Object.freeze({
    title: String(documentRef.title || '').slice(0, 500),
    url: safePageUrl,
    capturedAt: new Date().toISOString(),
    nodes: Object.freeze(nodes),
    truncated: nodes.length >= maxNodes || characters >= maxCharacters,
    source: 'browser-dom',
  });
}

/** Observes an AXON-owned browser document; it never reads form values or performs actions. */
export function createBrowserDomAdapter({ documentRef = globalThis.document, debounceMs = 100, maxNodes, maxCharacters } = {}) {
  let observer = null;
  let timer = null;
  let running = false;
  let callback = null;
  let sequence = 0;
  const emit = (kind = 'screen-transition') => {
    if (!running || typeof callback !== 'function' || documentRef.visibilityState === 'hidden') return;
    callback({ source: 'browser-dom', kind, payload: { snapshot: captureDocumentSnapshot(documentRef, { maxNodes, maxCharacters }) } });
  };
  const onVisibilityChange = () => { if (documentRef.visibilityState !== 'hidden') emit('screen-transition'); };
  return {
    source: 'browser-dom',
    async getCapabilities() { return [{ id: 'browser_dom_read', status: documentRef?.documentElement ? 'available' : 'unsupported', reason: 'Only the document owned by this browser context is readable.' }]; },
    async start({ onEvent }) {
      if (running) throw new Error('Browser DOM observer is already active.');
      const Observer = documentRef?.defaultView?.MutationObserver ?? globalThis.MutationObserver;
      if (!documentRef?.documentElement || typeof Observer === 'undefined') throw new Error('Browser DOM observation is unavailable.');
      running = true;
      callback = (event) => onEvent({ ...event, payload: { ...event.payload, localSequence: ++sequence } });
      observer = new Observer(() => {
        clearTimeout(timer);
        timer = setTimeout(() => emit('screen-transition'), debounceMs);
      });
      observer.observe(documentRef.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'aria-hidden', 'hidden', 'class', 'style', 'href', 'alt', 'title'] });
      documentRef.addEventListener?.('visibilitychange', onVisibilityChange);
      emit('screen-transition');
      return { granted: true, source: 'browser-dom' };
    },
    async stop() {
      running = false;
      clearTimeout(timer);
      observer?.disconnect();
      documentRef.removeEventListener?.('visibilitychange', onVisibilityChange);
      observer = null;
      callback = null;
      return { stopped: true };
    },
  };
}
