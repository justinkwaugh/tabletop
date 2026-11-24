# Discord webhook notifications

Players can have the same messages as Discord DMs (turn, game started, invited, player joined or declined, vote requested, seat changes) posted to a channel in their own Discord server through a channel webhook. Each player has at most one. Nothing is configured on the site: no secrets, no bot.

## How it works

- The player creates a webhook in the channel's settings (Integrations, then Webhooks) and pastes its URL on the Notifications page, which calls `POST /api/v1/notification/discord-webhook/connect`. `POST .../disconnect` removes it. The page reads the webhook's name from `GET /api/v1/notification/registrations`.
- Only `https://discord.com/api/webhooks/<id>/<token>` (also `discordapp.com`, `ptb.` and `canary.`, an optional `/v<n>` segment) is accepted. Every call then goes to `https://discord.com/api/v10/webhooks/<id>/<token>`, never to the pasted host.
- `DiscordWebhookService` looks the webhook up (it must be an Incoming webhook; channel-follower and app webhooks are refused as unsupported), posts a welcome message, and only then replaces the player's subscription `discordWebhook:<userId>` on the user's topic. A webhook that fails the check leaves the current one in place. Players who share a channel each connect the webhook and each get their own subscription.
- The connect route allows 5 calls a minute.
- `DiscordWebhookTransport` posts each User Notification as one line naming the title before the game, whose name links to the game (or the dashboard, for invitations and joins), with link previews suppressed. When the player's Discord account is linked, the message mentions them and `allowed_mentions` allows only that user.
- A 401 (token reset) or 404 (webhook or channel deleted) deletes the subscription, and an open Notifications page reloads its list. Rate limits and other errors are logged and the message is dropped.
- The API never returns the token; the page names the webhook by its Discord name.

## Checking

- `tools/investigate logs --service backend --grep "Discord webhook"` and `--service tasks --grep "Discord webhook"` show failed posts with the webhook ID and status; timeouts and network errors are logged as `Error sending a discordWebhook notification`.
- The admin Stats page counts Discord webhook subscriptions under Health.
