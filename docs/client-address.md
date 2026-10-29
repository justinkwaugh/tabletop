# Client address and request budgets

The backend bounds anonymous requests by client address, Authenticated Sessions by Account, and
the sensitive authentication operations by their subject. This page records where the client
address comes from, which hops of the path to production are trusted, what the evidence for
that trust is, and which guarantees the budgets do and do not give. The derivation lives in
`apps/backend/src/runtime/clientAddress.ts`, the budgets in
`apps/backend/src/app/plugins/rateLimit.ts` and `apps/backend/src/app/lib/operationBudget.ts`,
and the shared counter in `libs/backend-services/src/cache/rateLimitCounter.ts`.

## The path to production

```
Browser -> Firebase Hosting (Fastly edge, Google proxy) -> Cloud Run ingress -> gateway (main.ts) -> worker (Fastify)
```

Each hop that the backend controls appends the address it accepted the connection from to
`X-Forwarded-For`. At the worker the header reads, right to left: the gateway's peer (the Cloud
Run ingress), the address that connected to Cloud Run, then whatever earlier hops and the
browser itself sent. The worker's socket peer is always the gateway on loopback, or the
supervisor's own health probe.

| Hop                                 | Who sets it                         | Trust                                   |
| ----------------------------------- | ----------------------------------- | --------------------------------------- |
| Worker socket peer                  | the kernel                          | verified; must be loopback              |
| Gateway peer (`169.254.0.0/16`)     | `backendGateway.ts`                 | verified; our own code appends it       |
| Address that connected to Cloud Run | Cloud Run's front end               | relied on, not verified on this service |
| Everything further left             | the caller, or Firebase Hosting     | caller writable                         |
| `Fastly-Client-IP`                  | Hosting's edge, or any other caller | a hint, never authentication            |

Fastify's `request.ip` walks the chain through the two verified hops and stops, so it is the
address that connected to Cloud Run: the **ingress peer**. For a direct caller of the `run.app`
URL that is the caller itself. For a browser using the site it is one of Firebase Hosting's
proxies, which forward from Google's own service addresses and set `Fastly-Client-IP` to the
browser's address.

## Attribution: the ingress peer and the Hosting hint

Google's service ranges are not an authentication of Firebase Hosting. Anything Google hosts
can fetch from them with headers of its choosing; Apps Script's `UrlFetchApp`, for instance,
documents that its requests "originate from a set pool of IP ranges" and takes "a JavaScript
key/value map of HTTP headers for the request". Firebase Hosting does not sign its rewrites,
adds no secret header, and needs the service to accept all ingress with the public invoker role
(see Evidence), so the backend has no way to tell a Hosting proxy from another Google-hosted
caller.

`clientIdentity(request)` therefore returns two things:

- the **ingress peer**, `request.ip`, which only the connection itself can set;
- the **client**: `Fastly-Client-IP` when the ingress peer is a Google service address and the
  header holds an address (attribution `hosting-hint`), otherwise the ingress peer itself
  (attribution `ingress-peer`). A claim that is ignored is logged at `warn` as
  `Ignoring Fastly-Client-IP that did not arrive from a Google service address`.

The hint keeps attribution usable: client addresses behind the same Hosting proxy retain their
own budgets. It is never the only bound on a request.

Anonymous client keys use Fastify's `normalizeIP(address, 64)`: equivalent IPv6 spellings share
a key, IPv4-mapped IPv6 addresses share the ordinary IPv4 key, and all addresses within one
IPv6 `/64` share a budget. Separate people on that subnet therefore share the anonymous
allowance. Account, Username and Email Address keys are independent of IP addresses. Hosting
peer keys use `normalizeIP(address, 128)`, which normalizes spellings without combining distinct
Google proxy addresses into one subnet budget.

## Budgets

Every budget is a fixed window counted in the shared store described below.

