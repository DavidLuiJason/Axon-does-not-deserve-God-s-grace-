# Q4 — Preview Console Bridge (WP11)

**State:** TESTED in Node/jsdom against the real loopback preview server. **Tests:** 7/7. **Negative tests:** 5. **Real compiled-module mutant:** YES — removing source/origin validation was caught.

**Implemented:** nonce-bound page bridge wraps console methods and reports script errors/unhandled rejections. Receiver accepts messages only when origin, iframe source, channel token and event type match. Event count and aggregate bytes are capped. Preview CSP adds a sandbox directive, script nonce, `nosniff`, and existing loopback/Host-header restrictions.

**Hostile cases:** forged iframe source, foreign origin, wrong token, unsupported message type, closed bridge, oversized event payload, event-count cap, and foreign Host header.

**NOT RUN:** Android WebView behaviour and a physical browser mount of the full workbench. jsdom is not a WebView substitute.
