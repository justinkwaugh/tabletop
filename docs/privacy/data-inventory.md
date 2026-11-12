# Personal data inventory

What personal data the site collects, where it goes, who can see it, and how long it is kept. This is the source for the privacy policy, the record of processing, and any legitimate-interests assessment. Taken from the code on 2026-11-11. Items marked **Check** can only be confirmed in the Google Cloud console or a provider account.

## Account data

Firestore `users/{id}`, schema in `libs/common/src/site/user.ts` and `libs/backend-services/src/persistence/model/storedUser.ts`.

| Data                                               | Source                                                                                                                                                      | Used for                                                                                                | Seen by                                                          |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Username                                           | Entered by the user; may not contain the word "deleted"                                                                                                     | Display name in games, leagues, tournaments, emails, and the Discord bug-report forum                   | Everyone signed in; also the unauthenticated public game preview |
| Email address                                      | Entered, or taken from Google/Discord at first OAuth sign-in                                                                                                | Sign-in, verification, password reset, account notices, invitations, game, league and tournament emails | The user and admins (search by exact address)                    |
| Email verified flag                                | Code verification or the provider's flag                                                                                                                    | Account completion; linking OAuth by email                                                              | The user, admins                                                 |
| Password hash                                      | Derived from the password; bcrypt, cost 10                                                                                                                  | Password sign-in                                                                                        | Nobody                                                           |
| Linked identities (`google:<sub>`, `discord:<id>`) | Google ID token, Discord OAuth (`identify email`)                                                                                                           | Sign-in; Discord DMs and bug-report mentions                                                            | The user, admins                                                 |
| Time zone (IANA name)                              | **Detected from the browser automatically** at sign-in; the user can change it                                                                              | Moving turn reminders into the user's reminder hours                                                    | The user, admins                                                 |
| Age confirmation time                              | Given by the user, ticking "I'm 13 or older and agree to the Terms of Service" at sign-up or onboarding                                                     | Evidence of the age statement and of agreeing to the terms; required to finish a new account            | The user, admins                                                 |
| Preferences                                        | Entered: colours, colour-blind palette, BG Stats export, notification prompt, reminder hours per weekday; per-title preferences in `users/{id}/preferences` | Interface and reminders                                                                                 | The user, admins                                                 |
| Roles, status, session generation                  | Server                                                                                                                                                      | Access control, bans, signing out everywhere                                                            | Admins                                                           |
| Created, updated, activated timestamps             | Server                                                                                                                                                      | Auditing, site statistics                                                                               | Admins                                                           |
| `sms`                                              | **Never collected.** Schema field only                                                                                                                      | —                                                                                                       | —                                                                |

Uniqueness index collections `userUsernames`, `userEmails` and `userExternalIds` have the username, email address or linked identity as the document ID. A copy of the account record (without the password hash) is cached in Redis under `user-<id>`, with no expiry.

Apple sign-in is not live: `AppleSignIn.svelte` is not imported anywhere and there is no backend route.

## Activity data

| Data                                                                                                                      | Where                                                                | Seen by                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Games: owner, players (user ID + username), timestamps, active players, results, final scores, votes, calls               | Firestore `games/{id}`                                               | Players. Listed public games: every signed-in user (site-wide broadcast of the record without state, title activity lists). Public and unlisted games: anyone, without signing in, through `/api/game/public/:id` (name, owner ID, player names and IDs) |
| Game actions with player ID and time; game states                                                                         | `games/{id}/actionChunks`, `states` (zstd-compressed, not encrypted) | Players and spectators, filtered per viewer for hidden-information titles                                                                                                                                                                                |
| Game chat: user ID, player ID, time, text (up to 500 characters; at most 2,000 messages per game)                         | `games/{id}/chats`, read positions in `bookmarks`                    | Any signed-in user with the game's ID. By design, anyone with a game's link can watch it and read its chat. The ID is a 21-character random nanoid (about 126 bits)                                                                                      |
| Per-user stats: win rates, streaks, head-to-head records by opponent name                                                 | Computed on request                                                  | The user only                                                                                                                                                                                                                                            |
| Leagues: organiser, entrants, levels, groups, placements, scores, substitutes                                             | `leagues/{id}`, `seasons`                                            | Every signed-in user (drafts: admins)                                                                                                                                                                                                                    |
| Tournaments: entrants, substitutes, withdrawals, standings, result corrections with the admin's ID and a free-text reason | `tournaments/{id}`, `schedules`                                      | Every signed-in user once published                                                                                                                                                                                                                      |
| Site statistics: daily active users as 32-bit hashes of user IDs (HyperLogLog above 512 a day)                            | `siteStatsMonths`                                                    | Admins. Pseudonymous, not anonymous                                                                                                                                                                                                                      |
| Games played on one device ("local" storage)                                                                              | Browser IndexedDB only                                               | The device; not cleared on sign-out                                                                                                                                                                                                                      |