| Layer                  | Key                                   | Who could forge the key                | Budget                                                               |
| ---------------------- | ------------------------------------- | -------------------------------------- | -------------------------------------------------------------------- |
| Account                | `user:<account id>`                   | nobody without the session cookie      | 500 requests / minute                                                |
| Client                 | `client:<normalized client>`          | any Google-hosted caller, via the hint | 100 requests / minute, or the route's `config.rateLimit`             |
| Hosting peer           | `peer:<route>:<ingress peer>`         | nobody; it is the connection's address | 3 × the route's client budget, per Google service address, per route |
| Login                  | `login:<username>`                    | nobody; the subject is the target      | 20 attempts / 15 minutes, from any addresses                         |
| Password reset         | `password reset:<email>`              | nobody; the subject is the target      | 10 emails / 15 minutes, from any requesters                          |
| Email verification     | `email verification:<account id>`     | nobody without an eligible session     | 10 requests / 15 minutes, across the Account's sessions              |
| Sensitive change email | `sensitive change email:<account id>` | nobody without an eligible session     | 10 requests / 15 minutes, across the Account's sessions              |

The Hosting peer layer runs only for anonymous requests attributed through the hint. A caller
who rotates `Fastly-Client-IP` from one Google service address escapes the client layer but
spends the peer layer, so its effective bound per route is three client budgets per address it
can send from, not unlimited. The factor is `browsersPerHostingPeer` in `rateLimit.ts`; the
request logs sampled on 2026-10-27 never showed more than 4 requests in a minute from one
Hosting proxy (see Evidence), so three full client budgets leave wide headroom for legitimate
browsers sharing a proxy. Direct callers are keyed by their own address and have no separate
peer layer, because the two would be the same key.

Route budgets (`config: { rateLimit: { max, timeWindow } }`) replace the default client budget
for that route and scale the peer layer with it; `rateLimit: false` exempts a route from both.
On the `local` service only routes with their own budget are limited, so the dev harness and
local hosted site behave as production does for login, registration and emails and are
otherwise unlimited.

Ably token issuance has a route budget of 60 requests per Account per minute. Verification
email and Sensitive Change email requests each keep their route budget of 5 requests per
Account per minute in addition to the independent fifteen-minute operation budgets above.

Operation budgets are built with `operationBudget`, which keys a limiter by the operation's
subject (a trimmed, lowercased Username or Email Address, or an authenticated Account ID) and
answers `429` with `Retry-After`. They do not read the address at all, so no header rotation
affects them. Account email budgets run after authorization and before the email is enqueued;
refused attempts cannot send an email.

## Shared storage and failure policy

All budgets count through `fastify.rateLimitCounter`, a `RedisRateLimitCounter` over the backend's
Redis connection, so every Cloud Run instance and every supervisor-replaced worker continues the
same windows. Each count is one Lua script (`INCR`, then `PEXPIRE` on a new window) so a window
is never left without an expiry and concurrent requests on different instances cannot both be
admitted past the budget. Keys are `rate-limit:` followed by the route scope for route-level
budgets (`GET:/api/v1/auth/login:`) and the key above.

If Redis does not answer within 250 ms, or the connection is down, the counter falls back to
per-process counting for that request and logs
`Rate limit counter falling back to per-process counting: cache unavailable` once per outage and a
recovery line when Redis answers again. The budgets therefore narrow to one instance during a
cache outage; they never open, and requests never fail because the counter did. Any other error
from Redis is a real fault and fails the request with `500`.

## Evidence (2026-10-27)

Read-only production evidence, gathered with `tools/investigate` (prod-investigation skill) and
the Cloud Run Admin API with the same viewer key; no infrastructure was changed.

- The `backend` service runs with `ingress: INGRESS_TRAFFIC_ALL` and `roles/run.invoker` for
  `allUsers`; `tasks` runs with `INGRESS_TRAFFIC_INTERNAL_ONLY`. Firebase Hosting is not among
  the Google products Cloud Run admits under internal ingress, so Hosting rewrites require this
  open configuration. No supported setting makes Hosting the only caller.
