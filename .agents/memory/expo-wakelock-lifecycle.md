---
name: Expo wake-lock lifecycle
description: Runtime behavior to preserve when using expo-keep-awake in this mobile workspace
---

Guard tagged wake-lock cleanup behind a successful activation flag and catch release errors.

**Why:** Expo can throw when `deactivateKeepAwake` is called for a tag that was never activated, including the initial false-state cleanup and already-released native locks.

**How to apply:** When wiring `expo-keep-awake`, track activation completion with a ref, release only when that ref is true, and make both activation and cleanup tolerant of native rejection.