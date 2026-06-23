---
name: agent-webbridge
description: Drive the user's real Chrome — multiple profiles with live logins, multiple tabs per profile, all in parallel — via agent-webbridge. Clean-room, MIT, no account, no telemetry, no Playwright. Use for browser automation tasks requiring real logged-in Chrome sessions, multi-account workflows, or concurrent tab operations.
allowed-tools: Bash(awb:*), Bash(curl:*), Bash(tg-notify:*)
---

# agent-webbridge

Clean-room browser automation for AI agents. Drives the user's actual Chrome — multiple profiles with live logins, multiple tabs per profile, all in parallel. A Node daemon runs per profile on a deterministic hashed port; a router on `http://127.0.0.1:10086` proxies `/command` to the right daemon by a top-level `"profile"` field.

## When to use

- Any browser/web/"open this URL"/navigate/click/read-a-page task in the user's own Chrome
- Multi-account workflows (Work + Personal profiles simultaneously)
- Concurrent tab operations (N tabs in one profile running in parallel)
- Tasks where real login state matters (unlike headless Playwright/Puppeteer)

## Health check (always do this first)

```bash
awb status
```

## Quick reference

### Start/stop the fleet
```bash
awb up "ProfileName"
awb down
awb status
```

### Send commands (HTTP API)
```bash
curl -s -X POST http://127.0.0.1:10086/command \
  -H 'Content-Type: application/json' \
  -d '{"action":"navigate","args":{"url":"https://example.com"},"session":"task-name","profile":"Work"}'
```

### Available tools

| Tool | Args | Returns |
|------|------|---------|
| `navigate` | `url`, `newTab`(bool), `group_title` | `{success, url, tabId}` |
| `find_tab` | `url`, `active`(bool) | Select existing tab as current |
| `snapshot` | — | Accessibility tree with `@e` refs |
| `click` | `selector` (@e ref or CSS) | `{success, tag, text}` |
| `fill` | `selector`, `value` | `{success, tag, mode}` |
| `evaluate` | `code` (async/await OK) | `{type, value}` |
| `screenshot` | `format`(png/jpeg), `quality`, `selector`, `path` | `{format, path}` |
| `network` | `cmd`(start/stop/list/detail) | Request/response data |
| `upload` | `selector`, `files`(string[]) | `{success, fileCount}` |
| `save_as_pdf` | `paper_format`, `landscape`, `scale`, `path` | `{path, sizeBytes}` |
| `list_tabs` | — | `{tabs: [{tabId, url, title}]}` |
| `close_tab` | — | `{success, closed}` |
| `close_session` | — | `{success, closed: int}` |

### Sessions

One task = one session = one Chrome tab group. Pick a session name when the task starts, put it on every command, never change it mid-task.

### Tab management

- `navigate` with `newTab:true` opens a new tab
- `find_tab` with URL switches back to an existing tab
- `list_tabs` shows all open tabs

### Screenshots & PDFs

Returns a file path (not base64). Use the Read tool to view.

## Human-in-the-Loop & Telegram

If `agent-webbridge` encounters a blocker that requires human intervention (e.g., a CAPTCHA, 2FA, or an ambiguous UI state), it must reach out to the user via Telegram using the `tg-notify` tool.

### When to notify:
- **CAPTCHA**: If a page displays a CAPTCHA that prevents automated progress.
- **2FA/Login**: If a site asks for a one-time code or manual login confirmation.
- **Ambiguity**: If the agent is unsure how to proceed with a critical action (e.g., "Which lead should I message first?").

### How to notify:
1. Take a screenshot of the blocker using the `screenshot` tool.
2. Send the screenshot and a descriptive message to the user via `tg-notify`.

**Example:**
```bash
# 1. Take screenshot
curl -s -X POST http://127.0.0.1:10086/command \
  -H 'Content-Type: application/json' \
  -d '{"action":"screenshot","args":{"path":"/tmp/captcha_block.png"},"session":"lead-gen","profile":"Work"}'

# 2. Notify user
tg-notify "⚠️ I've encountered a CAPTCHA on LinkedIn. Please solve it in the 'Work' profile Chrome window so I can continue." "/tmp/captcha_block.png"
```
