# Q3 — Language Server Hostile Frames (WP10)

**State:** TESTED. **Tests:** 9/9. **Negative tests:** 8. **Real compiled-module mutant:** YES — removing the Content-Length bounds was caught.

**Implemented:** strict LSP frame decoder with bounded header/body buffers, duplicate Content-Length rejection, Content-Length validation, JSON-RPC 2.0 validation, FIFO response matching, duplicate/unknown response refusal, notification flood cap, truncated-frame detection and per-request timeout. The real TypeScript language server remains exercised by the existing P11 suite.

**Hostile cases:** malformed header, duplicate Content-Length, huge/negative Content-Length, truncated body, out-of-order response, duplicate response, notification flood, oversized unterminated header, and a server that never answers. The no-response child was timed out and terminated.

**BLOCKED / NOT RUN:** none for Node protocol fixtures. This does not validate Android/WebView transport or prove a remote LSP host.
