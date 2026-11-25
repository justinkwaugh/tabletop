# Danish (`da`) glossary

For the native speaker reviewing `messages/da.json`.

## 1. Form of address and tone

- **`du` throughout**, lower case (`du`, `dig`, `din`). Danish consumer apps and gaming communities never use `De`.
- Plain, friendly and short, like the English. No `venligst`: "Please try again" is just `Prøv igen.`
- Buttons and menu items are imperatives (`Gem`, `Slet`, `Deltag`, `Tilmeld dig`); headings and labels are in sentence case, never title case.
- Failures are stated from the thing's side, not the user's: `Ligaen kunne ikke indlæses`, `Linket kunne ikke kopieres.`
- Sentences never need a name inflected. Where English has `{name}'s …` the Danish is rephrased (`De uafsluttede spil, som {name} deltager i, …`), and labels that may receive "Dig", a name or "Flere spillere" use a colon (`Tur: {player}`).

## 2. Terms

### Playing

| English                                   | Danish                                     | Note                                                               |
| ----------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| game (a table being played)               | spil                                       | `title_count` (titles) and `played_game_count` are both `N spil`   |
| title (a game in the library)             | titel                                      | Kept apart from `spil` where English says "title": `Vælg en titel` |
| library / game shelf                      | bibliotek / spilhylde                      |                                                                    |
| table / open table                        | bord / åbent bord                          |                                                                    |
| seat / open seat                          | plads / ledig plads                        |                                                                    |
| host, owner                               | vært                                       | English uses both words for the same role                          |
| turn / your turn / take your turn         | tur / din tur / tag din tur                |                                                                    |
| move / last action                        | træk / seneste træk                        | "Last action" is the time of the last move                         |
| join / leave (a game)                     | deltag / forlad                            | Status "joined": `deltager`                                        |
| enter / play game / watch / revisit       | åbn / åbn spillet / se med / gense         |                                                                    |
| follow / unfollow / following             | følg / følg ikke længere / følger          |                                                                    |
| pace                                      | tempo                                      |                                                                    |
| Live, Fast, Brisk, Daily, Relaxed (paces) | Live, Hurtigt, Raskt, Dagligt, Afslappet   | Neuter forms, agreeing with `tempo`; see review note 15            |
| within 1 h / within a day (pace)          | inden for 1 t. / inden for en dag          | Hours abbreviated as in `for 3 t. siden`, days written out         |
| past the 1 h pace                         | langsommere end tempoet på 1 t.            | `Langsommere end Live-tempoet` for Live; see review note 15        |
| hotseat / mode                            | Hotseat / tilstand                         | Loanword kept                                                      |
| game options / standard                   | spilindstillinger / standard               | Column header: `Indstillinger`                                     |
| score (column) / best score / final score | point / bedste score / slutscore           |                                                                    |
| winner / tied / no winner                 | vinder / uafgjort / ingen vinder           |                                                                    |
| undo / ask to undo                        | fortryd / bed om at fortryde               | The game's own button is quoted as `”Undo”`; see review note 16    |
| agree / decline / withdraw (a request)    | accepter / afslå / træk tilbage            |                                                                    |
| concede / conceded                        | giv op / opgivet                           |                                                                    |
| call the game / called                    | afslut spillet før tid / afsluttet før tid | See review note 1                                                  |
| stalling / stalled / abandoned            | går i stå / gået i stå / afbrudt           |                                                                    |
| explorations                              | udforskninger                              | See review note 9                                                  |

### Tournaments and leagues