## Contact and notifications

| Channel        | Provider                                                                                                                 | Content                                                                                                                                                                                                        | Stop                                                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email          | Resend, from `noreply@boardtogether.games`. Addresses also pass through Cloud Tasks payloads                             | Account mail; invitations; game ended (winners' names); player removed (their name); league sign-up, reminders, season start and results (opponents' names, standings); tournament results; bug-report replies | Notifications page switch "Email me about games and competitions" stops everything except account and security emails and bug-report replies; checked when each email is queued |
| Discord DM     | Discord bot                                                                                                              | Turn, game started, invited, player joined or declined, vote requested: names, game name, link                                                                                                                 | `/stop`, or remove the app                                                                                                                                                      |
| Web push       | The browser vendor's push service: Google, Mozilla, Apple, Microsoft                                                     | The same notifications. Firestore keeps the endpoint and keys (`notificationSubscriptions`, `pushTopics`), up to 20 per user                                                                                   | Revoke browser permission, sign out, or the vendor reports the endpoint gone                                                                                                    |
| Turn reminders | The channels above                                                                                                       | Sent after 1 min, 1 h, 4 h, 8 h, then every 12 h for 7 days. From the 4-hour reminder on, they move into the user's reminder hours                                                                             | Same as the channel                                                                                                                                                             |
| Live updates   | Ably (`clientId` = user ID; browsers connect to Ably directly) and the realtime relay (Compute Engine VM, `us-central1`) | Game updates and chat messages                                                                                                                                                                                 | Not stored. There is no online-presence feature                                                                                                                                 |

Invitations go to existing users only. Each one creates a token `{gameId, userId}` valid for 7 days.

## Bug reports

Posted to the Discord bug-report forum; nothing is stored in Firestore. A post holds:

- the reporter's username or ID, and a Discord mention if their Discord account is linked;
- the description and up to 3 screenshots;
- user agent, viewport size and pixel ratio, whether the site runs as an installed app, and versions;
- the names of the players whose turn it is;
- a JSON copy of the **whole game, unfiltered**: every player's name and user ID, all timestamps and votes, and the full action history including hidden information. For local games the browser sends its copy.

Developers read the forum through `tools/bug-reports`, which can look up a reporter's email address to reply. It saves attachments to the developer's machine, and AI coding agents may read the posts (the repo includes a skill for that).

## Recipients and processors

| Recipient                                                                                                       | Data                                                                                                                                     | Location                                                            |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Google Cloud: Cloud Run, Firestore, Cloud Tasks, Cloud Scheduler, Secret Manager, Cloud Logging, Compute Engine | Everything above                                                                                                                         | `us-central1` (Firestore location: **Check**)                       |
| Firebase Hosting (Fastly edge)                                                                                  | Every request, with the client IP                                                                                                        | Global                                                              |
| Cloud Storage, public bucket                                                                                    | Code only. Browsers load game bundles from it, so it receives IP addresses                                                               | **Check**                                                           |
| Redis Cloud (Redis Ltd)                                                                                         | Caches of account records, sessions, games and per-viewer histories; rate-limit counters; messages in transit. **Connected without TLS** | **Check**                                                           |
| Ably                                                                                                            | User IDs, game updates, chat, browser IPs                                                                                                | **Check**; also **Check** whether it is still enabled in production |
| Resend                                                                                                          | Email addresses and email contents                                                                                                       | **Check**                                                           |
| Discord                                                                                                         | Discord IDs for OAuth and DMs; bug-report posts; tournament stall DMs to admins naming players                                           | Discord                                                             |
| Google Identity Services                                                                                        | Its script loads on the sign-in, profile and re-authentication pages                                                                     | Google                                                              |
| Web push services                                                                                               | Endpoints and encrypted payloads                                                                                                         | The vendor's                                                        |
| BG Stats (`app.bgstatsapp.com`)                                                                                 | Opt-in; only when the user clicks. The URL carries every player's name, `user:<id>`, score and rank                                      | BG Stats                                                            |
| Tiltify, api.frankfurter.dev                                                                                    | No personal data; the server reads campaign totals and exchange rates                                                                    | —                                                                   |

There is no analytics, error-reporting service, tracking pixel, advertising, font CDN, or other third-party script beyond Google's sign-in.

## Browser storage

| Item                                         | Kind                                                | Contents                                                                  | Class                                   |
| -------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------- |
| `__session`                                  | Cookie: HttpOnly, Secure, SameSite=Strict, 180 days | Encrypted session ID and user ID; OAuth state during Discord sign-in      | Strictly necessary                      |
| `sessionUser`                                | localStorage                                        | The user's own account record (no password hash). Cleared on sign-out     | Functional cache of the user's own data |
| `currentGames`                               | localStorage                                        | The user's game list, with co-players' names and IDs. Cleared on sign-out | Functional cache                        |
| `loginContinuation`                          | sessionStorage                                      | Page to return to after sign-in                                           | Strictly necessary                      |
| `tabletop-local`                             | IndexedDB                                           | Local games. Not cleared on sign-out                                      | Needed for local play                   |
| Game layout keys (for example `indonesia-*`) | localStorage                                        | Board layout; no personal data                                            | Functional                              |
| Service worker                               | —                                                   | Push handling only; no caching                                            | Needed for push                         |

