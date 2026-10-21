# Pay it forward

Board Together asks players who enjoy the site to give to charities that put games in front of people, never to the site itself. The first call to action must be quiet and must read as "not for us" at a glance. A page explains the rest once a player engages.

Mockups: [`pay-it-forward/mockups.html`](pay-it-forward/mockups.html) (open in a browser). The settled page is rendered in [`pay-it-forward/page.png`](pay-it-forward/page.png).

![Pay it forward page](pay-it-forward/page.png)

## Settled with the user

- The label everywhere is **Pay it forward**. "Donate" and "Support us" never appear on our own pages; both read as asking for ourselves.
- The "no" is **We don't take personal donations.** The word *personal* matters: corporate sponsorship of the site stays possible, players never pay. It is followed by **The bills are ours, and nothing you give from this page comes to us.**
- The charities are **Board Games for the Better** (board games for people in hard times) and **Gamers Outreach** (gaming carts for kids in hospitals). Gamers Outreach was chosen over Extra Life.
- A running **tally** of what Board Together players have raised is wanted. An "I gave" self-report button is not.
- No modals, banners or coloured buttons for the ask. No eyebrow labels in the page typography.
- The finished-game line ("Good game? Pass it on.") is a maybe. The milestone card is parked for a later revisit. Neither is in the first version.

## The page: /pay-it-forward

Public, in the About page's visual language.

1. Title **Pay it forward.** with a link back to the library.
2. Header row: the lead "**Board**Together is free, and we plan to keep it that way." with the wordmark (bold blue Board, light Together), and the principles column: *Always* free to play. *Fully* open source. *Never* funded by its players.
3. Full width below the header:
   - **We don't take personal donations.** as a blue statement, with its one body line.
   - **Pass it on instead.** as a white statement in the same face, with "If the games here have been worth something to you, help put games in front of people who need them. Few charities are built around board games, so we've picked one that is, and one that brings play of any kind to children in hospitals."
4. One card per charity: name, a brighter subtitle saying what it does, a short description, a "Give through …" link to a Board Together page on the charity's platform, and a line saying where it opens.
5. "Board Together gets nothing from these links: no referral fee, no cut, no data back to us."
6. The tally: total raised by Board Together players, with the split per charity.

On phones the principles column drops and the cards stack.

## Entry points

All are links to the page, at the visual weight of "About Us".

- Header text link with a heart icon. Its tooltip says "Help charities put games on more tables. Nothing goes to us."
- Phone account menu entry beside "About us".
- About page: a third principle, *Never* funded by its players, and a third card, "Pay it forward", whose first sentence is "We don't take personal donations."
- Landing small print: "*Always* free to play. Fully open source. No tip jar, but you can pay it forward →".
- One-line footer on signed-in pages: "Free to play, always. Board Together takes no personal donations. Pay it forward →".

## The tally

A backend job fetches each charity's total once a night and caches it. The browser never polls.

| Charity | Platform | What it exposes | Set-up needed |
|---|---|---|---|
| Gamers Outreach | Tiltify, and GoFundMe Pro for direct giving | Tiltify v5 public API: a campaign's `amount_raised`, `goal`, `donate_url`, `url`. Needs an application token from a free Tiltify account (client credentials, `POST https://v5api.tiltify.com/oauth/token`, two-hour lifetime). Unauthenticated requests get 401. | A Board Together campaign under their cause, tiltify.com/gamersoutreach. Tiltify retires a campaign after six months without a donation, so the job must notice retired status and fall back to a plain donate link. The user may visit them in person and could get a GoFundMe Pro page with read access instead. |
| Board Games for the Better | Givebutter | The API needs the charity's own key. Their goal-bar widget shows amount raised but needs their account ID and a campaign code. | The user is contacting them. Ask for a Board Together campaign or team page, then either a restricted API key for the nightly job or their goal-bar widget on our page. |

Platform totals can include pledges or unsettled gifts, so the page says "raised", not "received". Until a charity's page exists, its card links to the charity's general donate page and it is left out of the tally.

## First version

| Piece | Status |
|---|---|
| /pay-it-forward page | Build, tally wired to the Gamers Outreach Tiltify campaign first |
| Header link and phone menu entry | Build |
| About card and third principle | Build |
| Landing small print | Build |
| Signed-in footer line | Build |
| Finished-game line | Maybe, not in v1 |
| Milestone card | Revisit later |
| "I gave" button | Dropped |

## Other charities considered

Board-game-specific charities are rare and mostly small. Checked on 2026-10-21:

- **Extra Life** (Children's Miracle Network Hospitals, DonorDrive): keyless public API. Dropped in favour of Gamers Outreach.
- **Child's Play** (games for children's hospitals): no API of its own; fundraisers run on Tiltify (tiltify.com/child-s-play), so it would take the same route as Gamers Outreach.
- **Jack Vasel Memorial Fund** (hardship grants to gamers, EIN 45-1583593): PayPal button only, no totals.
- **Meeples for Peeples** (St. Louis, games for families and educators): Give Lively, which has no public API, only an iframe widget and member-side Zapier.
- **Board Game Buddies** (Chicago), **Board Game Blast** (Los Angeles), **The Bodhana Group** (York, PA): small, no machine-readable totals found.
- **Game to Grow** is winding down; excluded.
