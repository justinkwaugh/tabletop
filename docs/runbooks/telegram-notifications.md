# Telegram notifications

Players can get the same messages as Discord DMs (turn, game started, invited, player joined or declined, vote requested, seat changes) from a Telegram bot.

## How it works

- The Notifications page asks `GET /api/v1/notification/registrations`, which reports the Discord bot, Discord webhook and Telegram together. While the backend has no Telegram bot, `telegram.available` is false and the page shows no Telegram section. `GET /api/v1/notification/telegram/status` remains only for frontend 25.8.0 and is to be removed once a frontend reading the combined route is live.
- When the page shows Telegram as not connected, it fetches `POST /api/v1/notification/telegram/link`. That returns `https://t.me/<bot>?start=<token>`; the token is in Redis under `telegram-link-<token>` for an hour and works once.
- The user presses Start in Telegram. Telegram posts `/start <token>` to `POST /api/v1/telegram/webhook` with the chat ID. `TelegramService` redeems the token and stores the subscription `telegram:<chatId>` on the user's topic in `notificationSubscriptions`/`pushTopics`. One chat follows one account: starting with another account's link moves it. The bot replies, and a `topicRegistrationsChanged` System notification on the user's topic makes an open Notifications page reload. `/stop`, blocking the bot and Disconnect send it too.
- `TelegramTransport` sends each User Notification with `sendMessage`. A 403 (the user blocked the bot) or "chat not found" deletes the subscription.
- The bot stops on `/stop`, when the user blocks it (`my_chat_member` update with status `kicked`), or on Disconnect on the Notifications page.
- The webhook checks `X-Telegram-Bot-Api-Secret-Token` against `TELEGRAM_WEBHOOK_SECRET` and answers 401 without it. Otherwise it always answers 200, even when handling fails, because Telegram redelivers anything else.
- The bot handles private chats only; group messages are ignored.

## Credentials

| Secret                    | What                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`      | The token @BotFather gives when the bot is created                                  |
| `TELEGRAM_WEBHOOK_SECRET` | Any random string of `A-Z a-z 0-9 _ -`, up to 256 characters, given to `setWebhook` |

A service builds the bot only when `TELEGRAM_BOT_TOKEN` is set, and then also needs `TELEGRAM_WEBHOOK_SECRET`. Both services need them: `backend` serves the webhook and the Notifications page, and `tasks` sends turn reminders.

## First deployment

1. In Telegram, talk to @BotFather: `/newbot`, pick a name (shown in chats) and a username ending in `bot`. Keep the token. Optionally `/setdescription`, `/setuserpic`, and `/setcommands` with `stop - Turn off BoardTogether notifications`.
2. Make a webhook secret: `openssl rand -hex 32`.
3. Create the two secrets in Secret Manager and give the `backend` service account access to them:

    ```sh
    printf '%s' '<bot token>' | gcloud secrets create TELEGRAM_BOT_TOKEN --project tabletop-426201 --data-file=-
    printf '%s' '<webhook secret>' | gcloud secrets create TELEGRAM_WEBHOOK_SECRET --project tabletop-426201 --data-file=-
    ```

4. Release the backend.
5. Attach the secrets to both services:

    ```sh
    for service in backend tasks; do
      gcloud run services update "$service" \
        --project tabletop-426201 --region us-central1 \
        --update-secrets=TELEGRAM_BOT_TOKEN=TELEGRAM_BOT_TOKEN:latest,TELEGRAM_WEBHOOK_SECRET=TELEGRAM_WEBHOOK_SECRET:latest
    done
    ```

6. Point the bot at the webhook:

    ```sh
    curl -sS "https://api.telegram.org/bot<bot token>/setWebhook" \
      --data-urlencode 'url=https://boardtogether.games/api/v1/telegram/webhook' \
      --data-urlencode 'secret_token=<webhook secret>' \
      --data-urlencode 'allowed_updates=["message","my_chat_member"]'
    ```

    `getWebhookInfo` shows the URL, pending updates and the last delivery error.

7. Release the frontend. Its Notifications page mentions Telegram in the intro text, so release it after the bot works.

## Checking

- `curl -sS "https://api.telegram.org/bot<bot token>/getWebhookInfo"`: `last_error_message` explains failed deliveries (a 401 means the secrets differ).
- `tools/investigate logs --service backend --grep Telegram` and `--service tasks --grep Telegram` show failed sends and replies.
- The admin Stats page counts Telegram subscriptions under Health.

## Local development

Telegram can't reach the devcontainer, so the webhook needs a public tunnel to the local backend, and inline buttons reject `localhost` links. Without `TELEGRAM_BOT_TOKEN` the Notifications page hides the section.