| English                                 | Danish                                    | Note                                                                          |
| --------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------- |
| competitions / tournament / league      | konkurrencer / turnering / liga           |                                                                               |
| registration, sign-up                   | tilmelding                                | One word for both; "sign up" / "join tournament": `tilmeld dig (turneringen)` |
| withdraw (own sign-up), leave           | meld fra                                  |                                                                               |
| withdraw a player / withdrawn / dropped | træk ud / udgået / udgår                  |                                                                               |
| substitute                              | afløser (abbr. `Afl.`)                    | Verb: `udskift`                                                               |
| roster / roster size                    | deltagerliste / deltagerantal             |                                                                               |
| draft                                   | kladde                                    |                                                                               |
| schedule / scheduling                   | spilleplan / planlægning                  |                                                                               |
| draw                                    | lodtrækning                               |                                                                               |
| round / match / game (in a match)       | runde / kamp / spil                       |                                                                               |
| knockout / mini / multi-stage           | knockout / mini / flere faser             |                                                                               |
| bracket                                 | turneringstræ                             | See review note 3                                                             |
| bye / walkover                          | oversidder / walkover                     |                                                                               |
| decider                                 | afgørende spil                            | Labels `S1`, `S2`, `A` for G1, G2, D                                          |
| final / semi-final / quarter-final      | finale / semifinale / kvartfinale         |                                                                               |
| champion / runner-up / out in …         | vinder / nummer to / ude i …              |                                                                               |
| standings / ranking                     | stilling / rangering                      |                                                                               |
| place (rank) / average place            | placering / gennemsnitlig placering       | Abbr. `Gns.`, `Gns. plac.`                                                    |
| place (a held league place)             | plads                                     | `reserveret` for "held"                                                       |
| tiebreak / tied players                 | tiebreak (`TB`) / spillere, der står lige |                                                                               |
| scoring                                 | pointgivning                              |                                                                               |
| season / level / group                  | sæson / niveau / gruppe                   |                                                                               |
| seeding / seeds the league              | seedning / bruges til at seede ligaen     |                                                                               |
| ladder / pyramid                        | stige / pyramide                          | `Stigeliga`, `Pyramideliga`                                                   |
| promoted / relegated                    | oprykket / nedrykket                      | Verbs: `rykker op`, `rykker ned`                                              |
| void                                    | annulleret                                |                                                                               |
| W / T / L, Pts, Avg                     | V / U / T, P, Gns.                        | From Danish league tables                                                     |
| win rate / even odds / win streak       | sejrsprocent / lige chancer / sejrsstime  |                                                                               |

### Site and account

| English                                | Danish                                              | Note                                          |
| -------------------------------------- | --------------------------------------------------- | --------------------------------------------- |
| sign in / sign out / sign up (account) | log ind / log ud / opret konto                      | Noun: `login`                                 |
| username / password / email            | brugernavn / adgangskode / e-mail(adresse)          |                                               |
| Preferences                            | Indstillinger                                       |                                               |
| notifications / reminders              | notifikationer / påmindelser                        | `Påmindelsestimer` for Reminder Hours         |
| link / unlink (an account)             | tilknyt / fjern tilknytning                         |                                               |
| connect / disconnect (a channel)       | tilslut / frakobl                                   |                                               |
| report (content) / report a bug        | anmeld, anmeldelse / rapportér en fejl, fejlrapport | Two verbs keep the two flows apart            |
| pay it forward                         | giv det videre                                      | The Danish title of the film "Pay It Forward" |
| charity                                | velgørende organisation                             |                                               |
| Terms of Service / Privacy Policy      | Servicevilkår / Privatlivspolitik                   |                                               |
| My Games / History / Stats             | Mine spil / Historik / Statistik                    |                                               |

Kept untranslated: BoardTogether, Board Together, Tabletop (in page titles), game and series names, Discord, Telegram, Google, GitHub, BG Stats, Tiltify, Gamers Outreach, SpecialEffect, `/stop`, `/notify`, URLs, open source, webhook, bot, lobby.

Quoted in English, inside `”…”`, because that is exactly what players see on the site: the name `”Deleted player 1”`, `”Deleted player 2”`, … that a deleted account's seats get in finished games (it is stored in the game data), and the `”Undo”` button on the game screens (not translated yet). A Danish name would point players at a label they cannot find. `delete_account_summary` adds the gloss `(slettet spiller)`; `delete_account_kept_finished`, in the dialog opened from that same card, quotes the name alone; `games_vote_undo_yourself` says `knappen ”Undo”`, since `fortryde` earlier in the sentence already explains it. See review note 16.

## 3. Typography and formatting

- Quotation marks: `”…”` (both marks U+201D).
- Dashes: an en dash with spaces (`Mine spil – Board Together`) wherever English has an em dash. UI separators `·`, `→`, `←` are unchanged.
- Ellipsis: the single character `…`, no space before it (`Indlæser…`). English `...` became `…`.
- Commas: the traditional comma before subordinate clauses (startkomma), used consistently.
- A full sentence after a colon starts with a capital (`Spil i gang: De andre spillere …`).
- Compounds are written together (`spilindstillinger`, `turneringsvinder`); a hyphen joins a name or abbreviation (`Discord-konto`, `Webhook-URL`, `open source-sted`).
- Imperatives of `-ere` verbs take an accent only where the plain form is also a noun: `Kopiér`, `Rapportér`, but `Rediger`, `Annuller`, `Accepter`, `Inviter`. `Én`/`ét` carry an accent as numerals.
- Numbers: `{count: number}` gives `1.234` where a count can reach the thousands (games played, opponents, season totals). Percentages, dates and times arrive already formatted for Danish (`42 %`, `25. nov.`, `14.30`, `november 2026`); times are introduced with `kl.` and dates with `den` where a sentence needs it. A date that arrives together with its time (`25. nov., 14.00`) is used as it is.
- Abbreviations: `pr.`, `gns.`, `min.`, `t.` (hours), `sek.`
- Plurals: Danish has `one` and `other`. `spil`, `tegn` and `år` do not inflect, so those messages are plain strings. A plural was added where English needed none: `{count} åbent/åbne`, `tilmeldt/tilmeldte`, `{days} dags/dages tilmelding`.

