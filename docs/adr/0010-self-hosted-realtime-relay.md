---
status: proposed
---

# Realtime Updates go through a self-hosted relay

Realtime Connections are held by a Realtime Relay, a small Go server on its own Compute Engine e2-micro at `events.boardtogether.games`, instead of Ably or the backend on Cloud Run. Ably's free tier caps connections and messages. Cloud Run bills an open stream as a busy instance, ends requests after 60 minutes, and drains streams on every replacement. Firebase Hosting cannot forward to a VM and cuts forwarded requests at 60 seconds. The relay subscribes to the Redis pubsub the backend already publishes to and accepts a short-lived token signed by the backend that lists the Topics a User Account may receive, so every authorization decision stays in the TypeScript backend and the relay forwards messages it does not interpret. It keeps no event buffer: a reconnect is a new connection that signals a Discontinuity for each Topic once its subscriptions are confirmed, and consumers reconcile with their canonical source. The design is in [docs/realtime-relay.md](../realtime-relay.md).

## Considered Options

- **A paid Ably plan.** Works, but the cost grows with connections and messages, for a transport that does nothing the relay cannot.
- **SSE on a separate Cloud Run service.** Still billed as busy while streams are open, and still cut at 60 minutes.
- **A Node relay.** Would share the backend's language, but the relay needs none of the backend's code once tokens are signed and messages are opaque. Go gives one static binary, about 10 MB of idle memory on a 1 GB machine, and no runtime to patch on the VM.
- **Resumable streams with event IDs and a replay buffer.** Unnecessary, because consumers already reconcile on a Discontinuity, and the game endpoint's ETags make reconciling an unchanged game a 304.
- **A maximum connection lifetime for revocation.** Replaced by a control Topic the backend publishes to on deactivation, deletion and Logout All, plus closing every connection whenever the relay's Redis subscriber reconnects.

## Consequences

- Go joins TypeScript and Rust in the repository and in CI.
- The token format, Topic names, event framing and control messages are a contract across two languages, held small and covered by a cross-language test.
- The relay is a single machine without failover. While it is down, Realtime Updates stop and the site otherwise keeps working.
