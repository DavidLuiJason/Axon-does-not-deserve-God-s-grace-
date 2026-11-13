# AXON integration contract

This package is standalone and has not been integrated into AXON. Before integration, Claude must read the supplied current AXON roadmap and inspect the actual repository tree, app entrypoint, navigation/overlay patterns, state management, storage abstraction, theme tokens, and task/resource governor. Do not infer architecture from old documentation alone.

Required integration behaviors: open Games in a foreground overlay/surface; close/minimize returns to AXON without losing the active round; respect host theme; use the real persistence abstraction if available; keep global and per-game history; register capabilities only if the actual host architecture supports them; bound history and timers; clean up timers/listeners on close; avoid background resource reservation.

Do not overwrite App.tsx or other files wholesale. Propose a file-level plan first, preserve locked UI/assets/copy/dependencies, make the smallest scoped changes, capture baseline hashes, run tests, and report exact changed paths and evidence. Do not claim full chess/Go/Draughts/Reversi/Hex or adaptive teaching is complete unless independently implemented and tested.
