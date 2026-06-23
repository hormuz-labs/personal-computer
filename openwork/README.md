# OpenWork: Autonomous Multi-Platform Lead Nurturing CRM

This project is a high-performance, AI-driven automation suite designed to discover, track, and nurture leads across multiple social platforms (LinkedIn, Discord, X.com) with persistent history and intelligent follow-ups.

## 🚀 Core Features

- **Multi-Platform Automation**: Uses `agent-webbridge` (awb) to drive real Chrome profiles, maintaining authentic login sessions and avoiding bot detection.
- **Persistent CRM**: A local SQLite database (`leads.db`) tracks every lead, interaction, and funnel stage.
- **Scheduled Autonomy**: Integrated cron-job support allows Opencode to run background nurturing loops, report generation, and status updates.
- **Human-in-the-Loop**: Automated Telegram alerts via `tg-notify` for blockers like CAPTCHAs, 2FA, or critical decisions.
- **Python-Powered Intelligence**: A dedicated `.venv` equipped with data processing and document generation libraries (`pandas`, `reportlab`, `openpyxl`).

## 🛠 Project Structure

- `.opencode/skills/`: Custom agent capabilities.
    - `agent-webbridge`: Browser automation & human-in-the-loop logic.
    - `cron-jobs`: Scheduling and background task execution.
    - `lead-nurturing`: CRM management and cross-platform conversation flow.
- `leads.db`: SQLite database for persistent lead data.
- `.venv/`: Python virtual environment for specialized processing tasks.

## 📋 Getting Started

1. **Initialize Browser**: Ensure your `awb` profiles are set up (e.g., `awb up "Work"`).
2. **Start Opencode**: Run `opencode` to enter the interactive TUI.
3. **Execute Loops**:
   ```bash
   opencode run "Check LinkedIn for new messages and update our leads.db"
   ```

---

## 🔮 Future Roadmap: "Voice-of-the-Agent"

We are planning to expand beyond text-based interaction to include **autonomous voice outreach**.

### Upcoming Skill: `voice-outreach`
- **Lead Calling**: Integration with VoIP APIs (like Twilio or SignalWire) to allow the agent to place actual phone calls to leads.
- **Speech-to-Text (STT) & TTS**: Real-time transcription of calls and high-quality voice synthesis for natural conversation.
- **Voice Persistence**: Audio recordings of calls will be stored and linked to the `interactions` table in SQLite.
- **Hybrid Nurturing**: A seamless transition between text outreach and voice follow-ups based on lead response and sentiment analysis.
- **Automated Dialing**: Smart scheduling for calls based on the lead's local time zone and platform activity.

---

*Note: This project is intended for professional use. Always adhere to platform terms of service and local privacy regulations (GDPR/CCPA).*
