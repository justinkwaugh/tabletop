# Danish (`da`) glossary

For the native speaker reviewing `messages/da.json` (the site and its push notifications) and `libs/email/messages/da.json` (emails, Discord and Telegram).

## 1. Form of address and tone

- **`du` throughout**, lower case (`du`, `dig`, `din`). Danish consumer apps and gaming communities never use `De`.
- Plain, friendly and short, like the English. No `venligst`: "Please try again" is just `Prøv igen.`
- Buttons and menu items are imperatives (`Gem`, `Slet`, `Deltag`, `Tilmeld dig`); headings and labels are in sentence case, never title case.
- Failures are stated from the thing's side, not the user's: `Ligaen kunne ikke indlæses`, `Linket kunne ikke kopieres.`
- Emails, Discord and Telegram messages and push notifications go to one player and use the same `du`. The bots speak as `jeg` (`Jeg skriver til dig her`), emails as `vi` (`Vi giver dig besked`, `Kontakt os`).
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

### Emails, notifications and bots

| English                                      | Danish                                                    | Note                                                    |
| -------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| verification code / verify, confirm          | bekræftelseskode / bekræft                                | One verb for both                                       |
| reset your password                          | nulstil din adgangskode                                   |                                                         |
| a request was made to … / … requested        | der er blevet bedt om at … / anmodning om …               | Verb `bede om`, noun `anmodning`, as on the site        |
| you can safely ignore this email             | kan du roligt se bort fra denne e-mail                    |                                                         |
| please contact us                            | kontakt os                                                | No `venligst`                                           |
| game started / has ended                     | spillet er startet / spillet er afsluttet                 | Subjects: `Spillet er startet: {game} ({title})`        |
| your {title} game {game} / a game of {title} | dit spil {game} ({title}) / et spil {title}               | Title in parentheses or in apposition, never a compound |
| ended in a draw / tied / abandoned           | endte uafgjort / spillede uafgjort / afbrudt              |                                                         |
| the game will stop on their turn             | det går i stå, når det bliver spillerens tur              | Site term `går i stå`; singular "they" is `spilleren`   |
| end the game early / Call the game (menu)    | afslut spillet før tid / ”Afslut spillet før tid”         | The site's label, quoted; see review note 26            |
| 1st, 2nd, 3rd (you finished 3rd)             | nummer 1, nummer 2, nummer 3 (`Du sluttede som nummer 3`) | `email_ordinal`; see review note 21                     |
| takes / share first place                    | tager / deler førstepladsen                               |                                                         |
| final standings / final results              | slutstilling / endelige resultater                        |                                                         |
| place is held / held for you                 | plads er reserveret / reserveret til dig                  |                                                         |
| move up / move down / stay in (a level)      | rykker op til / rykker ned til / bliver på                |                                                         |
| seeding season                               | seedningssæson                                            |                                                         |
| turn notifications                           | notifikationer om din tur                                 | As the heading on the notifications page                |
| tells you / you won't hear                   | giver dig besked / du får ikke besked                     |                                                         |
| dashboard                                    | Mine spil                                                 | The page's name on the site: `Åbn Mine spil`            |
| invited you to play                          | har inviteret dig til et spil                             |                                                         |
| joined / declined to join                    | deltager nu i / har afslået at deltage i                  |                                                         |
| asks to end / asks to go back (votes)        | beder om at afslutte / beder om at fortryde træk          | See review note 23                                      |
| vote / view invitation                       | stem / se invitationen                                    |                                                         |
| {player}'s seat / take over a seat           | pladsen efter {player} / overtage pladsen                 | No genitive on a name                                   |
| I'll message you here (bot)                  | jeg skriver til dig her                                   |                                                         |
| type /stop (Discord) / send /stop (Telegram) | skriv /stop / send /stop                                  |                                                         |
| press Connect                                | tryk på Tilslut                                           | The site's button, capitalised and unquoted             |
| post notifications (webhook)                 | slå notifikationer op                                     |                                                         |
| bug report / the bug-reports forum           | fejlrapport / forummet bug-reports                        | The Discord forum's own name is kept                    |

Kept untranslated: BoardTogether, Board Together, Tabletop (in page titles), game and series names, Discord, Telegram, Google, GitHub, BG Stats, Tiltify, Gamers Outreach, SpecialEffect, `/stop`, `/notify`, `/start`, the Discord forum name `bug-reports`, URLs, open source, webhook, bot, lobby.

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
- Email dates arrive with their time and time zone, and no time-zone word is added. A timestamp arrives as `25. november 2026 kl. 16.30 CET` and is introduced with `den`; a league deadline arrives as `onsdag 25. november kl. 16.30 CET` and is used as it is (`før tilmeldingen lukker {closes}`).
- Email subjects put the news first: `Spillet er startet: {game} ({title})`, `Resultater fra {season} i {league}`. Labels after `·` are capitalised (`{title} · Sæson {season}`); inside a sentence it is `sæson 2`, `niveau B`, `gruppe B1`.
- Stand-in names sit where a name would. `Nogen` and `En spiller` are capitalised because every Danish sentence that uses them starts with them; `de andre spillere` and `din gruppe` follow a preposition and are lower case.
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

Emails, notifications and bots (`libs/email/messages/da.json`, and the `push_*` keys here):

21. `email_ordinal` — "3rd" is `nummer 3`, read inside `Du sluttede som {place} …`. The numeral forms `3.` or `3.-pladsen` are the alternatives.
22. `email_league_season_name`, `email_league_season_name_seeding` — lower case (`sæson 2`, `seedningssæsonen`) because the name lands mid-sentence in the subject and preview. `email_league_season_results_eyebrow` is therefore `Slut på {season}`, not `{season} er afsluttet`, so that the text-only email does not start a line in lower case.
23. `notification_undo_vote_summary`, `notification_undo_vote_heading`, `push_undo_vote_title` — "asks to go back" is `beder om at fortryde træk`, after the site's `fortryd`. A literal `gå tilbage` could be read as returning to the game.
24. `email_game_invitation_unnamed_owner` — `Nogen`, capitalised, because the subject, preview and heading all start with the host's name (`{owner} har inviteret dig til et spil {title}`). English has `someone` mid-sentence.
25. `email_player_removed_subline_left`, `email_player_removed_subline_removed` — "on their turn … for them" became `når det bliver spillerens tur, fordi ingen andre kan tage den`.
26. `email_player_removed_end_early_detail` — the menu label is quoted, `”Afslut spillet før tid”`, because unquoted it runs into the sentence (`… før tid i kontomenuen`). It must follow `games_call_offer_call` if that label changes (review note 1).
27. `email_account_email_change_requested_preview` — `{time}` is when the request was made, so it stands with the request (`Der blev bedt om … den {time}; …`), not at the end as in English.
28. `notification_open_dashboard_button` — `Åbn Mine spil`, the name the page has on the site, for "Open dashboard".
29. `email_game_end_subject` — rebuilt as `Spillet er afsluttet: {game} ({title})` to match `email_game_started_subject`; a literal "Dit spil {title} {game}" runs the two names together.
30. `email_unnamed_player` — `En spiller` keeps its capital as a stand-in name, also inside a list (`Alice og En spiller vandt!`) and in a standings row.
31. `push_player_joined_title` (`En spiller er med!`), `push_took_over_seat_title` (`Du er kommet med i et igangværende spil`) — short titles; check they read naturally on a phone.
32. `email_bug_report_forum` — keeps the forum's name, `forummet bug-reports`, so players can find it on the server, and splits the English semicolon sentence in two.
