# Bug reports

`tools/bug-reports` works the Discord forum that the in-game bug button posts to: it reads
reports and replies, downloads their files, replies, sets tags, closes posts, and tells the
reporter as their report reaches each milestone. The agent-facing procedure lives in
`.agents/skills/bug-reports/SKILL.md`; the commands are in `--help`:

```bash
node tools/bug-reports/src/cli.mjs --help
node tools/bug-reports/src/cli.mjs check
```

## Configuration

It acts as the site's own bot, the one `BugReportService` posts reports with. The token comes
from `DISCORD_BOT_TOKEN`, else from `.secrets/discord-bot-token` in this checkout or, from a git
worktree, in the main worktree. Create that file once with the bot token from the Discord
developer portal (your app, Bot page):

```bash
mkdir -p .secrets && (umask 077 && read -rsp 'Bot token: ' TOKEN && echo "$TOKEN" > .secrets/discord-bot-token)
```

The forum is `DISCORD_BUG_REPORT_CHANNEL_ID`, else the forum named `bug-reports` in the bot's
servers.

## Telling the reporter

Most reporters are not in the Discord server, so a message is how they hear back. It goes by
Discord direct message when their account is linked, as turn notifications do; Discord refuses
one to someone who neither shares a server with the bot nor installed it, and email is used
then, as for everyone without Discord.

Email goes from `noreply@boardtogether.games` through Resend, rendered from the
`BugReportUpdate` template in `libs/email`, which shares the tournament email's look
(`libs/email/components/darkCard.tsx`). It needs:

- a Resend key from `RESEND_API_KEY`, else `.secrets/resend-api-key`, found like the bot token;
  a send-only key is enough;
- the workspace installed and `@tabletop/email` built, for the template;
- `tools/investigate` set up, which reads the address from the user record.

The wording of each milestone lives in `src/milestones.mjs`.

## Files

Downloads and email previews go to `tmp/bug-reports/<post id>/` under the main worktree, which
is gitignored. A report's `bug-report-<gameId>.json` is a dev harness scenario of the whole
game, hidden information included.

## Discord setup

- **Message Content intent** (developer portal, Bot page): without it Discord blanks players'
  replies for the bot. `check` warns while it is off.
- **Forum permissions** (on the forum, Edit Channel, Permissions; forums call threads _posts_):
  View Channel, Read Message History, Send Messages in Posts and Manage Posts. Without Manage
  Posts the bot may retag and close only the reports it opened, and lock none.
- **Tags**: `open`, `investigating`, `reproduced`, `fixed`, `wont fix` and `not a bug` are
  status tags, one per post. Discord closes a post after a week without activity, so the status
  tag, not the closed state, says whether a report is resolved.