- Six two-hour samples of the Cloud Run request log for `/api/` between 2026-10-24 and
  2026-10-27 (26 859 requests) came from 858–1036 distinct ingress peers per sample, all in
  Google service ranges except one residential address that also calls the `run.app` URL
  directly. The busiest Google peer sent 4 requests in a minute and 10 in fifteen minutes; the
  busiest minute overall carried 213 requests. The sampling commands are in
  `/workspace/tmp/security-remediation-2026-10-27/s08-r2/`.
- One anonymous GET of `/api/v1/manifest` through `boardtogether.games` with a forged
  `Fastly-Client-IP` was logged with the sender's real address (round 1), so Hosting's edge
  overwrites the header for traffic that really comes through Hosting. That protects Hosting
  users' attribution; it says nothing about callers that bypass Hosting.
- No request in the seven days before 2026-10-27 hit the old limit on the `tasks` service, so
  keying Cloud Tasks deliveries by their Google ingress peer changes nothing in practice.
- Cloud Run appending the connecting address to `X-Forwarded-For` is documented by Google for
  Cloud Run functions (`docs.cloud.google.com/functions/docs/reference/headers`: "a
  comma-delimited list of IP addresses through which the client request has been routed"),
  which deploy onto Cloud Run, and for the external Application Load Balancer. The Cloud Run
  container contract itself does not describe the header, and this service keeps no log of the
  raw chain. **This remains an assumption.** If it were false, a direct caller of the `run.app`
  URL could choose its ingress peer, and every address-keyed layer, including the Hosting peer
  layer, would be forgeable for direct callers; only the operation budgets would hold. Verify
  after the first release of this code: send one request with a forged `Fastly-Client-IP` and
  a forged `X-Forwarded-For` straight to the `run.app` URL, then compare the `ingressPeer` in
  the worker's `Ignoring Fastly-Client-IP` warning with `httpRequest.remoteIp` of the same
  request in the Cloud Run request log. They match only if Cloud Run appended the address.

## Limitations

- A caller on Google infrastructure can spend up to three client budgets per route from each
  Google egress address it controls by forging `Fastly-Client-IP`. For login that is 150
  attempts a minute per address, spread over Usernames because each Username allows 20 per
  fifteen minutes. The bound is per address, not global; Google's fetchers use many addresses.
- Provider logins (Google, Discord) and challenge-token login are bounded per client and per
  Hosting peer only; they have no subject budget yet.
- Cloud Run's forwarding semantics are relied on, not verified (above).
- A verifiable ingress boundary is not available with Firebase Hosting rewrites. Reaching one
  would mean moving the API behind an external Application Load Balancer (Cloud Run ingress
  `internal-and-cloud-load-balancing`, Cloud Armor rate limiting at the edge, the load
  balancer's documented `X-Forwarded-For` shape) and pointing the Site Frontend's API calls at
  that address instead of Hosting's `/api/**` rewrite. That is an infrastructure change with its
  own cost and is not part of this work.

## Operations

- `Ignoring Fastly-Client-IP that did not arrive from a Google service address` names a claim
  from a non-Google peer. If it shows a new `ingressPeer` for genuine site traffic, Hosting has
  started forwarding from a range outside the snapshot; refresh
  `apps/backend/src/runtime/googleServiceRanges.ts` with
  `node tools/scripts/refresh-google-service-ranges.mjs` (Google's
  [goog.json](https://www.gstatic.com/ipranges/goog.json) minus
  [cloud.json](https://www.gstatic.com/ipranges/cloud.json)) and release the backend. Until
  then anonymous traffic from that proxy shares one client budget.
- `Hosting peer request limit exceeded` carries the ingress peer that spent three client
  budgets on one route in one window. Legitimate browsers would need to share a proxy at many
  times the observed rate to trigger it.
- `Request limit exceeded` is the client or Account layer, as before.
