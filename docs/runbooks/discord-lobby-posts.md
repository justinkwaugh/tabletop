# Discord Lobby Posts

Each open game in a Series lobby (the 18xx lobby, for now) gets one message in each Discord text channel that lists it, posted by the site's bot. A lobby may have several channels, on one server or several, and a channel may list only games of some paces; the 18xx lobby posts every game to the Board Together channel, and on the Online 18XX friends server Live games to `#live-game-lobby` and every other pace to `#async-game-lobby`. The message shows the title, the game name, open seats, pace, the options the game sets away from the standard (the same ones the site's game cards show; no Options line for a standard game) and joined players, with a **Join game** button. It is edited as seats change and deleted once the game leaves the lobby: all seats taken, started, deleted, or made Unlisted or Invite-Only. Only titles every player can discover are posted; Alpha and Beta titles stay off Discord, as they stay off a regular player's lobby. If a channel has a role, a game's first post in that channel mentions it; edits, a game that reopens, and the launch batch never mention it.

## How it works

- `FirestoreGameStore` tells its `GameChangeListener`, `LobbyPostQueue` (`libs/backend-services/src/discord/lobbyPosts.ts`), of every game write. When some channel lists the game before or after the write (`PostedLobbies.channelsFor`), it queues `/tasks/discord/syncLobbyPost` on the `maintenance` queue. A failure to queue is logged (`Could not queue a lobby post sync`) and never fails the write.
- `LobbyPosts.sync` posts, edits or deletes from the game as it is now, in each channel, then reads the game again and goes round once more if it changed meanwhile, so syncs may run in any order or more than once. A game whose pace changes moves from one channel to the other.
- `discordLobbyPosts/<gameId>` in Firestore holds, per channel id, the game's live message there, if any, and how many times the game has been posted there; only the first post in a channel mentions its role. The record stays after the messages are deleted. Records written while each lobby had one channel (`posts` and `message` at the top) are read as that message's channel, and rewritten in the per-channel shape on their next change.
- Each post is sent with a nonce made from the game id, the channel id and that count, which Discord enforces for a few minutes. A retried or racing send gets the same message back rather than posting, and pinging, twice. Whichever sync records the message first keeps it; one holding a different message deletes its own.
- Each channel is synced on its own, so one channel refusing (say, the bot was removed from that server) still updates the others. Any refusal fails the task, so the queue retries it (5 attempts on `maintenance`). A tasks service without the configuration answers 503, so a missing variable shows as retries rather than silence.
- A message someone deletes by hand stays gone while the game is open; the sync stops editing it.

## Setup

1. In Discord, make a text channel per lobby (or per pace). On another server, the server's owner or someone with **Manage Server** adds the bot first, which needs **Public Bot** on in the Developer Portal while they do. Give the bot **View Channel**, **Send Messages** and **Embed Links** there. It deletes only its own messages, so it needs no **Manage Messages**.
2. For the ping, make an opt-in role (e.g. `@18xx-lfg`). Either tick **Allow anyone to @mention this role** on the role, or give the bot **Mention @everyone, @here, and All Roles**; otherwise the mention shows but pings nobody.
3. Set `DISCORD_LOBBY_CHANNELS` for both the `backend` service (which queues) and the `tasks` service (which posts). Both need `DISCORD_BOT_TOKEN` too, which they already have. The simplest place is `apps/backend/.env.prod`, which ships in the image of both:

    ```sh
    DISCORD_LOBBY_CHANNELS='{"18xx":{"channelId":"<channel id>","roleId":"<role id>"}}'
    ```

    The key is the Series id. Leave `roleId` out for no ping. A new lobby is a new key. For several channels, give a list; `paces` limits a channel to games of those paces (`live`, `fast`, `brisk`, `daily`, `relaxed`), and a channel without it lists every pace. A new pace added to the site is not in any existing `paces` list. The 18xx lobby's setting:

    ```sh
    DISCORD_LOBBY_CHANNELS='{"18xx":[{"channelId":"1575250334765555732","roleId":"1575251603563483286"},{"channelId":"799720129571192872","roleId":"799740413094264884","paces":["live"]},{"channelId":"930789914428178472","roleId":"748252176559636574","paces":["fast","brisk","daily","relaxed"]}]}'
    ```

    Never set it in `.env.local`: the local backend uses the production bot.

4. Release the backend. From then on a game is posted when it opens.
5. Post the games already open: on the site, signed in as an Administrator, run this in the browser console:

    ```js
    await (await fetch('/api/v1/admin/discord/lobbyPosts', { method: 'POST' })).json()
    ```

    It queues a quiet sync, without the role mention, for every open game in each posted lobby (a game already posted in some channels is posted quietly in the new ones) and returns their ids; the `maintenance` queue posts them about one a second. Running it again is harmless: games already posted are only edited. It answers 503 when lobby posts are off.

## Turning it off

Remove `DISCORD_LOBBY_CHANNELS` and release. Posts already up stay until deleted by hand; with the variable unset nothing removes them.
