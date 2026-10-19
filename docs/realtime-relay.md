# Realtime Relay

The realtime relay is a small Go server on its own Compute Engine VM. It holds every browser's Realtime Connection and forwards Realtime Updates to it, replacing Ably and the backend's SSE routes as the Delivery Transport for Realtime Updates (see the [notification delivery glossary](contexts/notification-delivery/CONTEXT.md)). Why it exists, and the options rejected, are recorded in [ADR 0010](adr/0010-self-hosted-realtime-relay.md). The design was agreed on 2026-10-18. The relay (`apps/realtime`), the token endpoint and the client were built and verified on the local hosted site the same day; nothing is deployed.

## Shape

```
Browser                       Backend (Cloud Run)              Relay (e2-micro)        Redis Cloud
   │ GET /api/realtime/token     │                                  │                      │
   │ (Authenticated Session) ───►│ Active? may load the game?       │                      │
   │                             │ sign {sub, topics, iat, exp, jti}│                      │
   │◄──────── token ─────────────│                                  │                      │
   │ EventSource events.boardtogether.games/stream?t=token ────────►│ verify token         │
   │                             │                                  │ SUBSCRIBE topics ───►│
   │◄════ ready, then Realtime Updates ═════════════════════════════│◄── PUBLISH (backend) │
```

All authorization stays in the backend. The backend signs a short statement of the Topics a User Account may receive now, and the relay checks only that the backend signed it. The relay has no database, no session, and no knowledge of games or Notification Envelopes. It forwards each published message unchanged.

## Topics and Audiences