## 4. Please review

1. `games_call_offer_call`, `games_card_called` — "call the game" has no set Danish term. Used `Afslut spillet før tid` / `Afsluttet før tid`; `Stop spillet` / `Stoppet` would be shorter.
2. `games_card_result_abandoned` (`Afbrudt`) against `games_card_conceded` (`Opgivet`) — check the two read as different outcomes.
3. `tournaments_bracket_heading`, `tournaments_bracket_whole`, `tournaments_bracket_load_failed` — `Turneringstræ`. I could not confirm how common it is; e-sport players say `bracket`.
4. `tournaments_bracket_bye` — `Oversidder` stands in the empty opponent slot, as in chess pairings. `Fri` is the alternative.
5. `tournaments_knockout_decider*`, `tournaments_form_decider`, `tournaments_bracket_legend` — `Afgørende spil` with the letter `A`; `Omkamp` is the alternative.
6. `leagues_group_substitute*`, `tournaments_replace_substitute*`, `tournaments_detail_substitute_for*` — `Afløser`; `Reserve` or `Stedfortræder` are alternatives.
7. `leagues_sign_up_withdraw`, `tournaments_detail_leave` (`Meld fra`), `tournaments_detail_withdrawn` (`Udgået`), `tournaments_replace_withdraw*` (`Træk ud`) — English "withdraw" is split three ways by situation.
8. `tournaments_correction_heading`, `tournaments_correction_winners_intro`, `tournaments_correction_winners_legend` — "credit / credited winners" is paraphrased as winners that count in the tournament.
9. `games_card_explorations_heading` — `UDFORSKNINGER` is literal; I could not see the feature in use.
10. `auth_challenge_expiry` — follows both a code (common gender) and a link (neuter), so it avoids a pronoun: `kun det senest tilsendte virker`.
11. `content_stats_they_won` — `De vandt` for singular "they" (the opponent) in a narrow column header.
12. `content_landing_small_print` — "No tip jar" became `Vi tager ikke imod drikkepenge`.
13. `content_pif_pass_it_on` — `Send det videre i stedet.`, to differ from the heading `Giv det videre.`
14. `leagues_group_wins_abbr` (`V`, tooltip `Vundne spil`), `leagues_group_points_abbr` (`P`), `content_stats_outcome_letter_*` (`V`/`U`/`T`) — letters from Danish league tables. `tournaments_wins` spells the word out as `Sejre`.
15. `pace_*_past_limit` — "Past the 1 h pace" is `Langsommere end tempoet på 1 t.` (slower than the pace); `Over tempoet på 1 t.` is closer to the English and shorter. `pace_relaxed_name` — `Afslappet`; `Roligt` is the shorter alternative. The pace list in the create-game form is still English, like the rest of that form.
16. `delete_account_summary`, `delete_account_kept_finished`, `games_vote_undo_yourself` — quote the labels `”Deleted player”` and `”Undo”` in English, as players see them: the seat name is stored in the game data, and the game screens are not translated yet. They become translatable once the game data and the game screens are translated: `”Slettet spiller”` without the gloss, and `Fortryd`. Until then, check that the gloss `(slettet spiller)` and `knappen ”Undo”` read naturally.
17. `turn_reminders_twice_daily`, `turn_reminders_daily` — `2 om dagen`, `1 om dagen`: kept short because the three choices share one row.
18. `content_pif_us_charity`, `content_pif_uk_charity` — `Velgørenhed i USA` / `i UK`: short for the chip beside the logo.
19. `tournaments_schedule_*` — `Spilleplan` for the schedule; board gamers also use the word for a game board. `Turneringsplan` is the alternative.
20. `auth_invitation_heading` — the English `?...` is dropped: `Vil du deltage i dette spil?`
