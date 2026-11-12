# AXON Web — Complete Browser Parity Matrix

**Catalogue source:** `src/web/browserCommandGateway.ts` (118 function IDs).
**Current evidence:** cumulative Round 1 + Round 2 Batches 1–4 source. These are source-level statuses, not APK/runtime/device certification.
**AXON access:** all commands remain blocked until a real native isolated AXON browser context is implemented and independently verified.

## How to read the matrix

- **Owner host** = native Activity/UI method exists in source; `PARTIAL` means related behavior exists but not the full contract.
- **Owner command** = BrowserController -> typed Capacitor method -> native host route exists in source.
- **AXON access** = remains `BLOCKED_NO_ISOLATED_SESSION`; a TS identity guard does not prove WebView data-store isolation.
- **Effect** is the permission/risk class, not implementation evidence.

## Summary

| Measure | Count |
|---|---:|
| Catalogue functions | 118 |
| Catalogue groups | 8 |
| Owner host implemented | 39 |
| Owner host partial | 3 |
| Owner command executors | 37 |
| AXON-enabled functions | 0 |

## Group coverage

| Group | Total | Owner host complete | Owner host partial | Owner command executors | Not ready | AXON enabled |
|---|---:|---:|---:|---:|---:|---:|
| Navigation | 17 | 12 | 0 | 11 | 5 | 0 |
| Tabs | 14 | 3 | 2 | 3 | 9 | 0 |
| Saved browsing | 15 | 14 | 1 | 14 | 0 | 0 |
| Files | 13 | 8 | 0 | 7 | 5 | 0 |
| Page tools | 16 | 1 | 0 | 1 | 15 | 0 |
| Site security | 19 | 1 | 0 | 1 | 18 | 0 |
| Accounts | 8 | 0 | 0 | 0 | 8 | 0 |
| Settings | 16 | 0 | 0 | 0 | 16 | 0 |

## Function-by-function matrix

