---
name: mac-notify
description: Sends desktop notifications to macOS. Use this when the user wants to be notified on their Mac when a task is completed or requires attention.
---

# macOS Notifications

Use this skill to trigger native macOS desktop notifications using `osascript`.

## Usage

You can send a notification with a title and a message.

### Bash Command
```bash
osascript -e 'display notification "The task has been completed successfully." with title "opencode" subtitle "Task Complete"'
```

## When to use
- When a long-running task finishes.
- When you need to grab the user's attention.
- When explicitly requested by the user.
