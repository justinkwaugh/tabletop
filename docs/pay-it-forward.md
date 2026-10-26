# Pay it forward

Board Together asks players who enjoy the site to give to charities that put games in front of people, never to the site itself. The first call to action must be quiet and must read as "not for us" at a glance. A page explains the rest once a player engages.

Mockups: [`pay-it-forward/mockups.html`](pay-it-forward/mockups.html) (open in a browser). The settled page is rendered in [`pay-it-forward/page.png`](pay-it-forward/page.png).

![Pay it forward page](pay-it-forward/page.png)

## Settled with the user

- The label everywhere is **Pay it forward**. "Donate" and "Support us" never appear on our own pages; both read as asking for ourselves.
- The "no" is **We don't want personal donations.** ("want" rather than "take", the user's choice on 2026-10-26) The word _personal_ matters: corporate sponsorship of the site stays possible, players never pay. It is followed by **The bills are ours, and nothing you give from this page comes to us.**
- The charities are **Gamers Outreach** (US; gaming carts for kids in hospitals) and **SpecialEffect** (UK; adapted controls so people with physical disabilities can play). Gamers Outreach was chosen over Extra Life. Board Games for the Better was the first board-game pick but could not be reached. Players are worldwide, so one US and one UK charity is a feature, and each card says which country it is in.
- The page admits the choice plainly: board game charities are few and mostly small, so it looks to their big brother, video games. It also tells players to give to their favorite charity instead if these two aren't for them.
- The page writes the name as one word, **BoardTogether**, matching the wordmark. The browser tab title keeps the site-wide "Pay it forward — Board Together" form.
- A running **tally** of what BoardTogether players have raised is wanted. An "I gave" self-report button is not.
- No modals, banners or coloured buttons for the ask. No eyebrow labels in the page typography.
- The finished-game line ("Good game? Pass it on.") is a maybe. The milestone card is parked for a later revisit. Neither is in the first version.

## The page: /pay-it-forward

Public, in the About page's visual language.

1. Title **Pay it forward.** with a link back to the library.
2. Header row: the lead "**Board**Together is free, and we plan to keep it that way." with the wordmark (bold blue Board, light Together), and the principles column shared with About: _Always_ free to play. _Fully_ open source. (A third, _Never_ funded by its players, was dropped as a restatement of "free".)
3. Full width below the header:
    - **We don't want personal donations.** as a blue statement, with its one body line.
    - **Pass it on instead.** as a white statement in the same face, with "If the games here have been worth something to you, help put games in front of people who need them. Board game charities are few and mostly small, so we've looked to our big brother, video games. These two well-established charities bring games to people who can't easily get to them: kids stuck in hospital rooms, and players who need adapted controls." On phones the paragraph stops after "our big brother, video games."
