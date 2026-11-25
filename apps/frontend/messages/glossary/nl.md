# Dutch (nl) glossary

For reviewers of `messages/nl.json` (the site and its push notifications) and
`libs/email/messages/nl.json` (emails, Discord and Telegram messages). Target: Dutch as read in
both the Netherlands and Flanders.

## 1. Form of address and tone

- **je / jij / jouw** throughout, never _u_. Dutch consumer apps and board-game communities
  (999 Games, BoardGameArena in Dutch, Discord, Steam) address players informally, and _je_ is
  the neutral informal form in both the Netherlands and Flanders (no _ge/gij_).
- Unstressed _je_ by default; _jij/jouw_ only where the English stresses the person
  ("Jouw beurt", "Bevestig dat jij het bent").
- Buttons and menu items are infinitives with the object first ("Spel bewerken", "Concept
  opslaan"). Calls to action that address the player are imperatives ("Schuif aan", "Speel je
  beurt", "Bevestig je plaats").
- No "alsjeblieft": "Please try again" is "Probeer het opnieuw."
- Headings and labels use sentence case ("Gekoppelde accounts"), not English title case.
- Where wording differs by region the neutral option was chosen ("chatten" not "kletsen",
  "groep" not "poule", "wedstrijd" not "match").
- Emails, bot messages and push notifications use the same _je_. Emails speak as _we_, the
  Discord and Telegram bots as _ik_ ("Ik stuur je hier een bericht").
- Email subjects drop the leading article and put the key word first ("Spel begonnen: {game}
  ({title})", "Inschrijving voor {league} sluit binnenkort").
- "If you did not …, you can …" is a question followed by "Dan …" ("Heb je dit niet aangevraagd?
  Dan kun je deze e-mail gerust negeren."). "Please contact us" is "Neem dan contact met ons op".

## 2. Terms

### Games and tables

| English                        | Dutch                            | Note                                                                                   |
| ------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------- |
| game (one play)                | spel, spellen                    | Also for plays (BG Stats, Stats tab). No "partij/potje". "Spelletje" only in slogans.  |
| title (a game in the library)  | titel                            | Kept apart from "spel", as in English. A series lists "6 spellen".                     |
| library / game shelf           | bibliotheek / spellenkast        |                                                                                        |
| series                         | serie                            |                                                                                        |
| table / open table             | tafel / open tafel               |                                                                                        |
| seat                           | plek                             | "Vrije plekken", "Plek 1". Never "plaats" (see place).                                 |
| place (rank, league place)     | plaats                           | "Gemiddelde plaats", "Je plaats in niveau B".                                          |
| host / owner                   | host                             | "by {name}" is "van {name}".                                                           |
| join / leave                   | meedoen / verlaten               | Status "joined" is "doet mee".                                                         |
| decline (invitation / vote)    | afslaan / afwijzen               |                                                                                        |
| enter / watch / revisit        | openen / bekijken / terugkijken  |                                                                                        |
| continue (a finished game)     | verder                           | Starts a continuation.                                                                 |
| turn / move                    | beurt / zet                      | "Your turn" is "Jouw beurt" or "je bent aan de beurt". "Last action" is "Laatste zet". |
| active player                  | aan de beurt                     |                                                                                        |
| pace                           | tempo                            | "{pace} pace" is "Tempo: {pace}".                                                      |
| Fast / Brisk (pace)            | Snel / Vlot                      | "Fast or faster" is "Snel of sneller".                                                 |
| Daily / Relaxed / Live (pace)  | Dagelijks / Rustig / Live        | Pace names are capitalized.                                                            |
| within 1 h / within a day      | binnen 1 uur / binnen een dag    | Chip: "Snel · 1 uur", "Rustig · 3 dagen".                                              |
| past the pace                  | trager dan het tempo             | "Trager dan het tempo van 1 uur", "Trager dan het Live-tempo".                         |
| in progress / current          | lopend                           |                                                                                        |
| finished / completed / history | afgelopen                        | One word for all three.                                                                |
| stalling / stalled             | valt stil / stilgevallen         |                                                                                        |
| abandoned                      | afgebroken                       |                                                                                        |
| call the game / called         | spel beëindigen / beëindigd      | Follows "asking to end the game".                                                      |
| concede / conceded             | opgeven / opgegeven              |                                                                                        |
| undo (to an earlier point)     | teruggaan naar een eerder moment | "Ongedaan maken" for the effect on moves and for "can't be undone".                    |
| request / agree / withdraw     | verzoek / akkoord / intrekken    |                                                                                        |
| follow / following / unfollow  | volgen / gevolgd / ontvolgen     |                                                                                        |
| hotseat, lobby                 | hotseat, lobby                   | Left as is.                                                                            |
| explorations                   | verkenningen                     |                                                                                        |
| draft                          | concept                          |                                                                                        |

### Tournaments and leagues

| English                          | Dutch                                         | Note                                                                  |
| -------------------------------- | --------------------------------------------- | --------------------------------------------------------------------- |
| tournament                       | toernooi                                      | "Minitoernooi", "Knock-outtoernooi", "Meerfasig toernooi".            |
| league                           | competitie                                    | "Laddercompetitie", "Piramidecompetitie".                             |
| competitions (umbrella)          | toernooien en competities                     | Because "competitie" is taken by league.                              |
| season / level / group           | seizoen / niveau / groep                      |                                                                       |
| ladder / pyramid                 | ladder / piramide                             |                                                                       |
| promoted / relegated, go up/down | gepromoveerd / gedegradeerd                   | Also for "go up / go down".                                           |
| seeding (season)                 | indeling, indelingsseizoen                    |                                                                       |
| sign-up, registration            | inschrijving, inschrijven                     | Withdraw a sign-up: "uitschrijven". Account sign-up is "registreren". |
| held (place)                     | gereserveerd                                  |                                                                       |
| roster                           | deelnemersveld, (aantal) deelnemers           |                                                                       |
| format                           | opzet                                         |                                                                       |
| stage / round                    | fase / ronde                                  |                                                                       |
| knockout / knocked out           | knock-out / uitgeschakeld                     | Status column: "Eruit in de kwartfinale".                             |
| match (knockout pairing)         | wedstrijd                                     | A "wedstrijd" consists of "spellen".                                  |
| decider                          | beslissingsspel                               | Bracket labels: S1, S2, B (for G1, G2, D).                            |
| split match                      | gelijke stand, gelijk eindigen                |                                                                       |
| bracket / schedule               | knock-outschema / speelschema                 |                                                                       |
| draw                             | loting                                        |                                                                       |
| bye / walkover                   | bye / walk-over                               |                                                                       |
| final / semi / quarter           | finale / halve finale / kwartfinale           |                                                                       |
| champion / runner-up             | kampioen / tweede plaats                      |                                                                       |
| ranking / standings              | rangschikking / stand                         |                                                                       |
| scoring                          | puntentelling                                 |                                                                       |
| tiebreak, TB                     | tiebreak, TB                                  |                                                                       |
| wins (column) / a win            | winst / overwinning                           |                                                                       |
| W / T / L                        | W / G / V                                     | winst, gelijk, verlies.                                               |
| Pts / Avg / Sub                  | Ptn / Gem. / Inv.                             |                                                                       |
| result / correction              | uitslag / correctie                           | "Resultaten" only in the stats strip.                                 |
| substitute / replace             | invaller / vervangen                          |                                                                       |
| withdraw (a player) / withdrawn  | terugtrekken / teruggetrokken                 |                                                                       |
| void                             | ongeldig                                      |                                                                       |
| scheduling                       | inplannen                                     |                                                                       |
| win rate / even odds / streak    | winstpercentage / gelijke kansen / winstreeks |                                                                       |

### Account and site

| English                               | Dutch                                    | Note                                                               |
| ------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| sign in / sign out / sign up          | inloggen / uitloggen / registreren       | Not "aanmelden".                                                   |
| username / password                   | gebruikersnaam / wachtwoord              |                                                                    |
| email (address)                       | e-mail, e-mailadres                      |                                                                    |
| verification code / token             | verificatiecode                          | English mixes "code" and "token"; Dutch uses "code".               |
| reset password / reset link           | wachtwoord opnieuw instellen / resetlink |                                                                    |
| link / unlink (account)               | koppelen / ontkoppelen                   |                                                                    |
| connect / disconnect (channel)        | verbinden / verbinding verbreken         |                                                                    |
| notifications                         | meldingen                                | The word browsers and phones use.                                  |
| reminder / reminder hours             | herinnering / herinneringsuren           |                                                                    |
| report (content) / bug report         | melden, melding / bugmelding             | Menu item is "Iets melden…".                                       |
| preferences / settings                | voorkeuren / instellingen                |                                                                    |
| administrator                         | beheerder                                |                                                                    |
| pay it forward                        | geef het door                            |                                                                    |
| charity                               | goed doel                                |                                                                    |
| Terms of Service / Privacy Policy     | gebruiksvoorwaarden / privacybeleid      |                                                                    |
| screenshot, webhook, bot, open source | unchanged                                | Discord's own Dutch terms: privéberichten, vermelden, Integraties. |

### Emails, notifications and bots

| English                           | Dutch                                             | Note                                                                        |
| --------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| dashboard                         | Mijn spellen                                      | The site never says "dashboard"; the button is "Mijn spellen openen".       |
| game of {title}, {title} game     | spel {title}, spel {game} ({title})               | Game name first, title in brackets. "Een spel 1830", so 1830 is not a time. |
| invited you (to play)             | nodigt je uit voor een spel                       | Present tense, inviter first.                                               |
| It's your turn / Take your turn   | Je bent aan de beurt / Speel je beurt             | Push title: "Jouw beurt!".                                                  |
| turn notifications                | beurtmeldingen                                    | "Beurtmeldingen aanzetten".                                                 |
| notifications page                | de pagina Meldingen                               | The site's menu label.                                                      |
| game started / ended              | spel begonnen / spel afgelopen                    |                                                                             |
| {names} won / tied                | Gewonnen door {names} / Gelijkspel tussen {names} | No verb, so one name or several both fit.                                   |
| takes / share first place         | pakt / delen de eerste plaats                     |                                                                             |
| finished 2nd                      | Je bent 2e geworden                               | Ordinal is "{place}e".                                                      |
| final standings / final results   | eindstand / einduitslag                           | A season's results are "uitslagen".                                         |
| Season 2 / Seeding season (names) | Seizoen 2 / Indelingsseizoen                      | Lower case inside a sentence: "seizoen 2 van {league}", "niveau B".         |
| move up / move down / stay        | promoveert / degradeert / blijft in niveau        |                                                                             |
| end the game early                | het spel voortijdig beëindigen                    | Menu item quoted as on the site: ‘Spel beëindigen’.                         |
| go back (undo vote)               | teruggaan naar een eerder moment                  | Push title only: "vraagt om terug te gaan".                                 |
| vote (button)                     | Stemmen                                           |                                                                             |
| safely ignore this email          | deze e-mail gerust negeren                        |                                                                             |
| message (bot) / I'll message you  | bericht / Ik stuur je hier een bericht            |                                                                             |
| /notify, /stop descriptions       | Meldingen … aanzetten / uitzetten                 | Under Discord's 100 characters.                                             |
| Connect (site button)             | Verbinden                                         | As on the notifications page.                                               |
| A Player / Someone / Nobody       | Een speler / Iemand, iemand / Niemand             | Stand-ins for a missing name; see Please review.                            |
| Unavailable account               | Account niet beschikbaar                          | As on the site.                                                             |
| bug-reports forum                 | het forum bug-reports                             | The Discord channel's name, left as is.                                     |

### Labels players see in English

Two labels reach players in English. They are quoted exactly as shown, in ‘…’, with a lower-case
Dutch gloss in brackets only where the sentence does not already explain the label.

| English                        | Dutch                                 | Note                                                                      |
| ------------------------------ | ------------------------------------- | ------------------------------------------------------------------------- |
| "Deleted player 1" (seat name) | ‘Deleted player’ (verwijderde speler) | Stored in English in the game data. Glossed once, in the account summary. |
| "Undo" (the game's button)     | ‘Undo’                                | Game screens are English. No gloss: the sentence says "ongedaan maken".   |

## 3. Typography and formatting

- Quotation marks: single ‘…’. Apostrophe: ’ ("zo’n", "pagina’s").
- Dash: spaced en dash " – ", also in page titles (English uses "—"). " · ", "→" and "←" kept.
- Ellipsis: "…", also where English has "...".
- Compounds with a name take a hyphen: "Discord-bot", "Telegram-meldingen", "BG Stats-app".
- Numbers: "uur" and "jaar" stay singular after a number, so `turn_reminders_after_hours`,
  `leagues_closes_in_hours`, `time_ago_years` and `library_series_show_more` are plain strings.
  `leagues_format_sign_up_automatic` and `leagues_format_sign_up_by_administrator` gained a
  plural ("1 dag" / "7 dagen").
- `{count: number}` for counts that can reach thousands (`played_game_count`,
  `dashboard_history_all_shown`, `content_stats_scope_option`, `content_stats_scope_summary`,
  `content_stats_best_score`): "1.234 spellen". `title_count` only counts the titles in a series,
  so it is a plain `{count}`.
- Unit spacing: "5 s", "5 min geleden", "2 uur geleden"; "h" is written out ("binnen 4 uur").
  Multiplication sign: "2× per dag".
- Unknown names never take an article or inflection; colon structures where needed
  ("Aan de beurt: {player}", "Statistieken: {name}", "Deelnemers: {roster}").
- Gender-neutral wording for players ("de invaller", "deze speler", "wie wordt teruggetrokken").
- Ordinals: "1e", "2e" (`email_ordinal` is the plain string "{place}e").
- Dates in emails arrive formatted ("vrijdag 27 november om 18:00 CET"); the sentence adds "op".
- Name lists arrive joined ("Alice, Bob en Carol"); the sentences around them avoid a verb that
  would have to be singular or plural.
- A player's quoted text: ‘{quote}’.

## 4. Please review

Layout-driven choices (short on purpose):

- `dashboard_tab_stats` — "Stats", not "Statistieken": four tabs must fit a 360 px phone.
- `dashboard_tab_history` — "Afgelopen" rather than "Geschiedenis" (shorter, and it lists finished games).
- `games_card_answer_request`, `library_entry_answer_request` — "Antwoorden"; "Verzoek
  beantwoorden" is too wide for the card's corner button. The tab title keeps the full form.
- `games_card_continue` — "Verder" (sits next to "Terugkijken" on a collapsed card).
- `turn_reminders_twice_daily`, `turn_reminders_daily` — "2× per dag", "1× per dag" for the three-way switch.
- `tournaments_wins`, `leagues_group_wins` — "Winst" (64 px column); "Overwinningen" or "Zeges" if there is room.
- `tournaments_knockout_out_in_semi_finals`, `tournaments_knockout_out_in_quarter_finals`,
  `tournaments_knockout_out_in_round` — "Eruit in …" (160 px column); "Uitgeschakeld in …" is
  the formal alternative.
- `content_stats_they_won` — "Ander won" for singular "They won".
- `leagues_group_points_abbr`, `leagues_group_average_place_abbr`, `leagues_group_substitute_abbr` — "Ptn", "Gem.", "Inv.".

Terms with competing usage:

- `nav_pay_it_forward`, `content_pif_heading`, `content_pif_pass_it_on`, `content_landing_small_print`
  — "Geef het door". "Pay it forward" is also used untranslated in Dutch; "Pass it on instead"
  became "Geef het liever door", so heading and sub-heading are close.
- `games_card_called`, `games_call_offer_call` — "Beëindigd" / "Spel beëindigen". Close to
  "Afgelopen" (Finished); alternatives "Gestaakt" or "Voortijdig beëindigd".
- `games_card_stalling`, `games_card_stalled`, `games_card_result_abandoned` — "Valt stil", "Stilgevallen", "Afgebroken".
- `pace_brisk_*`, `pace_relaxed_*`, `library_pace_brisk_or_faster` — "Vlot" for Brisk and "Rustig"
  for Relaxed, from "een vlot tempo" and "een rustig tempo"; alternatives "Vlug" and "Ontspannen".
- `pace_*_past_limit` — "Past the 1 h pace" became "Trager dan het tempo van 1 uur" (slower than
  the 1 h pace); the literal "Voorbij het tempo van 1 uur" is the alternative.
- `played_game_count`, `title_count` — both read "… spellen": "spel" is the word for a play and for
  a game in a series. "Partij" for plays would set them apart, but nothing else on the site uses it.
- `tournaments_heading_leagues` and all league text — "competitie"; the umbrella
  `tournaments_heading_label` became "Toernooien en competities".
- `tournaments_knockout_round_match`, `tournaments_bracket_your_match`,
  `tournaments_detail_games_per_match`, `tournaments_form_knockout_help` — match is
  "wedstrijd"; "match" or "duel" are alternatives.
- `tournaments_knockout_game_label`, `tournaments_knockout_decider_label`, `tournaments_bracket_legend`
  — S1/S2/B, and "één vanaf elke kant" for "one from each side".
- `leagues_season_name_seeding`, `leagues_sign_up_seeding_explanation` — seeding is "Indeling"
  rather than "Plaatsing", to stay clear of "plaats".
- `tournaments_correction_heading`, `tournaments_correction_winners_legend` — "Correct
  tournament credit" became "Toernooiuitslag corrigeren"; credited winners are "toegekende winnaars".
- `games_vote_undo_request`, `games_vote_confirm_undo`, `games_vote_ask_to_undo` — undo to a
  point is "teruggaan naar een eerder moment / tot hier".
- `nav_report`, `games_report_sent` — "Iets melden…" and "melding", next to "Meldingen" for notifications.
- `library_maturity_alpha`, `library_maturity_beta`, `nav_game_heading_alpha`, `nav_game_heading_beta` — "Alfa", "Bèta".
- `tournaments_format_multi_stage` — "Meerfasig".
- `content_landing_take_a_seat`, `content_landing_welcome` — "Schuif aan", "Zin in een spelletje?".
- `content_pif_gamers_outreach_purpose`, `content_pif_special_effect_purpose` — "Spelplezier voor …" for "Play for …".
- `tournaments_schedule_waiting_capacity`, `tournaments_schedule_repeated_groups` — "Wacht tot
  spelers ruimte hebben", "Herhaalde tafelindelingen".

Emails, notifications and bots:

- `email_ordinal` — "1e", "2e"; Flemish readers may prefer "1ste", "2de".
- `email_game_end_result_won`, `email_game_end_result_draw` — "Gewonnen door {names}!" and
  "Gelijkspel tussen {names}" instead of a verb; the draw line assumes at least two names.
- `email_game_invitation_subject`, `email_game_invitation_preview` — "Join {owner}'s game of
  {title}" became "{owner} nodigt je uit voor een spel {title}".
- `email_game_invitation_unnamed_owner`, `email_game_end_no_winner_names` — "Iemand" has a capital
  because it starts the subject and heading; "iemand" is lower case because it follows "door" and
  "tussen". English has them the other way round.
- `email_unnamed_player`, `email_player_removed_unnamed_player` — "Een speler" keeps its capital
  as a stand-in name, also inside a list of names.
- `email_league_season_results_subject`, `email_league_season_results_preview`,
  `email_league_season_name_seeding` — "Uitslagen {league} – {season}". The seeding season is the
  bare label "Indelingsseizoen", so its preview reads "Indelingsseizoen van {league} is afgelopen."
- `email_account_email_change_requested_preview`, `email_account_password_reset_requested_preview`
  — the time moved to the front ("Op {time} is gevraagd …"): it is when the request was made.
- `email_account_deleted_subline` — "als verwijderde speler" describes the seat name, as the
  English does; the site quotes the label ‘Deleted player’.
- `email_account_password_reset_requested_detail` — "Wachtwoordreset aangevraagd".
- `email_standings_column_average_place` — "Gem. plaats" in a 64 px column (English "Avg place").
- `notification_open_dashboard_button` — "Mijn spellen openen".
- `notification_undo_vote_heading`, `push_undo_vote_title` — the heading keeps "naar een eerder
  moment"; the push title drops it for length.
- `push_your_turn_title`, `push_player_declined_title` — "Jouw beurt!" and "Uitnodiging
  afgeslagen" (for "Player declined").
- `telegram_stopped`, `discord_install_welcome` — "Geregeld." for "Done.", "Alles is ingesteld!"
  for "You're all set!".
- `email_bug_report_forum` — "Kom even hallo zeggen" for "Come say hi".

Depends on text outside these files:

- `delete_account_summary`, `delete_account_kept_finished` — quote the seat name "Deleted player 1"
  in English, as the game data stores it; the summary adds "(verwijderde speler)", the dialog's
  list item does not repeat it. `games_vote_undo_yourself` quotes the game's own "Undo" button,
  which is English in the game UIs. All three become translatable once the game data and the game
  screens are translated ("Verwijderde speler 1" was the earlier wording); until then a Dutch
  label would point players at text they cannot find.
- `telegram_offer` — "Starten" is assumed to be Telegram's Dutch label for the bot's Start button.
- `leagues_detail_page_title`, `tournaments_detail_page_title`, `leagues_page_title`,
  `tournaments_page_title`, `leagues_detail_page_title_loading` — "· Tabletop" kept as in English.
- `games_report_owner_anonymous` — "owner" rendered as "host", the word used elsewhere for the same person.
- `auth_email_placeholder` — "naam@example.com".
- `email_player_removed_end_early_detail` — quotes the site's menu item `games_call_offer_call`
  ("Spel beëindigen"). `telegram_not_linked` and `telegram_stopped` name the site's button
  `discord_webhook_connect` ("Verbinden"), `email_game_started_footer` the page `nav_notifications`
  ("Meldingen"), and `notification_open_dashboard_button` the page `nav_my_games` ("Mijn spellen").
- `email_standings_placement_scoring`, `email_standings_tiebreak_points_behind`,
  `email_standings_tiebreak_share_of_winner`, `email_standings_tiebreak_score_sum` — copies of
  `tournaments_placement_scoring` and `tournaments_tiebreak_*`; `email_league_unavailable_account`
  copies `auth_unavailable_account`. Change them together.
- `email_game_started_warning_body`, `email_game_started_turns_set_up` — name the browser and
  Discord only, as the English does, although the site also offers Telegram.