The backend publishes each Realtime Update to the Topic of its Audience. In production it currently publishes them to Ably only; see [Backend changes](#backend-changes).

| Topic | Carries | Granted to |
|---|---|---|
| `user-<userId>` | That account's Player perspective of each of their games (`libs/backend-services/src/games/gameNotifications.ts:203`); game list updates for their unlisted and private games (`gameService.ts`, `notifyGamePlayers`); their own notices (`notifyUser`); and, for Administrators, Tournament updates before publication (`tournamentService.ts:724`) | That User Account only |
| `game-<gameId>` | The spectator perspective of each Action and Undo, with hidden information removed (`gameNotifications.ts:210`), and the game's Conversation Messages (`chatService.ts:58`) | Every Active User Account that may load the game |
| `global` | Game list updates for listed public games (`gameService.ts`, `notifyGameAudience`), and updates to published Leagues and Tournaments (`leagueService.ts:990`, `tournamentService.ts:723`) | Every Active User Account |
| `relay-stats` | The relay's own count of open connections and distinct accounts, as a `system` Notification with action `relayStats` (`libs/common/src/site/notifications/systemNotification.ts`). Nothing is published to Redis for it: the relay sends the current count when a connection becomes ready on the Topic, and every 5 seconds sends the count to all of them if it has changed or a connection has joined since, so every Stats page is back in step within 5 seconds. When the stream is interrupted the client clears the count and shows that it is reconnecting. With more than one relay, each would report only its own connections. | Administrators who ask for it (`?relayStats=true`). For anyone else the token simply leaves it out, so an account that loses the role while its Stats tab is open keeps its other Topics |

Spectators need no special handling. A spectator receives `game-<gameId>`, which never carries hidden information, plus their own `user-<userId>` and `global`. A Player receives the same three, and their own perspective of the game arrives on `user-<userId>`. Today any Active User Account may load any game by its ID: `getGameForUser` (`gameService.ts:498`) checks no entitlement, and a User Account that is not seated gets the spectator perspective (`gameRepresentation.ts:413`). The token endpoint therefore grants `game-<gameId>` for any requested ID without looking the game up: an ID with no game carries no messages, and refusing it would leave a tab on a deleted game without any Realtime Updates. If the game endpoint ever checks entitlement, the token endpoint must check it too.

Signed-out visitors receive no Topics. The game page requires an Authenticated Session, and this design keeps that.

## Topic Registration tokens

A token is an HS256 JWT. The header names the signing key:

```json
{ "alg": "HS256", "typ": "JWT", "kid": "<key id>" }
```

The payload:

```json
{ "sub": "<userId>", "topics": ["user-<userId>", "global", "game-<gameId>"],
  "aud": "realtime", "iat": <now>, "exp": <now + 60 s>, "jti": "<random>" }
```

- The backend issues it from `GET /api/realtime/token?game=<gameId>` (`apps/backend/src/app/routes/api/realtime/token.ts`), which requires an Authenticated Session. `game` may repeat, up to four times. It checks that the account is Active, then signs (`libs/backend-services/src/realtime/realtimeTokenIssuer.ts`).
- The relay accepts only HS256 with a known `kid` from the header, compares the signature in constant time, and checks `aud`, `iat` and `exp`, allowing 5 seconds of clock difference. It rejects a token listing `realtime-control`, or living longer than 60 seconds. It accepts each `jti` once, remembering used ones in memory until the verifier would refuse them anyway (`exp` plus the 5 seconds).
- The relay rejects any token issued before its Redis subscriber last connected, or in the same second, since `iat` has only second precision. A restart therefore forgets used `jti`s without letting them be replayed, and a revocation lost during a Redis reconnect cannot be bypassed with an older token (see [Revocation](#revocation)). Clients are unaffected, because they ask for a fresh token for every connection and topic change. The backend and the VM both keep time from Google's NTP servers.
- `EventSource` cannot send headers, so the token travels in the URL, as today. Caddy's access log stays off, so tokens are not written to disk.
- The signing key is 32 random bytes in Secret Manager. The backend reads it as an environment variable, and the relay reads it at start. A new key gets a new `kid`, so the relay can accept the old and new key together while the key is rotated.

## Realtime Connection lifecycle

A browser tab holds one Realtime Connection, one stream, for its whole life, carrying all of its Topic Registrations (`apps/frontend/src/lib/network/relayConnection.ts`). Caddy serves HTTP/2, so the stream and the topic changes below share one connection. The stream stays open while the tab is hidden, so a background game tab's title and favicon still show whose turn it is; Ably and the old SSE routes close hidden tabs instead (`closedWhileHidden`). The relay sends `event: keepalive` every 25 seconds, and the client treats a stream it has heard nothing on for 60 seconds as dead: it reconnects and resyncs. A laptop waking from sleep or a mobile browser thawing a frozen tab can leave a dead stream that has not yet failed, so a tab that becomes visible reopens its stream at once if it has heard nothing for 35 seconds or is waiting to retry, without the jitter.

1. The client asks the backend for a token, then opens `EventSource` on the relay.
2. The relay verifies the token and subscribes to any Topic it is not already subscribed to.
3. Once Redis has confirmed the subscription to every Topic on the connection, the relay sends `event: ready` with `{"connection": "<id>", "topics": [...]}`, where the connection ID is 128 random bits. Sending it earlier would open a gap: a Realtime Update published between the stream opening and the subscription would be lost.
4. On `ready`, the client signals a Discontinuity for each kind of Topic it has not yet synced: every kind on a first `ready`. Each consumer reconciles with its canonical source, as consumers already do when Ably attaches a channel (`apps/frontend/src/lib/network/ablyConnection.svelte.ts:85`) or an SSE stream opens (`sseConnection.svelte.ts:120`).
5. Each later event names its Topic and carries the published message as it was published: `{"topic": "game-abc", "message": {...}}`. This keeps the user and `global` Topics apart, which the current SSE routes do not ([domain reconciliation](domain-reconciliation.md)).

Opening or leaving a game changes the Topics of the same stream, so updates on the Topics it keeps arrive in order and are never interrupted:

1. The client asks the backend for a token for its full new Topic set and sends `POST /stream/<connection id>/topics?t=<token>`. With no body and no custom headers this is a simple cross-origin request, with no preflight.
2. The relay checks the token like any other, and also that it was issued to the stream's own account, so a leaked connection ID is useless without that account's token. It answers 202, stops removed Topics at once, and subscribes added ones.
3. Once Redis confirms the added Topics, the relay sends `ready` again on the same stream with the full Topic list and no connection ID. An added Topic's updates start after that `ready`.
4. The client signals a Discontinuity only for channel kinds newly synced: the game kind when a game is opened, nothing when one is closed. A late update for a removed Topic is ignored, because the client no longer has the channel.

The client sends one topic change at a time and, after each `ready`, sends another if its channels changed meanwhile. A refused change (401, or 404 for a stream the relay no longer has) or a failed token request is handled as a failed stream: close, reconnect, and resync everything.

Step 3 of opening has two cases to get right, because connections share subscriptions. A connection may need a Topic whose subscription another connection has already requested but Redis has not yet confirmed; it waits for that confirmation too. And a Topic may be unsubscribed, as its last connection closes, just as a new connection needs it. The relay sends every SUBSCRIBE and UNSUBSCRIBE through one ordered queue, so Redis confirms them in order and a new connection is only ready after its own SUBSCRIBE is confirmed.

A dropped connection is handled the same way as a fresh one: new token, new connection, `ready`, Discontinuity, reconcile. The relay keeps no event buffer and assigns no event IDs. A reconnect cannot leave a gap, because everything published before `ready` is in the reconciled state and everything after it arrives on the stream. Reconciling an unchanged game costs a 304, because the game endpoint answers with ETags.

A Realtime Update published while a consumer's reconcile request is in flight can appear in both the response and the stream. Consumers must ignore Realtime Updates their state already includes. An audit on 2026-10-18 found every reconciling consumer safe against duplicates: the Game Session (`libs/frontend-components/src/lib/model/gameNotifications.ts:71`), the game list (`apps/frontend/src/lib/services/gameService.svelte.ts:526` and `gameListUpdates.ts:52`), chat (`chatService.svelte.ts:225`), and competitions (`competitionUpdates.ts:38`). Chat now also reloads on a game-kind Discontinuity, since its messages arrive on `game-<gameId>`.

The same audit found one consumer unsafe against the reverse case, a reconcile response read before an update the stream already delivered: the game list replaced itself with the response, so the older response could undo a newer game update. This existed with Ably too. The game list now records the game create, update and delete notices that arrive while a load is running, collapses them to the newest per game (a delete always wins), and applies each over the response when it is newer by `updatedAt`, then stores the replayed list; a load requested meanwhile, such as by a turn notice, fetches once more (`gameService.svelte.ts`, `loadCurrentGames`). Actions and chat messages do not affect it, so a busy player's list still loads.

After a connection drops, the client waits a random 0–5 seconds before reconnecting, then backs off exponentially. When the relay closes every connection at once (a restart, a reboot, or a Redis reconnect), this spreads the token requests that would otherwise reach the backend in the same moment. The current SSE client instead retries after a fixed 5 seconds, and an error on one feed closes every feed but retries only that one (`sseConnection.svelte.ts:144`); the relay client replaces it.

## Revocation

A token only authorizes opening a connection. An open connection outlives its token.

- When an account's registrations must end, `{"revoke": "<userId>", "at": <unix seconds>}` is published to the relay's control feed (without `at`, the relay uses the time it receives the message), the Redis channel `realtime-control`. No code path today makes an account Inactive or Deleted, and there is no Logout All, so the backend publishes nothing yet; it gains a publisher when those features exist. Until then, after changing an account's status by hand, an operator publishes the message with `redis-cli`. The relay closes that account's connections at once. It also remembers the account and time for 66 seconds, the token lifetime plus the clock allowance and a second for `iat` rounding, and rejects that account's tokens issued before the revocation. Without that, a token issued just before the revocation could open a connection just after it, and nothing would ever close it. A single Logout closes its own tab's connection in the client.
- The control feed is internal to the relay. It is never a Topic, never granted in a token, and never forwarded to a client.
- Redis pubsub does not hold messages for a disconnected subscriber, so a control message, like any Realtime Update, can be lost while the relay's subscriber is reconnecting. The relay therefore closes every connection whenever its Redis subscriber reconnects, and rejects tokens issued before the reconnect. Every client then gets a fresh token, which reapplies the backend's checks, and reconciles, which recovers the missed Realtime Updates.
- Connections have no maximum lifetime. The control feed and the reconnect rule cover revocation. Losing `game-<gameId>` matters little in any case, because any Active User Account may see the spectator perspective.

## Connection limits

- **Per account: 50.** A connection that would take an account over 50 closes that account's oldest connection, rather than being refused. The oldest is usually a forgotten tab or a sleeping device, and refusing the new one would leave a Player opening their game without Realtime Updates.
- **Per relay: sized to memory.** Above a machine-wide limit the relay answers 503, so existing connections keep working instead of the process reaching its memory cap and dropping everyone. The client retries a 503 with backoff. A local load test (`apps/realtime/cmd/loadtest`) measured about 34 KB of relay memory per connection: 10,000 connections in 358 MB, and 200,000 messages delivered in 108 ms. Run on the VM through Caddy (`apps/realtime/deploy/loadtest-vm.sh`), each stream costs about 190 KB in all: about 160 KB in Caddy, which holds a TLS connection, a 32 KB copy buffer and a second connection to the relay for every stream, and about 32 KB in the relay. Caddy's share is live memory, not garbage, so tuning its garbage collector does not reduce it. The VM has about 585 MB free, so the limit is 2,500 (`REALTIME_MAX_CONNECTIONS` in `/etc/realtime/relay.env`), leaving about 100 MB spare. That is more than 12 times the 200 connections Ably's free tier allows. When peaks approach 1,500, the choices are a 2 GB e2-small (about 7,500 streams, roughly $12 a month) or the relay terminating TLS itself (an estimated 6,000, not measured).
- **Hidden tabs count.** Every open tab holds a connection, visible or not, including tabs left open for days, so the machine-wide and per-account limits count them. A connection closed by the per-account limit first receives `event: evicted`; a hidden tab then waits until it is shown before reconnecting, so an account with more than 50 tabs does not keep evicting its own tabs in turn.
- **No per-IP limit.** Households, schools, mobile carriers and club tournaments put many Players behind one address. Every connection needs an Active account, so the per-account limit already covers the abuse a per-IP limit would.
- **No token endpoint rate limit** for now. Reconnect jitter, backoff and the per-account limit cover the realistic cases.

## The relay

A single static Go binary using the standard library and `go-redis`.

- **Redis.** One subscriber connection for all Topics and the control feed, counting how many connections want each Topic and unsubscribing when the last one closes. A thousand spectators of one game cost one Redis subscription. The hub only queues SUBSCRIBE and UNSUBSCRIBE; one worker sends them in order, so a slow or reconnecting Redis never stalls the hub. Each gets 2 seconds, and one that fails, or a full queue, closes the subscriber, which counts as a Redis reconnect. Commands queued before a reconnect are dropped, since the reconnect resets every subscription. It uses the same Redis Cloud database as the backend, with the `REDIS_USERNAME` and `REDIS_PASSWORD` secrets.
- **HTTP.** Plain HTTP on `127.0.0.1:8090`: the stream endpoint and a bare `/health`, both proxied by Caddy, plus a local-only stats endpoint on `127.0.0.1:8091` reporting connections, subscribed Topics and memory. The stream answers CORS for the origins in `REALTIME_ALLOWED_ORIGINS`, `https://boardtogether.games` in production. No cookies are involved. An idle stream gets a keepalive comment every 25 seconds, so proxies and mobile networks keep it open and a dead client is noticed; a stream that falls 64 events behind is closed, and its client reconnects and reconciles.
- **Limits.** Enforces the per-account and machine-wide connection limits.
- **Not its job.** Deciding who may receive what, interpreting messages, storing anything, and retrying delivery.

The token format, Topic names, event framing and control messages are a contract between TypeScript and Go. It stays small and lives in this document. `apps/realtime/testdata/token-contract.json` holds one signed token: the backend's issuer test must sign exactly that token, and the relay's contract test must accept it. The repository has no CI, so both run with the packages' own tests (`pnpm --filter @tabletop/realtime test` needs Go, which the devcontainer installs).

## Hosting

- **Machine.** One e2-micro in us-central1 (free tier), Debian 13, Shielded VM (secure boot, vTPM, integrity monitoring). A 10 GB standard persistent disk; the default balanced disk is not in the free tier. A 512 MB swap file, so idle pages leave RAM and a memory spike slows the machine rather than ending a process.
- **TLS.** Caddy terminates HTTPS for `events.boardtogether.games` and proxies to the relay with `flush_interval -1`. It obtains and renews a Let's Encrypt certificate itself, falling back to ZeroSSL, and stores it on the persistent disk so restarts reuse it. Firebase Hosting keeps its own certificates for `boardtogether.games` and `www`.
- **DNS.** One A record, `events`, pointing at the VM's static IP, added at GoDaddy. The domain has no CAA records. If any are added later, they must list both `letsencrypt.org` and `pki.goog`, Firebase Hosting's issuer.
- **Network.** The VM has a network of its own (`realtime`), so the `default` network's open SSH and RDP rules do not apply. Its firewall opens ports 80 and 443, and port 22 only to Identity-Aware Proxy's range. SSH uses OS Login, and the deploy tool copies the binary over the same tunnel.
- **Identity.** A dedicated service account (`realtime-relay`) that can read `REALTIME_SIGNING_KEY`, `REDIS_USERNAME` and `REDIS_PASSWORD` and nothing else. It gets log and metric writing only when an agent needs it.
- **Processes.** systemd runs the relay with a dynamic user, no capabilities, `NoNewPrivileges`, `ProtectSystem=strict`, IPv4 and IPv6 sockets only, and a 400 MB memory cap. Before each start, a root step reads the three secrets from Secret Manager with the VM's metadata token into `/run`, which is memory only, and removes them when the relay stops. Redis host and port are not secret and sit in `/etc/realtime/relay.env`. Caddy is the only process reachable from the internet. The files are in `apps/realtime/deploy`, and `setup-vm.sh` installs them.
- **Updates.** `unattended-upgrades` installs security updates daily and Caddy's own repository, and reboots for kernel updates at 10:00 UTC. A reboot is a reconnect for every client.
- **Observability.** Logs go to the journal. The Ops Agent is left out at first, because it takes a large share of 1 GB. Detailed numbers stay on the relay's local stats endpoint, read through the IAP tunnel.
- **Alerts.** A Cloud Monitoring uptime check requests `https://events.boardtogether.games/health` every 5 minutes from three regions. The public `/health` answers only 200 or 503, and answers 200 only when the relay is up and its Redis subscriber is connected. One alert fires after about 10 minutes of failures, so a scheduled reboot stays quiet. A second fires when the certificate has under 14 days left, which means Caddy's renewal at 30 days has been failing for two weeks. Both are emailed to the site owner.
- **Deploy.** `release-realtime` and `deploy-realtime` in `tools/deploy` build the binary with its version stamped in, copy it and `apps/realtime/deploy` over IAP, keep the running binary as the previous one, rerun `setup-vm.sh`, restart, and check that the relay reports the new version with Redis connected and that the public `/health` answers 200. A relay that does not come up is replaced by the previous binary; `rollback-realtime` swaps it back by hand (`tools/deploy/README.md`).

## Backend changes

- **Publishing to Redis.** With `ABLY_API_KEY` set, as in production, the backend used to publish nothing to Redis. Setting `REALTIME_SIGNING_KEY` (`kid:base64url`) now adds a Redis publisher beside Ably (`apps/backend/src/app/plugins/services.ts`), so either transport can serve the client during the cutover. Topic names come from `libs/backend-services/src/notifications/topics.ts`.
- **Token endpoint.** `/api/realtime/token` issues Topic Registration tokens as described above, replacing `/api/sse/token`. It answers 404 when `REALTIME_SIGNING_KEY` is unset.
- **Control messages.** Not published yet; see [Revocation](#revocation).
- **Redis connection.** The relay connects to Redis Cloud the way the backend does, over plain TCP with a username and password. Enabling TLS on the database would protect both.
- **Retirement.** The SSE routes in `apps/backend/src/app/routes/api/sse/`, the Ably transport and token route, and `ARCHITECTURE.md`'s description of them are removed once the relay has proven itself.

## Client changes

- `RelayConnection` is chosen in `apps/frontend/src/lib/stores/appContext.svelte.ts` when `PUBLIC_REALTIME_RELAY_HOST` is set, ahead of `PUBLIC_ENABLE_ABLY_REALTIME`. It reconnects with a fresh token after an error, with the jitter and backoff described above, and replaces its stream on any change to its Topic set.
- `PUBLIC_REALTIME_RELAY_HOST` is set to `https://events.boardtogether.games` in the production build. Every frontend build must define it, even as empty, because it is read from `$env/static/public`.
- Consumers ignore duplicate Realtime Updates, as described above.

## Rollout

1. Build the relay, token endpoint and client locally, and verify them through the local hosted site against the devcontainer's Redis. Done on 2026-10-18: a dashboard received another account's invite 14 ms after it was created, and opening and leaving a game changed the stream's Topics without a second stream or a game-list reload. Reviewed the same day by GPT-6-Astra and Claude Fable 5.1; their findings (handover loss with replacement streams, token and revocation memory shorter than token acceptance, the reconnect-second cutoff, unknown games refused, the game list refetching under load, Redis calls without a timeout) are fixed.
2. Create the VM, static IP, firewall rules, service account, secrets and uptime checks, add the `realtime` deploy target, and run the load test on the VM through Caddy. The `events` DNS record is added. Release the backend with dual publishing.
3. Release a frontend that uses the relay, keeping the Ably path behind the flag as the fallback.
4. Once the relay has proven itself, remove Ably and the SSE routes.

## Later, if needed

- Alerts in Discord. Cloud Monitoring's webhook format does not match Discord's, so this needs a backend endpoint that reformats the alert for the existing bot.
- An alert on connections nearing the machine-wide limit, from a custom metric the relay sends to Cloud Monitoring.
