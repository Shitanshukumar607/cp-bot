# CP Bot

A Discord bot for verifying Codeforces accounts and tracking competitive programming stats.

**Hosted on Microsoft Azure** for reliable 24/7 uptime.

## Add to Your Server

[**Invite CP Bot**](https://discord.com/oauth2/authorize?client_id=1461056439970697216)

## Features

- **Account Verification** - Link your Codeforces account via Compilation Error verification
- **Auto Role Sync** - Automatically assigns Discord roles based on CF rating
- **Profile & Leaderboard** - View stats and server rankings
- **Roast Command** - Fun roasts based on your CF profile

## Commands

| Command                       | Description                |
| ----------------------------- | -------------------------- |
| `/link codeforces <username>` | Start account verification |
| `/verify`                     | Complete verification      |
| `/profile [user]`             | View CF profile            |
| `/leaderboard`                | Server rankings            |
| `/roast [user]`               | Roast a user's CF stats    |
| `/setup`                      | Configure roles (Admin)    |
| `/help`                       | Show all commands          |

## Setup

### Prerequisites

- Node.js v18+
- Supabase account
- Discord Bot Token

### Installation

```bash
npm install
```

### Environment Variables

Create `.env`:

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

### Database

Run [supabase-schema.sql](supabase-schema.sql) in your Supabase SQL editor.

### Run

```bash
npm run deploy  # Register commands
npm start       # Start bot
```
