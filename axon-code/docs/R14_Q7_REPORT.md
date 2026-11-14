# Q7 — Android Background Sources (T3)

**State:** BUILT — SOURCE ONLY; FAKE_HOST contract TESTED. **Tests:** 7/7. **Negative tests:** 3. **Real compiled-module mutant:** YES — removing required host-method validation was caught.

**Implemented:** Android foreground service source, low-importance notification channel, Pause and Cancel notification actions, manifest foreground-service/notification permissions, and the existing Storage Access Framework workspace provider. A named `FAKE_HOST` contract exercises channel creation, start, notification actions and SAF grant release.

**Hostile cases:** missing host/methods, malformed SAF grant, missing capability declarations, and action contract refusal.

**NOT RUN:** Gradle build, APK/AAB, installation, physical device, notification permission prompt, foreground service survival, notification action delivery, and persisted SAF grant behaviour. FAKE_HOST results are not Android provider evidence. `JobActionDispatcher.current` still needs registration by the real Android host integration.
