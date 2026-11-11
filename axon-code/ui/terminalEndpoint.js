export function assertLoopbackTerminalEndpoint(rawUrl) {
  const endpoint = new URL(rawUrl);
  if (endpoint.hostname !== '127.0.0.1' || endpoint.protocol !== 'ws:' || endpoint.pathname !== '/session') {
    throw new Error('PTY bridge must use ws://127.0.0.1/<session>.');
  }
  return endpoint;
}
