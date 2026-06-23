# agent-webbridge Setup (project-local)

## Prerequisites

- Google Chrome (macOS)
- Node >= 18

## One-time: Install the Chrome extension

```bash
awb setup "Work"
```

This opens `chrome://extensions`. You need to:
1. Toggle **Developer mode** ON
2. Click **Load unpacked**
3. Select the folder `npx awb setup` printed

The command auto-detects when you're done and proceeds.

## Daily use

```bash
awb status       # check fleet health
awb up "Work"    # start daemon + Chrome
awb down         # stop everything
awb doctor       # troubleshoot
```
