---
name: cron-jobs
description: Manage and schedule recurring tasks (cron jobs) that run opencode to perform autonomous work like report generation or social media interaction. Use when the user wants to schedule a task to run automatically at specific times.
---

# Cron Jobs

Use this skill to schedule autonomous opencode tasks using the system's `crontab`.

## How it works

Opencode can be scheduled to run in the background using the `opencode run` command. This allows for recurring tasks such as:
- Generating daily/weekly reports (CSV, XLSX, PDF).
- Interacting with platforms like LinkedIn using `agent-webbridge`.
- Monitoring and processing data.

## Scheduling a Job

To schedule a job, use the `crontab -e` command to add a new entry.

### Cron Format
`* * * * * command_to_execute`
- - - - -
| | | | |
| | | | ----- Day of week (0 - 7) (Sunday=0 or 7)
| | | ------- Month (1 - 12)
| | --------- Day of month (1 - 31)
| ----------- Hour (0 - 23)
|------------- Minute (0 - 59)

### Example: Run a LinkedIn update every day at 9 AM

```bash
0 9 * * * cd /absolute/path/to/project/workspace && opencode run "Using the 'Work' profile in awb, check my LinkedIn notifications and summarize them into a daily_summary.md file"
```

## Python Integration

This project includes a Python virtual environment (`.venv`) inside the `workspace` directory with libraries for document generation (`pandas`, `openpyxl`, `python-docx`, `reportlab`).

To use it in a cron job:

```bash
0 18 * * * cd /absolute/path/to/project/workspace && ./.venv/bin/python -m opencode run "Generate the weekly sales report in XLSX format"
```

*Note: If running opencode directly, ensure the venv's python is used if the task requires specific python libraries.*

## Using agent-webbridge (awb)

When running tasks that require a browser, ensure the `awb` daemon is running for the required profile. You can include `awb up` in your cron command.

Example (adjust the path to `awb` if necessary, e.g., `awb` or `/usr/local/bin/awb`):
```bash
0 10 * * * cd /absolute/path/to/project/workspace && awb up "Work" && opencode run "Post a status update on LinkedIn"
```

## Best Practices

1. **Absolute Paths**: Always use absolute paths for `cd`, the `opencode` binary, and `awb` in your `crontab` because `cron` runs in a minimal environment and usually defaults to your home directory (`$HOME`).
2. **Logging**: Redirect output to a log file to debug failed cron jobs:
   `... >> /tmp/opencode_cron.log 2>&1`
3. **Environment Variables**: Cron jobs run with a minimal environment. If `opencode` or `awb` needs specific environment variables (like API keys), define them in the crontab or in a wrapper script.
4. **Human Approval**: For background tasks that encounter blockers (CAPTCHAs, 2FA), the agent will automatically use the `telegram-notify` skill to alert you with a screenshot. Ensure `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set in the environment where the cron job runs.
