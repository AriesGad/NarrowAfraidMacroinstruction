---
name: Expo dependency installation
description: Workspace-specific dependency installs for Expo modules
---

When adding Expo modules to this pnpm workspace, target the Expo package explicitly rather than the workspace root.

**Why:** The package installer callback may invoke pnpm add at the root, which fails with the workspace-root safety check.

**How to apply:** Use the package's workspace filter for Expo module installs and then restart the managed Expo workflow once dependencies are installed.