4. One card per charity, both the same height with the slack after the description: the charity's logo in place of its name, an outlined country tag ("US charity", "UK charity") beside it, a brighter subtitle saying what it does, a short description, a "Give to <charity> ↗" link to the BoardTogether campaign on Tiltify, and a line saying where it opens.
5. The tally: total raised by BoardTogether players, with the split per charity (see [The tally](#the-tally)).
6. "If these two aren't for you, give to your favorite charity instead. It's paying it forward all the same."
7. "BoardTogether receives nothing from these links."

On phones the principles column drops, the cards stack, and the "Opens …" line under each link is hidden.

Logos (in `apps/frontend/src/lib/components/images/charities/`) come from each charity's own published kit, in its version for dark backgrounds:

- Gamers Outreach: `Gamers_Outreach_Tri_Color_Primary_on_K.png` from the brand folder linked on gamersoutreach.org/press-awareness. Their guidelines allow the white-text colour version on dark backgrounds, ask for clear space the width of the logo's "G", and forbid cropping or recolouring. Their 1.75-inch minimum height is a print size.
- SpecialEffect: `SE_Logo_White_NoStrap.png` from `SE_Logos_2024-No-Straplines-pngs-Only.zip` on specialeffect.org.uk, the fundraiser logo pack. Their guidelines allow the trademark only for purposes SpecialEffect authorises and forbid implying their endorsement; confirming with info@specialeffect.org.uk is worthwhile.

## Entry points

All are links to the page, at the visual weight of "About Us".

- Header text link with a heart icon, in cream (`#f2dfae`, `#fbefcf` on hover) to set it apart from About Us without becoming a button; the phone menu entry uses the same cream. Its tooltip says "Help charities put games on more tables. Nothing goes to us."
- Phone account menu entry beside "About us".
- About page: a third card, "Pay it forward", whose first sentence is "We don't want personal donations." The About cards sit three across on wide screens and stack below 900px.
- Landing small print: "_Always_ free to play. Fully open source. No tip jar, but you can pay it forward →".
- One-line footer at the end of the signed-in library's game list (the library and dashboard fit the viewport and scroll inside, so a page footer would always be on screen): "Free to play, always. Pay it forward →".

## The tally

A Cloud Scheduler job calls the tasks service every 15 minutes. `CharityTallyRefresher` (libs/backend-services/src/payItForward) reads both Board Together team campaigns from Tiltify's v5 public API (`/api/public/team_campaigns/{id}`), converts pounds to dollars at the day's ECB rate from api.frankfurter.dev (keyless), stores the result in Firestore (`payItForward/tally`) and puts it in Redis. The public `GET /api/v1/pay-it-forward/tally` only reads Redis, falling back to Firestore, so a Tiltify or rate-feed outage leaves the last good tally in place and page views never call Tiltify. Browsers cache it for ten minutes; the page asks once on load and never polls. Operations are in [the runbook](runbooks/pay-it-forward.md).

| Charity         | Campaign                                                                                                                              | Currency |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Gamers Outreach | tiltify.com/+boardtogether-community/fundraiser-for-gamers-outreach-foundation (team campaign `1aa404bd-38e9-4955-9178-4f52b63085ac`) | USD      |
| SpecialEffect   | tiltify.com/+boardtogether-community/fundraiser-for-specialeffect (team campaign `4f5b25b7-1a1a-4e50-a65b-c0831eeca686`)              | GBP      |

- Totals are `total_amount_raised`, which includes campaigns that support ours. The page says "raised", not "received", because platform totals can include unsettled gifts.
- The headline is the dollar total; the detail line shows each charity in its own currency: "$1,260 raised by BoardTogether players · $820 for Gamers Outreach · £330 for SpecialEffect", with the total on its own line above. Amounts are floored to whole units.
- The tally is hidden while nothing has been raised and before the first refresh (the route's 404 is expected, not logged as an error).
- A refresh rejects any campaign amount that isn't a plain decimal string, so a malformed Tiltify response keeps the last good tally.
- The campaigns belong to the BoardTogether Community team, so players can start their own campaigns in support of them; `total_amount_raised` counts those too. The first campaigns, under the personal @boardtogether account, were removed.
- Tiltify retires a campaign after six months without a donation. A retired or unpublished campaign's card links to the charity's own donation page instead (gamersoutreach.org/donate, www.specialeffect.org.uk/donate).
- Tiltify answers in HTML unless the request sends `Accept: application/json`.

Credentials: a Tiltify application owned by the BoardTogether Tiltify account, client credentials flow, `public` scope, two-hour tokens refreshed a minute early. The client ID and secret are the Secret Manager secrets `TILTIFY_CLIENT_ID` and `TILTIFY_CLIENT_SECRET`, attached to the tasks service. Only a service with `TILTIFY_CLIENT_ID` set builds the refresher; elsewhere, including local development, the refresh route answers 404 and the page has no tally.

## First version

| Piece                            | Status                                                                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| /pay-it-forward page             | Built; cards link to the Board Together team campaigns on Tiltify                                                                       |
| Header link and phone menu entry | Built                                                                                                                                   |
| About card                       | Built (the principles list is shared with this page)                                                                                    |
| Landing small print              | Built                                                                                                                                   |
| Signed-in footer line            | Built, at the end of the library's game list                                                                                            |
| Tally                            | Built: refreshed every 15 minutes by a scheduled task, stored in Firestore and Redis; dollar headline, each charity in its own currency |
| Finished-game line               | Maybe, not in v1                                                                                                                        |
| Milestone card                   | Revisit later                                                                                                                           |
| "I gave" button                  | Dropped                                                                                                                                 |

## Other charities considered

Board-game-specific charities are rare and mostly small. Checked on 2026-10-21 and 2026-10-26:

- **Extra Life** (Children's Miracle Network Hospitals, DonorDrive): keyless public API. Dropped in favour of Gamers Outreach.
- **Board Games for the Better** (New York, board games for people in hard times, Givebutter): the first pick, dropped because they could not be reached.
- **AbleGamers** (US, accessibility, Tiltify): rejected after the May 2025 IGN report of former employees' allegations of abuse and financial mismanagement against founder Mark Barlet, which he denies.
- **Child's Play** (games for children's hospitals): no API of its own; fundraisers run on Tiltify (tiltify.com/child-s-play). Clean record, but overlaps Gamers Outreach.
- **Take This** (mental health in the games industry, Tiltify or Streamlabs): furthest from the pitch.
- **Jack Vasel Memorial Fund** (hardship grants to gamers, EIN 45-1583593): PayPal button only, no totals.
- **Meeples for Peeples** (St. Louis, games for families and educators): Give Lively, which has no public API, only an iframe widget and member-side Zapier.
- **Board Game Buddies** (Chicago), **Board Game Blast** (Los Angeles), **The Bodhana Group** (York, PA): small, no machine-readable totals found.
- **Game to Grow** is winding down; excluded.
