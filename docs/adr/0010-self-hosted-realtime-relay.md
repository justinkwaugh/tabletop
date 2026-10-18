---
status: proposed
---

# Realtime Updates go through a self-hosted relay

Realtime Connections are held by a small Go relay on a Compute Engine e2-micro at `events.boardtogether.games`, not by Ably or by the backend on Cloud Run. Ably's free tier caps concurrent connections and monthly messages, so it will not carry the site as it grows. Cloud Run bills an open stream as a busy instance, ends a request after 60 minutes, and drains streams on every backend replacement ([backend restart memory](../backend-restart-memory.md)). Firebase Hosting cannot forward to a VM and cuts the requests it forwards at 60 seconds, so streams cannot share `boardtogether.games`.

The backend keeps every authorization decision: it signs a short-lived token listing the Topics a User Account may receive, and the relay forwards Redis pubsub messages it does not interpret. The relay keeps no event buffer. A reconnect is a new connection that signals a Discontinuity for each Topic once its subscriptions are confirmed, and consumers reconcile with their canonical source. The design is in [docs/realtime-relay.md](../realtime-relay.md).

## Considered Options

- **A paid Ably plan.** Works, but its cost grows with connections and messages, for a transport that does nothing the relay cannot.
- **SSE on a separate Cloud Run service.** Still billed as busy while streams are open, and still cut at 60 minutes.
- **A Node relay.** Would share the backend's language, but the relay needs none of the backend's code once tokens are signed and messages are opaque. Go gives one static binary, about 10 MB of idle memory on a 1 GB machine, and no runtime to patch on the VM.
- **Container-Optimized OS.** Stronger defaults (a read-only root, verified boot, Google-managed updates), but it needs a Docker daemon on a 1 GB machine and a container registry for every deploy, for one static binary. Debian 13 with automatic security updates and a hardened systemd unit was chosen instead.
- **TLS in the relay with Go's `autocert`.** One process instead of two, but Caddy is a well-tested certificate manager, keeps the relay a plain HTTP server that runs the same locally, and can serve other subdomains from the VM later.
- **Resumable streams with event IDs and a replay buffer.** Unnecessary, because consumers already reconcile on a Discontinuity, and the game endpoint's ETags make reconciling an unchanged game a 304.
- **A maximum connection lifetime for revocation.** Replaced by a control feed the backend publishes to when an account must lose its connections, tokens that carry their issue time so a revocation also rejects older tokens, and closing every connection whenever the relay's Redis subscriber reconnects.

## Consequences

- Go joins TypeScript and Rust in the repository and in CI, and the relay's contract with the backend spans two languages.
- The relay is a single machine without failover. While it is down, Realtime Updates stop and the site otherwise keeps working.
- Production publishes Realtime Updates to Ably only, so the backend publishes to both Ably and Redis until the cutover is complete.
