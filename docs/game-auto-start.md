# Game automatic start

A game starts automatically when it is a Public Game, or when its Owner holds no seat. Only administrators and developers may create a game they do not play in, so this covers games they set up for others.

When the final seat of such a game is Joined, the game-update transaction that makes it Ready also records `autoStartAt` one minute later. The backend then enqueues an internal `/tasks/games/autoStart` request carrying the game ID and that timestamp. The same transaction logic clears `autoStartAt` when a Player leaves, when the Owner makes a game they play in invite-only or takes a seat in an invite-only game, or when the game starts. A queued task is never deleted. Its timestamp acts as the countdown's identity, so a task from a cancelled or restarted countdown does nothing.

Enqueue failures propagate to the joining Player or updating Owner. The committed countdown remains, and retrying the join or update enqueues its task again. Duplicate tasks share the countdown's identity, so at most one starts the game.

The task starts the game only if the stored `autoStartAt` still matches, checked inside the start transaction. The initial Game State is built from the game read before that transaction, so the start also fails if the game changed since that read, for example through an Owner's configuration edit. The queue then retries with a fresh read. A task for a game the Owner already started returns successfully. Once the start commits, a failure to notify Players is logged rather than failing the task, because a retry would find the game started and could not resend them.

Game cards show `Starting in Ns`, then `Starting…`. The client clock only renders text.

## Deployment

Create the `game-auto-start` Cloud Tasks queue in `us-central1` before deploying a backend that enqueues it:

```sh
gcloud tasks queues create game-auto-start --location=us-central1 \
  --max-concurrent-dispatches=10 --max-dispatches-per-second=5 \
  --min-backoff=10s --max-backoff=300s
```
