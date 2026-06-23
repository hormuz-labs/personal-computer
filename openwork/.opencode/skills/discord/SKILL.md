---
name: discord
description: Manages discord using agent-webbridge for reliable, generic tasks.
---

## Scripts

### `discord.js`
A generic core script for repeatable Discord automation actions, leveraging the `agent-webbridge` HTTP API. 

**Usage:**
`node scripts/discord.js <profile> <action> [args...]`

**Available Actions:**
- `switch-server <server_name>`: Locates and clicks on the specified server in the left sidebar.
- `dm <username> <message>`: Navigates to Direct Messages, finds the user, and sends them a message.
- `screenshot [path]`: Takes a full-page screenshot of the current Discord state to verify task completion.
- `read-messages [limit]`: Extracts the text of the last `limit` messages (default: 5) from the currently active channel.

### `send_message.js`
Sends a message to a specific channel.
- `node scripts/send_message.js <profile> <channel> <message>`: Switches to the specified channel (must be on the correct server first) and sends a text message.

### `discord_message.sh`
Wrapper script to combine actions (switch server + send message).
- `./scripts/discord_message.sh <profile> <server> <channel> "<message>"`

## Best Practices
1. **Verification**: When completing a task for the first time, use `node scripts/discord.js <profile> screenshot <path>` to visually verify the state of the web application.
2. **Genericity**: Add new repeatable functionality as actions inside `discord.js` rather than creating hardcoded or absolute path scripts.
3. **Session Consistency**: All scripts assume `agent-webbridge` is running (`awb status`).
