---
name: lead-nurturing
description: Autonomous lead nurturing and conversation management across multiple platforms (LinkedIn, Discord, X.com). Uses SQLite for persistent storage of lead data and interaction history.
---

# Lead Nurturing & CRM

Use this skill to manage lead generation, nurturing, and persistent conversation history across multiple social platforms.

## Core Architecture

1.  **Storage**: A local SQLite database (`leads.db`) is used to store lead profiles, conversation history, and funnel status.
2.  **Automation**: `agent-webbridge` (awb) is used to interact with LinkedIn, Discord, and X.com.
3.  **Intelligence**: Opencode processes conversations, determines the next nurturing step, and updates the database.

## SQLite Database Structure

The project uses a database at `/Users/shanurrahman/Documents/relocal/personal-computer/openwork/leads.db`.

### Key Tables
- `leads`: Core lead data (name, platform, profile_url, current status, last interaction).
- `interactions`: Full message history (lead_id, direction, platform, content, timestamp).
- `platform_accounts`: Managed accounts/profiles used for outreach (e.g., 'Work' profile on LinkedIn).
- `nurture_templates`: Pre-defined or AI-generated messaging templates for different funnel stages.
- `funnel_status_definitions`: Descriptive labels for the lead nurturing lifecycle (New, Contacted, Replied, etc.).

## Workflow Example: Daily Nurturing

To nurture leads, Opencode should:
1.  **Fetch Jobs**: Read the database to find leads that need follow-ups.
2.  **Browser Action**: Use `awb` to navigate to the platform and specific profile/message.
3.  **Engage**: Read recent messages, generate a relevant reply, and send it.
4.  **Update**: Log the interaction and update the lead status in SQLite.

### Running a Nurturing Loop

```bash
# Example command to trigger the loop
opencode run "Check leads.db for LinkedIn leads that haven't been contacted in 3 days. Use the 'Work' awb profile to send them a personalized follow-up based on our previous chat, then update the interaction log."
```

## Platform-Specific Guidance

- **LinkedIn**: Use the 'Work' profile. Focus on connection requests and InMail.
- **Discord**: Focus on specific channels or DMs.
- **X.com**: Monitor mentions or send DMs to interested profiles.

## Python Integration for CRM

You can use the `.venv` python inside the `workspace` directory to run custom scripts for database management or complex lead scoring.

If running from a background task (like `cron` or `at`), ensure you `cd` into the workspace using an absolute path:

```bash
cd /absolute/path/to/project/workspace && ./.venv/bin/python -c "import sqlite3; conn = sqlite3.connect('../leads.db'); ..."
```

## Best Practices

1.  **Rate Limiting**: Avoid sending too many messages at once to prevent platform bans.
2.  **Personalization**: Always reference specific details from the persistent interaction log.
3.  **Data Integrity**: Ensure every message sent by Opencode is recorded in the `interactions` table and that lead `status` is updated immediately after a state change.
4.  **Template Usage**: Use the `nurture_templates` table to maintain a consistent brand voice across different platforms.
5.  **Human Intervention**: If a platform flags an account or requires a manual action (CAPTCHA), Opencode will notify you via Telegram with a screenshot. You should resolve the issue in the relevant Chrome profile and then notify Opencode to resume.
