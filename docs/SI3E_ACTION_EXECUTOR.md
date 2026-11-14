# SI3e ACTION EXECUTOR (D47, 2026-11-14)
PLAIN: AXON can now carry out an action on another app (tap, long-press, type, switch, scroll, Back, Home), but only through the action gate: plain navigation runs, risky things wait for your yes. Before acting, Android re-checks that the same app and the same button are still there; if the screen changed it does nothing. It never types into password fields and uses no screen gestures. Not called by any screen yet.
NEEDS MERGED FIRST: SI3B (accessibility reader), SI3D (action gate).
EDITED (all D47's own SI3B files): AxonAccessibilityService.java (+perform and helpers), ScreenStructurePlugin.java (+performAction, status canAct), axon_accessibility_strings.xml (honest description), structure-source.mjs (+performAction), tests/screen-structure-source.test.mjs (read-only test replaced by narrow-executor test). NEW: screen-actor.mjs, tests/screen-actor.test.mjs.
NOT INCLUDED: open-app (needs the installed-app list and Android package visibility; it is AXON Apps work, SI6). The actor reports open-app-not-built.
RE-ENABLE: after this build installs, turn "AXON screen reader" off and on once in Accessibility settings so Android picks up the service.
STATUS: JS ISOLATED-TESTED. Java compiled only against stand-in Android classes here; real compile = the cloud build. Phone behaviour NOT RUN (SI4).