| Function ID | Group | Effect | Owner host | Owner command | AXON access | Evidence |
|---|---|---|---|---|---|---|
| `address.navigate` | `Navigation` | `READ` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `address.search` | `Navigation` | `READ` | `IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | Native host source implements the owner-facing operation; no AXON command executor. |
| `navigation.back` | `Navigation` | `READ` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `navigation.forward` | `Navigation` | `READ` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `navigation.reload` | `Navigation` | `READ` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `navigation.stop` | `Navigation` | `READ` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `navigation.home` | `Navigation` | `READ` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `navigation.copyUrl` | `Navigation` | `REVERSIBLE` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `navigation.shareUrl` | `Navigation` | `OWNER_CONFIRM` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `navigation.openExternal` | `Navigation` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `navigation.requestDesktopSite` | `Navigation` | `REVERSIBLE` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `navigation.findInPage` | `Navigation` | `READ` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `navigation.zoom` | `Navigation` | `REVERSIBLE` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `navigation.fullscreen` | `Navigation` | `REVERSIBLE` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `navigation.securityDetails` | `Navigation` | `READ` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `address.suggestions` | `Navigation` | `READ` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `navigation.generateQr` | `Navigation` | `REVERSIBLE` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `tabs.create` | `Tabs` | `REVERSIBLE` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `tabs.close` | `Tabs` | `REVERSIBLE` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `tabs.restoreClosed` | `Tabs` | `REVERSIBLE` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `tabs.switch` | `Tabs` | `REVERSIBLE` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `tabs.duplicate` | `Tabs` | `REVERSIBLE` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `tabs.createGroup` | `Tabs` | `REVERSIBLE` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `tabs.renameGroup` | `Tabs` | `REVERSIBLE` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `tabs.moveToGroup` | `Tabs` | `REVERSIBLE` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `tabs.closeOthers` | `Tabs` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `tabs.suspend` | `Tabs` | `REVERSIBLE` | `PARTIAL` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | Inactive WebView renderer is destroyed/saved for memory; no explicit suspend command. |
| `tabs.restoreSession` | `Tabs` | `REVERSIBLE` | `PARTIAL` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | Native host restores persisted normal-tab URLs; no explicit controller command. |
| `tabs.listRecent` | `Tabs` | `READ` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `tabs.pin` | `Tabs` | `REVERSIBLE` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `tabs.closeGroup` | `Tabs` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `bookmarks.add` | `Saved browsing` | `REVERSIBLE` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `bookmarks.edit` | `Saved browsing` | `REVERSIBLE` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `bookmarks.remove` | `Saved browsing` | `REVERSIBLE` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `bookmarks.list` | `Saved browsing` | `READ` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `bookmarks.createFolder` | `Saved browsing` | `REVERSIBLE` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `bookmarks.move` | `Saved browsing` | `REVERSIBLE` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `history.search` | `Saved browsing` | `READ` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `history.clear` | `Saved browsing` | `OWNER_CONFIRM` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `history.openEntry` | `Saved browsing` | `READ` | `PARTIAL` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | Native history dialog can open an entry; no controller command. |
| `history.clearBySite` | `Saved browsing` | `OWNER_CONFIRM` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `readingList.add` | `Saved browsing` | `REVERSIBLE` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `readingList.remove` | `Saved browsing` | `REVERSIBLE` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `readingList.open` | `Saved browsing` | `READ` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `readingList.markRead` | `Saved browsing` | `REVERSIBLE` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `readingList.list` | `Saved browsing` | `READ` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `downloads.list` | `Files` | `READ` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `downloads.pause` | `Files` | `REVERSIBLE` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | The Android DownloadManager host does not expose this control in the current implementation. |
| `downloads.resume` | `Files` | `REVERSIBLE` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | The Android DownloadManager host does not expose this control in the current implementation. |
| `downloads.cancel` | `Files` | `OWNER_CONFIRM` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `downloads.open` | `Files` | `OWNER_CONFIRM` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `downloads.share` | `Files` | `OWNER_CONFIRM` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `downloads.delete` | `Files` | `OWNER_CONFIRM` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `downloads.retry` | `Files` | `REVERSIBLE` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | The Android DownloadManager host does not expose this control in the current implementation. |
| `downloads.openFolder` | `Files` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | The Android DownloadManager host does not expose this control in the current implementation. |
| `files.upload` | `Files` | `OWNER_CONFIRM` | `IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | Native WebView file chooser -> Android ACTION_OPEN_DOCUMENT; no BrowserController executor. |
| `files.open` | `Files` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `files.print` | `Files` | `OWNER_CONFIRM` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `files.savePdf` | `Files` | `OWNER_CONFIRM` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `page.read` | `Page tools` | `READ` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `page.extract` | `Page tools` | `READ` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `page.followLink` | `Page tools` | `READ` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `page.capture` | `Page tools` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `page.translate` | `Page tools` | `REVERSIBLE` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `page.readerMode` | `Page tools` | `REVERSIBLE` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `page.listen` | `Page tools` | `REVERSIBLE` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `page.spellcheck` | `Page tools` | `REVERSIBLE` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `page.selectText` | `Page tools` | `REVERSIBLE` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `page.copyText` | `Page tools` | `REVERSIBLE` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `page.shareContent` | `Page tools` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `page.accessibility` | `Page tools` | `REVERSIBLE` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `page.installWebApp` | `Page tools` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `page.mediaPlayPause` | `Page tools` | `REVERSIBLE` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `page.mediaSeek` | `Page tools` | `REVERSIBLE` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `page.mediaVolume` | `Page tools` | `REVERSIBLE` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `site.viewInfo` | `Site security` | `READ` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `site.viewPermissions` | `Site security` | `READ` | `IMPLEMENTED` | `IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | BrowserController executor -> typed Capacitor plugin -> native host method. |
| `site.changePermission` | `Site security` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `site.clearData` | `Site security` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `site.manageCookies` | `Site security` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `site.manageNotifications` | `Site security` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `site.requestCamera` | `Site security` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `site.requestMicrophone` | `Site security` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `site.requestLocation` | `Site security` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `site.requestNotifications` | `Site security` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `site.requestBluetooth` | `Site security` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `site.requestUsb` | `Site security` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `site.requestMidi` | `Site security` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `site.requestSerial` | `Site security` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `site.requestWebRtc` | `Site security` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `security.safeBrowsingSettings` | `Site security` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `security.trackingProtectionSettings` | `Site security` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `security.certificateDetails` | `Site security` | `READ` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `security.reportUnsafeSite` | `Site security` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `accounts.startSignIn` | `Accounts` | `OWNER_HANDOFF` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `accounts.signOut` | `Accounts` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `credentials.openManager` | `Accounts` | `OWNER_HANDOFF` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `credentials.generatePassword` | `Accounts` | `OWNER_HANDOFF` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `credentials.fillPassword` | `Accounts` | `OWNER_HANDOFF` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `credentials.usePasskey` | `Accounts` | `OWNER_HANDOFF` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `autofill.address` | `Accounts` | `OWNER_HANDOFF` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `autofill.payment` | `Accounts` | `OWNER_HANDOFF` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `settings.view` | `Settings` | `READ` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `settings.change` | `Settings` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `settings.searchEngine` | `Settings` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `settings.language` | `Settings` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `settings.accessibility` | `Settings` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `settings.clearBrowsingData` | `Settings` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `settings.exportData` | `Settings` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `settings.importData` | `Settings` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `settings.resetBrowser` | `Settings` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `settings.defaultBrowser` | `Settings` | `OWNER_HANDOFF` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `settings.homePage` | `Settings` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `settings.newTabPage` | `Settings` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `settings.clearCache` | `Settings` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `settings.sync` | `Settings` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `extensions.manage` | `Settings` | `OWNER_CONFIRM` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |
| `diagnostics.view` | `Settings` | `READ` | `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` | `BLOCKED_NO_ISOLATED_SESSION` | No implementation evidence in the current cumulative source snapshot. |

## Known boundaries

- Android host functions are present in source but have not yet passed actual Java/Capacitor compilation or native runtime testing.
- Download pause/resume/retry/open-folder are not implemented. Downloads currently track DownloadManager IDs created by AXON Web; the owner can list, open, share, cancel/remove and delete tracked items.
- Print/PDF opens the Android print UI; selecting Save as PDF remains an owner action in the system print interface.
- Certificate subject/issuer is informational only; this is not a certificate-chain validator.
- Site permissions report the current fixed-deny policy for camera, microphone and geolocation; there is no grant UI.
- Bookmark/history/reading-list actions are owner-only and app-private. AXON cannot invoke them on the owner session.
- The native owner tabs continue to share their normal WebView cookie store. No AXON session, incognito profile, or Stealth network layer exists.
