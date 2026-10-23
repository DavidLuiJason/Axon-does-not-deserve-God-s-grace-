# AXON OPEN ITEMS (everything not done; the owner's words recorded 2026-10-23; update with every merge)

Evidence labels: MEASURED, OWNER-REPORTED, DEVICE, NOT RUN, HYPOTHESIS. Nothing here is built unless it says so. Rule (roadmap section 1): nothing is added to a screen without a plan and a design check first.

## A. Look and feel (each needs a plan and a design check before any prompt)
- LIGHT AND DARK MODE (OWNER-REPORTED): the app has always been dark and the owner likes the design. Add a setting for light and dark (also "follow the phone"). The orange-red brand colour (logo and accents) stays the same; only text and background colours change.
- APP ICON (the picture under the app name on the phone's home screen; also called logo): NOT DESIGNED yet. Design it first, then build it.
- STATUS BAR (the top strip with time, notification icons, signal and battery): does not match the app's colour and theme. It must follow the page, like professional apps. In light mode it must follow the light page.
- INPUT HINT (the grey text in the empty message box): the owner liked a hint that changes, for example "/" for commands, but it must not change constantly: once per session or similar. Not decided.
- CHAT LIST (long-press on a chat): Rename, Delete, Export. No extra buttons.
- THE TOGGLE BUTTON above the message bar (the chat or web switch): its meaning depends on the page. Main chat: probably nothing (the owner already talks to AXON directly). AXON Web: dims the web page so the chat shows clearly; tapping again returns to scrolling. AXON App and other pages: to be decided page by page; some pages may share a meaning. A settings page lists each page and lets the owner choose what the button does there, from a list of possible actions.
- USER MANUAL in settings: what each button does and how AXON works.
- The owner asked that each part that should stay fixed on a screen really is fixed, and that every part is checked as "is it supposed to be this way?" (design check).

## B. Tools
- Image tools are incomplete (OWNER-REPORTED). The image view fix A09 (Image editor view) is with the owner for testing.
- Some tools are dimmed and lifeless (cannot be opened, no tool behind them). The dimmed entries are listed in `src/tools/toolCatalog.ts`; the list per tool group is NOT YET WRITTEN here.
- Most tools have not been tested on the phone, so it is not known whether they work (OWNER-REPORTED). Phone checks pending: A13 (Calculator keypad), A14 (Video Frames), A09 (image view).
- Video to Audio waits for the V1 probe and the native decision. Backup and Restore and Source hub S3 wait for the owner.

## C. Build and repository
- RED MARKS (OWNER-REPORTED, 2026-10-23): some red marks flash in the GitHub build. They have been there for a long time and the build still finishes (cloud build passed on the B03P merge). NOT shown to the Director yet; not known whether they are real errors. Action: the owner sends a screenshot or the log text; the Director classifies them. Not fixed now.
- The repository roadmap `docs/ROADMAP.md` was still v16.8 before this update; the root file `AXON_ROADMAP.md` is a stale v14.4 copy (already on `docs/CLEANUP_CANDIDATES.md` as stale).
- Measured state of the main chat screen: NOT RECORDED.

## D. Cleanup notes (stage Z; roadmap section 11)
- Cleanup is the LAST stage. Each item needs a reason and its proof; nothing is removed by name pattern.
- Example of why: `docs/prompts/` looks like clutter but holds live prompts (B03A's prompt lives there).
- The oldest roadmap v15.1 is already in `docs/archive/`; do not import it again, and do not read it unless a check names a section.
- Add every candidate to `docs/CLEANUP_CANDIDATES.md` (add only).

## E. Brain notes from the owner
- For every message AXON first asks who it is for, what it is meant to do and what it refers to (see `docs/BRAIN_PLAN.md`, addendum 2026-10-23).
