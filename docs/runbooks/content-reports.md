# Content Reports

Players report a chat message, a username or a game name from a game (see Content Report in `docs/contexts/game-conversations/CONTEXT.md`). `ContentReports` (`libs/backend-services/src/moderation/contentReports.ts`) resolves what was reported and queues `/tasks/email/sendContentReportEmail` on the `maintenance` queue, which emails it to the moderation address. Nothing is stored.

## Setup

Reporting is off until the backend service has a `MODERATION_EMAIL` environment variable; the report route answers 503 without it. Only the `backend` service needs it, since the address travels in the task payload. Set it once; releases keep it.

```sh
gcloud run services update backend \
  --project tabletop-426201 \
  --region us-central1 \
  --update-env-vars MODERATION_EMAIL=<moderation address>
```

## Rollout

1. Release the backend, then set `MODERATION_EMAIL` (above).
2. Release the Site Frontend. The **Report…** item in the in-game menu then covers chat messages, usernames and game names in every title.
3. The flag on each chat message lives in the shared chat panel, which each title's UI Artifact bundles. A title shows it only from its next UI-only Publication; there is no need to republish every title at once. An older Site Frontend never offers reporting to a newer UI, so the flag stays hidden there.

## Acting on a report

The email's **Review in moderation** button opens `/admin/moderate/<gameId>`, highlighting the reported message. From there an Administrator can:

- **Remove** a chat message. Its text becomes "Removed by a moderator" for everyone, including games whose UI predates redaction, and open games update straight away.
- **Rename** the game, at any status.

A reported username is renamed from the admin Users tab, found by the account ID in the email.

## Records

- `"event":"content_report"`: one per report, without the content.
- `"event":"chat_message_redacted"`: the Administrator, the author and the original text.
- `"event":"game_renamed_by_administrator"`: the old and new names.

These log lines, and the report emails, are what an appeal is reviewed against.
