---
name: bug-reports
description: Work player bug reports in the Discord bug-reports forum through tools/bug-reports. Use when asked to look at, fix, answer or close bug reports, or given a link to a forum post.
---

# Bug reports

Players report bugs with the in-game bug button, and the site's bot opens a post in the Discord
`bug-reports` forum. Everything here goes through `node tools/bug-reports/src/cli.mjs`; its
`--help` lists the commands and what each milestone needs. Work one post at a time, from start
to finish.

The reporter hears from you at each **milestone**: `investigating`, `reproduced`, then `fixed`,
`wont fix` or `not a bug`. Setting one sends them its fixed wording plus your `--note`. Most
reporters are not in the Discord server, so the message is their only answer.

The note goes to the reporter alone; the forum gets the status. Write it as the site to a
player, in plain words about what they saw and what changes. Keep opponents' hidden
information out (hands, hidden stacks, secret choices); the scenario holds all of it. Send each
milestone as you reach it and tell the user what went out; `not a bug` alone waits for their
approval (step 3). A command that updated the post but could not reach the reporter says so;
`notify` sends the message again.

## 1. Read

Run `check`, then `list`, or take the post the user named. Read the post with `show`, and save
its files with `download`: the scenario `bug-report-<gameId>.json` and any screenshots. Look at
every screenshot.

Then send the first milestone: `status <post> investigating`.

Done when you can state what the player did, what they expected and what they saw, on which
versions and device, and the reporter has been told it is being investigated.

## 2. Reproduce

Follow the `diagnosing-bugs` skill; the report supplies its first loop. Open the scenario in the
title's dev harness with **Load from file…** (`docs/harness-scenarios.md`); it is a real game
with real names, so it stays out of the repository. For what the server did, use the
`prod-investigation` skill with the game id. Compare the reported versions with what is serving
now: the bug may already be fixed.

Done when the bug goes **red** (a failing test, or the harness showing it) or you can show the
report is expected behaviour.

## 3. Post findings

Each outcome has its milestone:

- **A bug**: `status <post> reproduced`, with a note saying what goes wrong in the player's
  terms, and `tag --add UI` or `logic` for where the fault lies.
- **Not a bug**, when the game did what it should and the player expected something else, or it
  behaves that way for a good reason: `close <post> --as "not a bug"`. This message disagrees
  with the player, so the note is **gentle**: take their concern seriously, then explain in a
  positive way why the game works like this, or give the tip for doing what they were after.
  Run it with `--dry-run` first and show the user the message and its email preview; it goes
  out with `--approved`, which you add once they agree, every time.
- **Won't fix**, a real fault that will stay as it is: `close <post> --as "wont fix"` with a note
  saying why.

Done when `show` prints the status line and the command reported the reporter told.

## 4. Fix

Fix it test-first with the `tdd` skill, keeping the red test as the regression test.

Done when that test passes and the fix is committed.

## 5. Close

A post is `fixed` once the fix is **serving**, which the `release` skill checks. Then
`close <post> --as fixed` with the release that carries it (`--version "Sol UI 6.4.2"`), and a
note when the player has something to do or notice beyond reloading.

While the fix is committed but not released, the post stays `reproduced`; tell the user it is
waiting on a release.
