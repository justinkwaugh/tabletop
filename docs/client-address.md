# Client address and request throttling

The backend throttles anonymous requests by client address and Authenticated Sessions by
Account. This page records where the client address comes from, which hops of the path to
production are trusted, and the evidence behind that trust. The derivation lives in
`apps/backend/src/runtime/clientAddress.ts`; the supervisor gateway in
`apps/backend/src/runtime/backendGateway.ts` preserves the chain the derivation reads.

## The path to production

```
Browser -> Firebase Hosting (Fastly edge, Google proxy) -> Cloud Run ingress -> gateway (main.ts) -> worker (Fastify)
```

Each hop appends the address it accepted the connection from to `X-Forwarded-For`, so at the
worker the header reads, right to left: the gateway's peer (the Cloud Run ingress), the address
that connected to Cloud Run (a Firebase Hosting proxy, or a direct caller of the `run.app`
URL), then whatever earlier hops and the browser itself sent. The worker's socket peer is
always the gateway on loopback, or the supervisor's own health probe.

The worker trusts exactly two hops: the loopback socket peer, and, on a Cloud Run service,
a link-local gateway peer (`169.254.0.0/16`). Fastify's `request.ip` is therefore the address
that connected to Cloud Run. Nothing further left in the header is trusted: it is attacker
writable from any direct caller.

Firebase Hosting rewrites reach Cloud Run from Google's own service addresses, not from the
browser, so for Hosting traffic `request.ip` is a proxy shared by many people. Hosting's
Fastly edge sets `Fastly-Client-IP` to the browser's address and overwrites any value the
browser sent. The client address is therefore:

- `Fastly-Client-IP`, when `request.ip` is a Google service address and the header holds an
  address;
- otherwise `request.ip`, and a `warn` log names the ignored claim.

Firebase Hosting does not publish the addresses its rewrites originate from. The backend
recognises the Hosting hop through Google's published ranges: everything in
[goog.json](https://www.gstatic.com/ipranges/goog.json) that
[cloud.json](https://www.gstatic.com/ipranges/cloud.json) does not allocate to Cloud
customers, which Google documents as the addresses of its own services. The snapshot is
`apps/backend/src/runtime/googleServiceRanges.ts`; regenerate it with

```
node tools/scripts/refresh-google-service-ranges.mjs
```

and release the backend. If Hosting starts forwarding from a range outside the snapshot,
anonymous Hosting traffic collapses onto that proxy's address and the
`Ignoring Fastly-Client-IP that did not arrive through Firebase Hosting` warning carries the
new address as `ingressPeer`; refreshing the snapshot is the fix.

## Evidence (2026-10-27)

- Every one of 300 sampled `/api` requests in the Cloud Run request log arrived from a
  Google service range (`64.233/19`, `66.102/20`, `66.249/19`, `74.125/16`, `142.250/15`,
  `192.178/15`), with the public site as referer. Firebase Hosting is the only route the
  Site Frontend uses, so these are the Hosting proxies.
- The backend's "incoming request" log showed `remoteAddress` `169.254.169.126` for all
  gateway traffic and `127.0.0.1` for the supervisor's health probes.
- One anonymous GET of `/api/v1/manifest` through `boardtogether.games` with
  `Fastly-Client-IP: 203.0.113.77` was logged with the sender's real address, so the edge
  overwrites the header. Fastly's own documentation says the header is client writable unless
  the service's VCL sets it; Firebase's configuration does.
- Cloud Run does not strip `Fastly-Client-IP` or `X-Forwarded-For` from direct callers; the
  previous key trusted the header unconditionally, so a direct caller renewed its quota on
  every request.

Cloud Run appending the connecting address to `X-Forwarded-For` is Google front-end
behaviour documented for Cloud Functions and relied on here; the backend has no log of the
raw header to confirm it on this service. If that assumption fails, `request.ip` becomes
attacker writable for direct callers only; Hosting traffic is still attributed through the
header rule above.

## Budgets

| Scope                       | Budget                         | Where                                            |
| --------------------------- | ------------------------------ | ------------------------------------------------ |
| Anonymous client address    | 100 requests / minute          | `apps/backend/src/app/plugins/rateLimit.ts`      |
| Authenticated Session       | 500 requests / minute          | same, keyed by Account ID                        |
| Route-specific              | per route `config.rateLimit`   | login, registration, provider links, emails      |
| Login attempts per Username | 20 / 15 minutes, any addresses | `apps/backend/src/app/routes/api/auth/login.ts`  |
| Reset emails per address    | 3 / 15 minutes, any requesters | `.../routes/api/user/email/sendPasswordReset.ts` |

Operation budgets are built with `operationBudget` in `apps/backend/src/app/lib/operationBudget.ts`,
which keys the plugin's limiter by the operation's subject (a Username or Email Address,
trimmed and lowercased) instead of the request's address. They answer `429` with
`Retry-After` and are counted per instance, like every budget here.

## Residual exposure

- Budgets are per Cloud Run instance; a shared store would make them global.
- A request from a Google-hosted fetcher (for example Apps Script) arrives from a Google
  service range and could carry a forged `Fastly-Client-IP`. Such fetchers have their own
  quotas, and the operation budgets do not depend on the address at all.
- Provider logins (Google, Discord) and challenge-token login are bounded per address only.
