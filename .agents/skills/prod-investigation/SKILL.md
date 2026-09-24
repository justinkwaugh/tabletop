---
name: prod-investigation
description: Investigate what production actually did, read-only, through tools/investigate: Cloud Logging, Cloud Run services and revisions, Cloud Tasks queues, and Firestore. Use for any question about production behaviour or data: an error or log line, a bug in a hosted game, stuck or missing tasks and notifications, what a user or game record holds, or which revision is serving.
---

# Production investigation

Production is read through one CLI, `node tools/investigate/src/cli.mjs <command>` from the
repository root, whose `--help` lists the commands. It authenticates with a viewer-only
service account key, so every command is a read. Redact before quoting: the CLI masks stored
secrets and push endpoints, but log lines can still carry emails, tokens in URLs, or cookies,
so quote only the lines that carry the signal and write `<REDACTED>` over anything sensitive.

## 1. Preflight

Run `check`. Continue only when every capability prints `ok`. A missing key file or a `FAIL`
line names the role or setup step; hand that to the user, since creating the account and key
needs their own gcloud login, and stop.

## 2. Predict, then look

Before querying, write down what production would show if the report is true and if it is
false, and which source holds each signal. The sources and what each can answer:

- **Firestore** holds _what is stored_. `collections [docPath]` discovers the layout; `doc`
  reads one record; `list` queries a collection, with `--group` for a subcollection name
  across all parents (every game's `actions`), `--count` for sizes, and `--json` for piping.
  Map code to data through the `firestore.collection('...')` calls in
  `libs/backend-services/src/persistence/firestore`; `find-user` and `game` are shortcuts for
  the two most common joins.
- **Logs** hold _what the code did_. The backend logs through pino and `console.log`, which
  land in `jsonPayload.msg` and `textPayload` with severity `DEFAULT`, so grep for the literal
  string from the source (`--grep`) rather than relying on `--severity`, which only catches
  platform errors. `--request <reqId>` follows one request across its lines, `--service tasks`
  covers work handed to Cloud Tasks, and `--filter` with `--any-resource` reaches any
  Logging resource.
- **Tasks** hold _what is still scheduled_. `tasks` lists queues (a `PAUSED` queue dispatches
  nothing); `tasks --queue <name>` lists pending tasks with decoded bodies, `stuck` for any
  well past its schedule. A task that ran has left the queue, so its outcome is in the `tasks`
  service logs around its schedule time.
- **Services** hold _what is serving_. `services` shows revisions and traffic; `revisions`
  shows history. Confirm the code you are reading is the code that ran before blaming it.

## 3. Narrow

Start with the narrowest time window and the most specific document, then widen one variable
at a time. Stop when every predicted signal from step 2 has been seen or shown absent, and
every finding names the command that produced it so the user can rerun it.

## 4. Report

Lead with what production shows and whether it confirms the report. Quote the exact log line
or document field, redacted, with its command. Say which expected signal was absent and what
that rules out. When the evidence points at code, name the file and line; when it points at
data or infrastructure, say what would fix it and that any change is outside this skill,
which only reads.
