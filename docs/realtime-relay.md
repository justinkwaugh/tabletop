# Realtime Relay

The realtime relay is a small Go server on its own Compute Engine VM. It holds every browser's Realtime Connection and forwards Realtime Updates to it, replacing Ably and the backend's SSE routes as the Delivery Transport for Realtime Updates (see the [notification delivery glossary](contexts/notification-delivery/CONTEXT.md)). Why it exists, and the options rejected, are recorded in [ADR 0010](adr/0010-self-hosted-realtime-relay.md). The design was agreed on 2026-10-18. Nothing is built yet.

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

Spectators need no special handling. A spectator receives `game-<gameId>`, which never carries hidden information, plus their own `user-<userId>` and `global`. A Player receives the same three, and their own perspective of the game arrives on `user-<userId>`. Today any Active User Account may load any game by its ID: `getGameForUser` (`gameService.ts:498`) checks no entitlement, and a User Account that is not seated gets the spectator perspective (`gameRepresentation.ts:413`). The token endpoint grants `game-<gameId>` on exactly the rule the game endpoint applies, so the two cannot drift.

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

- The backend issues it from `GET /api/realtime/token?game=<gameId>`, which requires an Authenticated Session. It checks that the account is Active and that it would serve each requested game to that account, then signs.
- The relay accepts only HS256 with a known `kid` from the header, compares the signature in constant time, and checks `aud` and `exp`. It rejects a token listing `realtime-control`. It accepts each `jti` once, remembering used ones in memory until they expire.
- The relay rejects any token issued before its Redis subscriber last connected. A restart therefore forgets used `jti`s without letting them be replayed, and a revocation lost during a Redis reconnect cannot be bypassed with an older token (see [Revocation](#revocation)). Clients are unaffected, because they ask for a fresh token for every connection. The backend and the VM both keep time from Google's NTP servers.
- `EventSource` cannot send headers, so the token travels in the URL, as today. Caddy's access log stays off, so tokens are not written to disk.
- The signing key is 32 random bytes in Secret Manager. The backend reads it as an environment variable, and the relay reads it at start. A new key gets a new `kid`, so the relay can accept the old and new key together while the key is rotated.

## Realtime Connection lifecycle

A browser tab holds one Realtime Connection carrying all of its Topic Registrations. Changing the Topic set, such as opening a different game, closes the connection and opens a new one with a new token. Caddy serves HTTP/2, so the browser's six-connections-per-host limit does not apply.

1. The client asks the backend for a token, then opens `EventSource` on the relay.
2. The relay verifies the token and subscribes to any Topic it is not already subscribed to.
3. Once Redis has confirmed the subscription to every Topic on the connection, the relay sends a `ready` event. Sending it earlier would open a gap: a Realtime Update published between the stream opening and the subscription would be lost.
4. On `ready`, the client signals a Discontinuity for every Topic on the connection. Each consumer reconciles with its canonical source, as consumers already do when Ably attaches a channel (`apps/frontend/src/lib/network/ablyConnection.svelte.ts:85`) or an SSE stream opens (`sseConnection.svelte.ts:120`).
5. Each later event names its Topic and carries the published message as it was published: `{"topic": "game-abc", "message": {...}}`. This keeps the user and `global` Topics apart, which the current SSE routes do not ([domain reconciliation](domain-reconciliation.md)).

Step 3 has two cases to get right, because connections share subscriptions. A connection may need a Topic whose subscription another connection has already requested but Redis has not yet confirmed; it waits for that confirmation too. And a Topic may be unsubscribed, as its last connection closes, just as a new connection needs it. The relay sends every SUBSCRIBE and UNSUBSCRIBE through one ordered queue, so Redis confirms them in order and a new connection is only ready after its own SUBSCRIBE is confirmed.

A dropped connection is handled the same way as a fresh one: new token, new connection, `ready`, Discontinuity, reconcile. The relay keeps no event buffer and assigns no event IDs. A reconnect cannot leave a gap, because everything published before `ready` is in the reconciled state and everything after it arrives on the stream. Reconciling an unchanged game costs a 304, because the game endpoint answers with ETags.

A Realtime Update published while a consumer's reconcile request is in flight can appear in both the response and the stream. Consumers must ignore Realtime Updates their state already includes. Before the client switches over, each consumer that reconciles is checked for this: the Game Session (`libs/frontend-components/src/lib/model/gameNotifications.ts:71`), the game list (`apps/frontend/src/lib/services/gameService.svelte.ts:526` and `gameListUpdates.ts:52`), chat (`chatService.svelte.ts:225`), and competitions (`competitionUpdates.ts:38`).

After a connection drops, the client waits a random 0–5 seconds before reconnecting, then backs off exponentially. When the relay closes every connection at once (a restart, a reboot, or a Redis reconnect), this spreads the token requests that would otherwise reach the backend in the same moment. The current SSE client instead retries after a fixed 5 seconds, and an error on one feed closes every feed but retries only that one (`sseConnection.svelte.ts:144`); the relay client replaces it.

## Revocation

A token only authorizes opening a connection. An open connection outlives its token.

- When an account becomes Inactive or Deleted, and on Logout All, the backend publishes `{"revoke": "<userId>", "at": <time>}` to the relay's control feed, the Redis channel `realtime-control`. The relay closes that account's connections at once. It also remembers the account and time for 60 seconds, the token lifetime, and rejects that account's tokens issued before the revocation. Without that, a token issued just before the revocation could open a connection just after it, and nothing would ever close it. A single Logout closes its own tab's connection in the client.
- The control feed is internal to the relay. It is never a Topic, never granted in a token, and never forwarded to a client.
- Redis pubsub does not hold messages for a disconnected subscriber, so a control message, like any Realtime Update, can be lost while the relay's subscriber is reconnecting. The relay therefore closes every connection whenever its Redis subscriber reconnects, and rejects tokens issued before the reconnect. Every client then gets a fresh token, which reapplies the backend's checks, and reconciles, which recovers the missed Realtime Updates.
- Connections have no maximum lifetime. The control feed and the reconnect rule cover revocation. Losing `game-<gameId>` matters little in any case, because any Active User Account may see the spectator perspective.

## Connection limits

- **Per account: 50.** A connection that would take an account over 50 closes that account's oldest connection, rather than being refused. The oldest is usually a forgotten tab or a sleeping device, and refusing the new one would leave a Player opening their game without Realtime Updates.
- **Per relay: sized to memory.** Above a machine-wide limit the relay answers 503, so existing connections keep working instead of the process reaching its memory cap and dropping everyone. The number comes from a load test on the e2-micro. The client retries a 503 with backoff.
- **No per-IP limit.** Households, schools, mobile carriers and club tournaments put many Players behind one address. Every connection needs an Active account, so the per-account limit already covers the abuse a per-IP limit would.
- **No token endpoint rate limit** for now. Reconnect jitter, backoff and the per-account limit cover the realistic cases.

## The relay

A single static Go binary using the standard library and `go-redis`.

- **Redis.** One subscriber connection for all Topics and the control feed, counting how many connections want each Topic and unsubscribing when the last one closes. A thousand spectators of one game cost one Redis subscription. It uses the same Redis Cloud database as the backend, with the `REDIS_USERNAME` and `REDIS_PASSWORD` secrets.
- **HTTP.** Plain HTTP on `127.0.0.1:8090`: the stream endpoint and a bare `/health`, both proxied by Caddy, plus a local-only stats endpoint on a second port reporting connections, subscribed Topics and memory. The stream answers CORS for `https://boardtogether.games` only. No cookies are involved.
- **Limits.** Enforces the per-account and machine-wide connection limits.
- **Not its job.** Deciding who may receive what, interpreting messages, storing anything, and retrying delivery.

The token format, Topic names, event framing and control messages are a contract between TypeScript and Go. It stays small, lives in this document, and has a CI test in which a token signed by the backend's code is verified by the relay.

## Hosting

- **Machine.** One e2-micro in us-central1 (free tier), Debian 13, Shielded VM (secure boot, vTPM, integrity monitoring). A 10 GB standard persistent disk; the default balanced disk is not in the free tier. A small swap file, so a memory spike slows the machine rather than ending a process.
- **TLS.** Caddy terminates HTTPS for `events.boardtogether.games` and proxies to the relay with `flush_interval -1`. It obtains and renews a Let's Encrypt certificate itself, falling back to ZeroSSL, and stores it on the persistent disk so restarts reuse it. Firebase Hosting keeps its own certificates for `boardtogether.games` and `www`.
- **DNS.** One A record, `events`, pointing at the VM's static IP, added at GoDaddy. The domain has no CAA records. If any are added later, they must list both `letsencrypt.org` and `pki.goog`, Firebase Hosting's issuer.
- **Network.** The firewall opens ports 80 and 443 only. SSH is reached through Identity-Aware Proxy with OS Login, and the deploy tool copies the binary over the same tunnel.
- **Identity.** A dedicated service account that can read the relay's secrets and write logs and metrics, not the default Compute Engine account.
- **Processes.** systemd runs the relay with a dynamic user, no capabilities, `NoNewPrivileges`, `ProtectSystem=strict`, IPv4 and IPv6 sockets only, and a memory cap. Caddy is the only process reachable from the internet.
- **Updates.** `unattended-upgrades` installs security updates daily and reboots for kernel updates at a fixed quiet hour. A reboot is a reconnect for every client.
- **Observability.** Logs go to the journal. The Ops Agent is left out at first, because it takes a large share of 1 GB. Detailed numbers stay on the relay's local stats endpoint, read through the IAP tunnel.
- **Alerts.** A Cloud Monitoring uptime check requests `https://events.boardtogether.games/health` every 5 minutes from three regions. The public `/health` answers only 200 or 503, and answers 200 only when the relay is up and its Redis subscriber is connected. One alert fires after about 10 minutes of failures, so a scheduled reboot stays quiet. A second fires when the certificate has under 14 days left, which means Caddy's renewal at 30 days has been failing for two weeks. Both are emailed to the site owner.
- **Deploy.** A `realtime` target in `tools/deploy` builds the binary, copies it over IAP, and restarts the service.

## Backend changes

- **Publishing to Redis.** With `ABLY_API_KEY` set, as in production, the backend uses `NullPubSubService` and publishes nothing to Redis (`apps/backend/src/app/plugins/services.ts`). During the cutover it must publish to both Ably and Redis, so either transport can serve the client.
- **Token endpoint.** `/api/realtime/token` issues Topic Registration tokens as described above, replacing `/api/sse/token`.
- **Control messages.** Published to `realtime-control` when an account becomes Inactive or Deleted, and on Logout All.
- **Retirement.** The SSE routes in `apps/backend/src/app/routes/api/sse/`, the Ably transport and token route, and `ARCHITECTURE.md`'s description of them are removed once the relay has proven itself.

## Client changes

- A new `RealtimeConnection` implementation for the relay, chosen in `apps/frontend/src/lib/stores/appContext.svelte.ts` in place of `PUBLIC_ENABLE_ABLY_REALTIME`. It reconnects with a fresh token after an error, with the jitter and backoff described above, and on any change to its Topic set.
- `PUBLIC_SSE_HOST` is set to `https://events.boardtogether.games` in the production build.
- Consumers ignore duplicate Realtime Updates, as described above.

## Rollout

1. Build the relay, token endpoint, control messages and client locally, and verify them through the local hosted site against the devcontainer's Redis. Load-test the relay to set the machine-wide limit.
2. Create the VM, static IP, firewall rules, service account, secrets and uptime checks. The `events` DNS record is added. Release the backend with dual publishing.
3. Release a frontend that uses the relay, keeping the Ably path behind the flag as the fallback.
4. Once the relay has proven itself, remove Ably and the SSE routes.

## Later, if needed

- Alerts in Discord. Cloud Monitoring's webhook format does not match Discord's, so this needs a backend endpoint that reformats the alert for the existing bot.
- An alert on connections nearing the machine-wide limit, from a custom metric the relay sends to Cloud Monitoring.