The site sets no other cookies. Google may set its own on pages that load its sign-in script (**Check**). Everything here is either strictly necessary or stores something the user asked for, so a consent banner is probably not needed.

## Sessions, tokens and IP addresses

- **Sessions:** Firestore `sessions/{id}` holds user ID, generation and timestamps, with no IP address or user agent. They last 180 days and are cached in Redis for 1 hour.
- **Tokens:** Firestore `tokens/{id}`.
    - Email verification, password reset and email change last 15 minutes, store hashed codes, and are deleted when used.
    - Game invitations last 7 days.
    - Realtime tokens last 30 to 60 seconds.
- **Rate limits:** Redis keys hold the user ID, the client IP truncated to /64, the username for sign-in, or the email address for password reset. They expire after 1 to 15 minutes.
- **IP addresses in logs:**
    - Backend request logs record `remoteAddress`. For site traffic that is the Firebase Hosting proxy, not the user (`docs/client-address.md`).
    - Rate-limit and client-address warnings log user IPs or user IDs.
    - Cloud Run's own request log (`httpRequest.remoteIp`, user agent): **Check**.
- **Realtime relay:** logs user IDs on refused or dropped connections to the VM's journal, never IPs. Caddy's access log is off.

## Retention

| Data                                        | Kept                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts                                    | Until the owner deletes it from their profile, or an admin deletes it. Deletion leaves a tombstone (ID, status, creation, activation and deletion times) and releases the username, email and linked accounts; seats in games become "Deleted player N"; their chat messages stay, shown under that seat name |
| Games, actions, chat                        | Indefinitely. The owner can delete a game before it finishes; admins can delete any game. Deleting a game removes its chat and history                                                                                                                                                                        |
| Stalled games                               | Ended as Abandoned after 30 days without a move; not deleted                                                                                                                                                                                                                                                  |
| Sessions                                    | 180 days. Deleted on sign-out; an expired record is deleted by a Firestore TTL policy on `expiresAt`, usually within a day                                                                                                                                                                                    |
| Tokens                                      | Deleted when used; an expired one is deleted by a Firestore TTL policy on `expiration`, usually within a day (invitations included)                                                                                                                                                                           |
| Push subscriptions                          | Until unsubscribed or reported gone                                                                                                                                                                                                                                                                           |
| Site statistics                             | Indefinitely (hashed)                                                                                                                                                                                                                                                                                         |
| Redis                                       | `user-<id>` and game keys have no expiry (evicted under memory pressure); histories 24 h; states and stats 7 days                                                                                                                                                                                             |
| Logs                                        | Cloud Logging and journald defaults: **Check**                                                                                                                                                                                                                                                                |
| Firestore backups or point-in-time recovery | **Check**                                                                                                                                                                                                                                                                                                     |
| Discord bug-report posts                    | Until deleted in Discord                                                                                                                                                                                                                                                                                      |

## Security measures

- **Passwords:** bcrypt, cost 10, minimum 12 characters.
- **Session cookie:** encrypted with libsodium secretbox and an Argon2-derived key. HttpOnly, Secure, SameSite=Strict.
- **Recent sign-in:** sensitive changes require signing in within the last 15 minutes. "Log out everywhere" revokes every session.
- **CSRF:** SameSite=Strict cookies, and CORS limited to the site's origin.
- **Emailed codes:** stored as SHA-256 hashes and compared in constant time.
- **Rate limits:**

    | Scope                     | Limit            |
    | ------------------------- | ---------------- |
    | Signed-in account         | 500 requests/min |
    | Anonymous client          | 100 requests/min |
    | Sign-in, per username     | 20 per 15 min    |
    | Password reset, per email | 10 per 15 min    |

- **Secrets:** kept in Secret Manager. Logs redact credentials.
- **Realtime relay:** 60-second single-use tokens. The VM is a Shielded VM reachable over SSH only through IAP.
- **Weak point:** the Redis connection has no TLS.

## Automated decisions

These are routine and none has a legal or similarly significant effect, so Art. 22 does not apply:

- the offensive-name filter for usernames and listed game names;
- automatic consequences of a manual ban;
- stalled games ended after 30 days;
- tournament stall alerts to admins;
- league promotion and relegation;
- turn reminders;
- the one-minute auto-start.

There is no profiling, advertising or abuse scoring.

## Open items

The facts still needed for the production privacy policy, and the console checks marked **Check** above, are tracked in #255.
