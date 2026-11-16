# AXON AUTO-CLICKER (D47, 2026-11-14)
PLAIN: AXON can run saved routines of taps, swipes, scrolls, typing and waits, inside AXON (INTERNAL) or in other apps (EXTERNAL), in rounds, on a timer, even while AXON is in the background. It goes further than a click-recorder: a step can name a button, describe what the button does ("goes to the next page"), or point at a spot, and AXON finds it by itself; AXON can also type. Everything still passes the action gate. Nothing can run until the owner approves that exact routine.
SAFETY (the rules the build is held to):
1. Approval is bound to the routine's content (a fingerprint). Any edit to steps, targets, repeat or limits cancels it.
2. Pre-approval exists ONLY for typing and switch steps. A tap on anything that pays, sends, deletes or signs in, any step in a money, wallet or password app, and any sign-in screen ALWAYS stops and asks, every time.
3. A coordinate tap or swipe is judged by what is really under the point: if a "Pay" or "Delete" button is there, it asks, whatever the routine claims.
4. A red STOP button is drawn over every app while a routine runs (Android accessibility overlay: no draw-over-apps permission). Pressing it sets a kill switch on the phone itself; every action and gesture refuses while it is set, even if the JavaScript side hangs. A routine in OTHER apps will not start if the STOP button cannot be shown or the kill switch is unavailable.
5. Hard limits: 150 ms minimum between rounds, at most 5000 actions, at most 6 hours, defaults 500 actions and 10 minutes; stuck detection (screen not changing), three failures in a row, app left, owner stop, time and action limits.
6. Passwords and card-like numbers are never typed. Recording never captures typed text, password fields, money or password apps, or AXON's own events when recording other apps.
WHAT IS BUILT (src/axon-autoclicker, src/axon-system, Android side in android-overlay/.../screenstructure):
- routine-model.mjs: routine format, validation in plain words, target finding (label, alias, part of a label, or the owner's own description), approval fingerprint.
- routine-runner.mjs: runs an approved routine; pauses at every question it may not answer; preview in plain words.
- recorder.mjs + Android event recorder: turns what the owner does into a DRAFT routine by label (with a fallback point). Typing is added by hand.
- routine-store.mjs: save/load/approve/remove routines, schedules (every N minutes, daily at a time, chosen weekdays); storage is injected.
- routine-scheduler.mjs: tick() starts due, approved routines, once per slot, never two at once.
- screen-watcher.mjs: wait for text, text gone, an app in front, or a quiet screen; watch for changes.
- AXON gate: coordinate tap, long press and swipe with hit-testing of what is underneath.
- Android: performGesture (tap, long press, swipe, after re-checking the app in front), kill switch, STOP overlay, recorder.
- src/axon-system/create-screen-system.mjs: one object with the reader, AXON Apps, the auto-clicker, the recorder, a status line and the phone self-test.
NOT BUILT (and why): (a) every screen: the routine editor, the floating panel, the list of apps, the self-test screen (screens wait for the owner and all Directors); (b) connecting any of this to chat, tools or the brain (tool-connection lane, D471); (c) real persistence (the storage lane plugs into routine-store's backend); (d) the background wake-up that calls scheduler.tick() once a minute (it belongs to the Android background runtime, stage 6.x; unproven here); (e) multi-finger gestures and pinch; (f) anything proven on a real phone.
UNPROVEN ON PHONE (honest list): Java compiled only against stand-in Android classes; gestures on real apps (games and canvas apps may ignore accessibility gestures); the STOP overlay position and look on different phones; accessibility events from WebView and from apps that hide them; background survival and background app launching.
