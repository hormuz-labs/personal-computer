---
name: scheduled-tasks
description: Schedule one-off tasks (e.g., notifications or commands) to run once at a specific time using the `at` command.
---

# Scheduled Tasks (One-off)

Use the `at` command to schedule tasks that run once at a specific time or after a delay.

## Usage

The `at` command is very flexible and supports both absolute times and relative offsets.

### Examples

**Note**: The `at` command runs with the working directory you were in when you submitted it. It is generally safer to `cd` to the absolute path of your `workspace` folder before running `opencode run` if you submit the job from somewhere else.

```bash
# Schedule at a specific time
echo "osascript -e 'display notification \"Meeting starting\"'" | at 3:30 PM

# Schedule after a delay (Ensuring the correct working directory)
echo "cd /absolute/path/to/project/workspace && opencode run 'Generate report'" | at now + 30 minutes

# Schedule on a specific date
echo "cd /absolute/path/to/project/workspace && rm -rf ./tmp" | at 11:00 PM Jul 25
```

## Setup (Required once)
On macOS, the `at` daemon is disabled by default. You must enable it once for these tasks to execute:
```bash
sudo launchctl load -w /System/Library/LaunchDaemons/com.apple.atrun.plist
```

## When to use
- One-time notifications or reminders.
- Scheduling a single command to run in the future.
- Running a cleanup or summary task after a delay.
