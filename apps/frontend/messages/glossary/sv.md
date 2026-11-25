# Swedish (sv) — translation glossary

For the native-speaker reviewer of `messages/sv.json` (the site and its push notifications) and of
`libs/email/messages/sv.json` (emails, Discord and Telegram messages).

## 1. Form of address and tone

- **du**, lower case, everywhere. It is what every Swedish consumer app and gaming community uses;
  "ni" would read as stiff or as addressing a group.
- Friendly, plain and short. English "Please try again." is just **"Försök igen."** — "vänligen" is
  never used. Errors follow two patterns: "Det gick inte att …" and "X kunde inte laddas/sparas".
- "We" (the project) is **vi**: "Vi kunde inte skicka koden."
- Colloquial but accepted words are used where a native community site would use them: _sajten_,
  _mejla/mejl_, _bugg_, _snacka_, _pingar_.
- Emails, bot messages and push notifications use the same **du** and the same tone. Emails have no
  salutation and no sign-off, as in English, and "please contact us" is just **"Kontakta oss …"**.
- The Discord and Telegram bots speak in the first person, **jag**, as they do in English: "Jag
  skriver till dig här när det är din tur."
- A notification tells what has just happened in the perfect tense ("{player} har gått med i ditt
  parti", "{owner} har bjudit in dig till ett parti"). A request is **vill**, as in the game's own
  banner ("{player} vill avsluta {game}").

## 2. Terms

The one decision that shapes everything else: English "game" is two things, and Swedish has a
word for each.

| English                                            | Swedish                                                                                 | Note                                                                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| game (one played game, a table)                    | **parti** (ett parti, partiet, partier)                                                 | "Mina partier", "Starta ett parti", "Ska vi ta ett parti?"; counted by `played_game_count`: "1 parti", "12 partier" |
| game, title (the published game)                   | **spel**                                                                                | "Välj ett spel", "Alla spel", "Dina partier av det här spelet"; counted by `title_count`: "12 spel"                 |
| board game                                         | brädspel                                                                                |                                                                                                                     |
| library / shelf / series                           | bibliotek, spelbibliotek / spelhylla / serie                                            |                                                                                                                     |
| table / open table                                 | bord / öppet bord                                                                       |                                                                                                                     |
| seat / open seat                                   | plats / ledig plats                                                                     | league "place" (a spot) is also _plats_; a rank is _placering_                                                      |
| host, owner                                        | värd                                                                                    | one word for both                                                                                                   |
| player / opponent                                  | spelare / motståndare                                                                   |                                                                                                                     |
| turn / your turn / take your turn                  | tur / din tur / gör ditt drag                                                           |                                                                                                                     |
| move / active player                               | drag / i tur                                                                            | "I tur: {player}"                                                                                                   |
| pace                                               | tempo                                                                                   |                                                                                                                     |
| Live / Fast / Brisk / Daily / Relaxed (the paces)  | **Live / Snabbt / Raskt / Dagligt / Lugnt**                                             | neuter, agreeing with _tempo_ ("raskt tempo", "lugnt tempo"); "Daily or faster" → "Dagligt eller snabbare"          |
| within 1 h / within a day / within 3 days (a pace) | inom 1 tim / inom en dag / inom 3 dagar                                                 | chip: "Snabbt · 1 tim", "Lugnt · 3 dagar"                                                                           |
| past the 1 h pace / past the Live pace             | långsammare än tempot på 1 tim / långsammare än Live-tempot                             | also "på 4 tim", "på 1 dag", "på 3 dagar"                                                                           |
| hotseat                                            | hotseat                                                                                 | loanword kept                                                                                                       |
| join / leave (a game)                              | gå med / lämna                                                                          | status "joined" → _deltar_                                                                                          |
| decline (an invitation)                            | tacka nej                                                                               |                                                                                                                     |
| enter / watch / revisit                            | gå in / titta / se igen                                                                 |                                                                                                                     |
| follow / following / unfollow                      | följ / följer / sluta följa                                                             |                                                                                                                     |
| undo / request                                     | ångra / förfrågan                                                                       | the game's own button is quoted in English for now: knappen ”Undo”                                                  |
| agree / decline (a vote)                           | godkänn / avböj                                                                         | withdraw a request → _dra tillbaka_                                                                                 |
| concede / conceded                                 | ge upp / uppgivet                                                                       |                                                                                                                     |
| call the game / called                             | **bryt partiet / brutet**                                                               | as in "domaren bröt matchen"                                                                                        |
| stalling / stalled / abandoned                     | står still / avstannat / avbrutet                                                       |                                                                                                                     |
| tied / no winner                                   | oavgjort / ingen vinnare                                                                |                                                                                                                     |
| finished                                           | avslutat (parti), avslutad (turnering, säsong), avslutade (plural)                      | agrees with what it describes                                                                                       |
| in progress                                        | pågår (status), pågående (before a noun)                                                |                                                                                                                     |
| score, points / final score                        | poäng / slutpoäng                                                                       |                                                                                                                     |
| wins / W-T-L                                       | vinster / V-O-F                                                                         |                                                                                                                     |
| win rate / win streak                              | vinstandel / vinstsvit                                                                  |                                                                                                                     |
| average place, average finish                      | snittplacering                                                                          | abbr. _Snitt_, _Snittplac._                                                                                         |
| even odds                                          | lika chanser                                                                            |                                                                                                                     |
| competition / tournament / league                  | tävling / turnering / liga                                                              |                                                                                                                     |
| season / level / group                             | säsong / nivå / grupp                                                                   |                                                                                                                     |
| mini / knockout / multi-stage                      | mini, miniturnering / **utslagning, utslagsturnering** / flera steg, flerstegsturnering |                                                                                                                     |
| registration, sign-up (competitions)               | **anmälan**                                                                             | one word for both English terms                                                                                     |
| join tournament, sign up / leave, withdraw         | anmäl dig / avanmäl dig                                                                 |                                                                                                                     |
| registration full                                  | fulltecknad                                                                             |                                                                                                                     |
| roster                                             | startfält; _antal spelare_ for sizes                                                    | "{roster} joined" → "Anmälda: {roster}"                                                                             |
| round / match / game in a match                    | omgång / match / parti (P1, P2)                                                         |                                                                                                                     |
| decider                                            | **skiljeparti** (S)                                                                     |                                                                                                                     |
| bracket / bye / walkover                           | **turneringsträd** / **frirond** / walkover                                             | forfeit → _lämna walkover_                                                                                          |
| final / semi-finals / quarter-finals               | final / semifinal(er) / kvartsfinal(er)                                                 |                                                                                                                     |
| champion / runner-up / knocked out                 | mästare / tvåa / utslagen                                                               |                                                                                                                     |
| draw / schedule / scheduling                       | lottning / spelschema / schemaläggning                                                  |                                                                                                                     |
| standings / ranking                                | ställning / rangordning                                                                 |                                                                                                                     |
| tiebreak                                           | **särskiljning** (abbr. _Särsk._)                                                       | the chess-federation term                                                                                           |
| seeding                                            | seedning                                                                                | "Säsong 0 seedar ligan"                                                                                             |
| ladder / pyramid                                   | stege / pyramid                                                                         |                                                                                                                     |
| promoted / relegated                               | uppflyttad / nedflyttad                                                                 | go up / down → _flyttas upp / ner_                                                                                  |
| place held / returning player                      | reserverad plats / återkommande spelare                                                 |                                                                                                                     |
| substitute                                         | ersättare (abbr. _Ers._)                                                                |                                                                                                                     |
| withdraw a player (admin) / withdrawn              | **stryka / struken**                                                                    | "dropped" (replaced) → _utgår_                                                                                      |
| void / correction                                  | ogiltigt / rättelse                                                                     |                                                                                                                     |
| draft / manage                                     | utkast / hantera                                                                        |                                                                                                                     |
| cancel a tournament or season                      | ställa in (inställd)                                                                    | the Cancel button is _Avbryt_                                                                                       |
| notifications / reminder                           | aviseringar / påminnelse                                                                | "Reminder Hours" → _Tider för påminnelser_                                                                          |
| preferences, settings                              | inställningar                                                                           |                                                                                                                     |
| sign in / sign out / sign up (account)             | logga in / logga ut / skapa konto                                                       | never _anmäl dig_, which is for competitions                                                                        |
| link / unlink (an account)                         | länka / koppla bort                                                                     |                                                                                                                     |
| connect / disconnect (bot, webhook)                | anslut / koppla från                                                                    |                                                                                                                     |
| email                                              | e-post (noun), mejl / mejla (a message, the verb)                                       |                                                                                                                     |
| report (content) / bug report                      | rapportera / buggrapport                                                                | not _anmäl_, to keep it apart from _anmälan_                                                                        |
| pay it forward                                     | **ge vidare**                                                                           |                                                                                                                     |
| charity                                            | välgörenhetsorganisation; short: välgörenhet, organisation                              |                                                                                                                     |
| tip jar / open source / free to play               | dricksburk / öppen källkod / gratis att spela                                           |                                                                                                                     |
| bot / webhook / direct message                     | bot (boten) / webhook / direktmeddelande                                                |                                                                                                                     |

Kept as they are: Board Together / BoardTogether, Tabletop, Discord, Telegram, Google, GitHub,
BG Stats, Tiltify, Gamers Outreach, SpecialEffect, `/stop`, `/notify`, URLs.

Quoted in English, exactly as players see them and inside ”…”, for as long as they are shown in
English: the seat name ”Deleted player 1” that a deleted account leaves in finished games (it is
stored in the game data) and the game's ”Undo” button (the game screens are not translated yet).
The first mention gets a short Swedish gloss in parentheses where it helps: ”Deleted player”
(raderad spelare). The Undo sentence needs none, because it already says _ångra_.

### Emails, notifications and bots

The terms above apply unchanged. These are new:

| English                            | Swedish                                 | Note                                                                           |
| ---------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------ |
| email (the message)                | mejl                                    | "you can safely ignore this email" → "kan du lugnt bortse från det här mejlet" |
| request (a code, a link, a change) | begära                                  | "efter att den begärdes", "har begärts"                                        |
| stops working (a code, a link)     | slutar gälla                            | like the site's "gäller till"                                                  |
| click the button                   | tryck på knappen                        | _tryck_, as on the site, for mouse and touch alike                             |
| account change                     | ändring av ditt konto                   | heading: _Kontoändring upptäckt_                                               |
| invited you to play                | har bjudit in dig till ett parti        | accept the invite → _tacka ja till inbjudan_                                   |
| a game of {title}                  | **ett parti {title}**                   | "ett parti Fresh Fish", like "ett parti schack"                                |
| your {title} game {game}           | ditt parti {game} ({title})             | game name first, title in parentheses, also in subjects                        |
| game started, has begun            | partiet har börjat                      | seasons too: "Säsong 2 i {league} har börjat"                                  |
| game ended / was abandoned         | partiet är avslutat / partiet avbröts   | stalled: "avslutades efter 30 dagar utan drag"                                 |
| tied / won (the result line)       | spelade oavgjort / vann                 |                                                                                |
| open the game / open dashboard     | Öppna partiet / Öppna Mina partier      | the dashboard is the page _Mina partier_                                       |
| revisit the game                   | Se partiet igen                         |                                                                                |
| view, see (buttons)                | visa                                    | "Visa inbjudan", "Visa turneringen", "Visa dina partier"                       |
| vote                               | rösta                                   |                                                                                |
| asks to end the game               | vill avsluta partiet                    | asks everyone → _frågar alla om partiet ska avslutas_                          |
| asks to go back                    | **vill ångra drag**                     | asks everyone → _ber alla om att få ångra drag_                                |
| took over {player}'s seat          | har tagit över platsen efter {player}   | no genitive on the name                                                        |
| a player left / was removed        | en spelare har lämnat / har tagits bort |                                                                                |
| end the game early                 | avsluta partiet i förtid                | the menu item itself is quoted: ”Bryt partiet”                                 |
| final results / final standings    | slutresultat / slutställning            |                                                                                |
| champion, champions                | mästare                                 | same form in the plural                                                        |
| takes / share first place          | tar / delar på förstaplatsen            |                                                                                |
| you finished {place}               | du kom på {place} plats                 | "på 2:a plats", "på 3:e plats"                                                 |
| Season {n} of a league             | säsong {n} i {league}                   | "Anmälan till säsong 2 i Fresh Fish League"                                    |
| seeding season                     | seedningssäsong(en)                     |                                                                                |
| stay (in a level) / bottom level   | stannar kvar / lägsta nivån             |                                                                                |
| turn notifications                 | aviseringar om din tur                  |                                                                                |
| turn on / turn off                 | slå på / stänga av                      |                                                                                |
| message you (the bot)              | skriver till dig                        | Discord "type /stop" → _skriv /stop_; Telegram "send /stop" → _skicka /stop_   |
| chat / user id                     | chatt / användar-id                     |                                                                                |
| congratulations                    | grattis                                 |                                                                                |

## 3. Typography and formatting

- Quotation marks **”…”**. Ellipsis **…** (also where English writes "...").
- Dash: en dash with spaces in titles and asides ("Mina partier – Board Together"); en dash without
  spaces in ranges ("2–4 spelare"). No em dash. "&" is written "och".
- Sentence case throughout, no English title case ("Länkade konton", "Din tur").
- Plurals use `one` / `other`. Plural variants were **added** where Swedish must agree and English
  does not ("1 anmäld / 2 anmälda", "1 öppet / 2 öppna", "1 dags / 7 dagars anmälan") and
  **collapsed** where the noun does not change (spelare, spel, bord, alternativ, tecken, år,
  motståndare).
- Where several counts sit in one line, or the value is text, a colon form avoids agreement:
  "Klara: 3 · Pågår: 1 · Väntar: 2", "Anmälda: 3 / 8", "Speldesign: {designer}", "I tur: {player}",
  "Tempo: {pace}" ("Tempo: Live", "Tempo: Lugnt").
- Player and game names are never inflected: no genitive on a placeholder ("De partier som {name}
  inte har spelat klart …", not "{name}s partier").
- `{count: number}` (Swedish grouping, "1 234") on counts that can reach the thousands:
  `title_count`, `played_game_count`, `dashboard_history_all_shown`, `content_stats_scope_option`,
  `content_stats_scope_summary`.
- Units: "min", "tim", "s", with a space ("3 tim sedan", "Startar om 5 s", "inom 4 tim"); days are
  written out ("3 dagar"). Clock time with "kl." ("Den gäller till kl. {time}").
- Dates and months that arrive already formatted are placed as they are, without "den" or "kl.":
  "Anmälan stänger 25 nov. 14:00.", "sedan november 2026".
- Abbreviations: V / O / F, P (poäng), Snitt, Särsk., Ers., P1 / P2 / S in the bracket.
- UI separators " · ", "→", "←" are unchanged.

In emails, bot messages and push notifications:

- Ordinals are written **1:a, 2:a, 3:e, 4:e … 21:a, 22:a, 23:e** (`email_ordinal`, the ordinal
  categories `one` / `other`) and always sit in "på {place} plats".
- Email dates arrive complete, with "kl." and the time zone ("23 oktober 2026 kl. 20:00 CEST",
  "fredag 23 oktober kl. 20:00 CEST"), and follow the verb directly: "Ditt lösenord ändrades
  {time}", "innan anmälan stänger {closes}".
- Email subjects put the news first and the names last: "Partiet har börjat: {game} ({title})",
  "Partiet är avslutat: {game} ({title})".
- A stand-in name that always opens its sentence has a capital ("Någon", "En spelare", "Ingen");
  one used inside a sentence does not ("de andra spelarna", "din grupp"). The sentences are built
  so that {owner}, {player} and the season name ("Säsong 2", "Seedningssäsongen") come first.
- The small labels above headings and tables are written in sentence case ("Partiet har börjat",
  "Slutställning"); the email's styling shows them in capitals.
- A menu item of several words is quoted (välj ”Bryt partiet” i kontomenyn); a one-word button is
  not (tryck på Anslut), as on the site.
- `email_tournament_results_subline` is a plain string, because _spelare_ does not change in the
  plural.

## 4. Please review

Term choices with a real alternative:

- `nav_pay_it_forward`, `content_pif_heading`, `content_pif_page_title`, `content_landing_small_print`,
  `content_pif_other_charities` — "Ge vidare" for "Pay it forward". "Skicka vidare" (the film's
  Swedish title) is the other candidate; "Ge vidare" says "give" more clearly next to the heart icon.
- `games_call_offer_call`, `games_card_called` — "Bryt partiet" / "Brutet". Alternative: "Avsluta i
  förtid" / "Avslutat i förtid" (clearer, but long for the card label).
- `tournaments_knockout_decider`, `tournaments_knockout_decider_numbered`,
  `tournaments_knockout_decider_label`, `tournaments_form_decider`, `tournaments_bracket_legend` —
  "Skiljeparti", label "S". Alternatives: "avgörande parti", "särspel".
- `tournaments_detail_tiebreak`, `leagues_group_tiebreak_abbr` — "Särskiljning" / "Särsk.". Many
  hobby players simply say "tiebreak"; "TB" could be kept instead.
- `tournaments_bracket_bye` — "Frirond". Alternatives: "Står över", "Bye".
- `tournaments_bracket_heading`, `tournaments_bracket_whole` — "Turneringsträd" / "Hela trädet".
  Alternative: "Slutspelsträd".
- `tournaments_format_knockout` — "Utslagning" as the short tag. Alternative: "Cup".
- `tournaments_status_roster_locked`, `tournaments_schedule_roster_locked_note` — "Startfält" for
  "roster".
- `tournaments_detail_withdrawn`, `leagues_group_withdrew`, `tournaments_replace_withdraw_action` —
  "struken / har strukits / Stryk {name}". Alternative: "utgått".
- `tournaments_replace_withdraw` — "Withdraw" became "Ingen, stryk spelaren" so that the radio group
  "Ersätt med" reads naturally.
- `tournaments_correction_heading` — "Correct tournament credit" → "Rätta resultat i turneringen".
- `content_stats_they_won` — "Hen vann", chosen for column width. Alternative: "Motståndaren vann".
- `content_stats_even_odds`, `content_stats_key_even_odds`, `content_stats_win_rate_meter` — "lika
  chanser" for "even odds".
- `games_card_active_player`, `library_table_to_move` — "I tur".
- `pace_live_name`, `pace_fast_name`, `pace_brisk_name`, `pace_daily_name`, `pace_relaxed_name` —
  "Live / Snabbt / Raskt / Dagligt / Lugnt". Alternatives: "Rappt" or "Kvickt" for Brisk,
  "Avslappnat" for Relaxed.
- `pace_live_past_limit`, `pace_fast_past_limit`, `pace_brisk_past_limit`, `pace_daily_past_limit`,
  `pace_relaxed_past_limit` — "Past the 1 h pace" → "Långsammare än tempot på 1 tim" ("… än
  Live-tempot"). Alternative: "Över tempot på 1 tim", shorter, but "över tempot" can also be read
  as faster than the pace.
- `pace_daily_line`, `pace_relaxed_line` — "inom en dag", "inom 3 dagar". "Dygn" would be more
  exact for 24 hours; "dag" matches the name "Dagligt" and the rest of the site.
- `games_card_revisit`, `library_entry_revisit` — "Se igen" for opening a finished game.
- `library_title_games_community` — "Community games" → "Offentliga partier".
- `games_card_hotseat` — "Hotseat" kept.
- `content_about_talk_body` — "Ris och ros är också välkommet" for "Compliments and complaints".
- `content_pif_us_charity`, `content_pif_uk_charity` — pill chips; "Amerikansk / Brittisk
  välgörenhet" is twice as long as the English.

Things that depend on text outside this file:

- `delete_account_summary`, `delete_account_kept_finished` — the seat name "Deleted player 1" is
  stored in the game data in English, so it is quoted in English, with the gloss "(raderad spelare)"
  on its first mention. It becomes translatable ("Raderad spelare 1", no gloss) once the game data
  is translated.
- `games_vote_undo_yourself` — quotes the game's button as ”Undo”, the label players see, because
  the game screens are not translated yet. It becomes translatable ("knappen Ångra") once they are.
- `games_card_explorations_heading` — "UTFORSKNINGAR" for the game UI's Explorations feature, same
  dependency.
- `discord_webhook_instructions`, `discord_webhook_unsupported`, `telegram_offer` — quote Discord's
  and Telegram's own labels as "Integrationer", "Webhooks" and "Starta". Check against the Swedish
  clients.

Style:

- `profile_heading`, `auth_onboarding_verify_heading`, `auth_onboarding_complete_heading`,
  `auth_login_please_login` — the English headings end in "..."; kept as "…".
  `auth_invitation_heading` ("Join this game?...") is "Gå med i partiet?" without it.
- `auth_email_placeholder` — "namn@example.com".

Emails, bot messages and push notifications (`libs/email/messages/sv.json` and the `push_*` keys):

- `notification_undo_vote_summary`, `notification_undo_vote_heading`, `push_undo_vote_title` — "asks
  to go back" → "vill ångra drag", the site's word for the feature. Alternative: "vill gå tillbaka".
- `notification_call_vote_heading` — "asks everyone to end the game" → "frågar alla om partiet ska
  avslutas", after the site's "Fråga alla om partiet ska avslutas nu?".
- `notification_open_dashboard_button` — "Öppna Mina partier". Alternative: "Till Mina partier", the
  site's pattern for links.
- `email_game_invitation_subject`, `email_game_invitation_preview` — "Join {owner}'s game of
  {title}" → "{owner} bjuder in dig till ett parti {title}", to avoid a genitive on the name.
  `email_game_invitation_unnamed_owner` is "Någon" with a capital because it always comes first.
- `email_game_end_subject` — "Your game of {title} {game} has ended" → "Partiet är avslutat: {game}
  ({title})", built like the started subject.
- `email_game_end_preview` and its variants, `email_player_removed_preview_left`,
  `email_player_removed_preview_removed` — "Your {title} game {game}" → "ditt parti {game}
  ({title})".
- `email_game_end_result_draw` — "{names} spelade oavgjort". Alternative: "{names} delade segern",
  which fits better when two players at a larger table share the win.
- `email_account_change_subject`, `email_account_change_heading` — "Ändring av ditt konto" /
  "Kontoändring upptäckt". "Ditt konto har ändrats" was avoided because the same heading covers a
  change that has only been requested.
- `email_account_email_changed_detail`, `email_account_password_changed_detail`,
  `email_account_email_change_requested_detail`, `email_account_password_reset_requested_detail`,
  `email_account_deleted_detail` — short labels above a date: "E-postadressen ändrad", "Lösenordet
  ändrat", "Byte av e-postadress begärt", "Återställning av lösenord begärd", "Kontot raderat".
- `email_ordinal`, `email_tournament_results_finished_wins`,
  `email_tournament_results_finished_average_place`, `email_league_season_results_promoted` and its
  siblings — "You finished 2nd" → "Du kom på 2:a plats". "Du slutade tvåa" reads better but cannot
  be built from a number.
- `email_standings_column_average_place`, `email_standings_column_tiebreak` — "Snittplac." and
  "Särskiljning", as in the site's tournament table. "Snitt" and "Särsk." are the shorter forms if
  the table gets too wide on a phone.
- `email_league_season_results_subject` — "{season} i {league} – resultat" ("Säsong 2 i Fresh Fish
  League – resultat"). "Resultat från säsong 2 i …" reads better but needs the season name in lower
  case, and the same name opens `email_league_season_results_eyebrow`.
- `email_league_season_name_seeding`, `email_league_season_start_subline_seeding` —
  "Seedningssäsongen" / "Seedningssäsong" for "Seeding season".
- `email_player_removed_subline_left`, `email_player_removed_subline_removed` — "their turn … for
  them" → "den spelarens tur … i spelarens ställe", without "hen".
- `email_bug_report_forum` — the forum's name "bug-reports" is kept; "our Discord" → "vår Discord".
- `discord_unknown_user` — "användar-id"; "Try again?" → "Kan du försöka igen?".
- `discord_command_notify_description`, `discord_command_stop_description` — "Slå på …" / "Stäng av
  aviseringar om din tur och inbjudningar till partier", 59 and 61 characters (Discord allows 100).
- `push_took_over_seat_title` — "You've joined a game in progress" → "Du är med i ett pågående parti",
  like the site's "Du är med i partiet"; an administrator gave the seat, so "gått med" would mislead.

These repeat wording from the site file and must change together with it:

- `email_standings_placement_scoring`, `email_standings_tiebreak_points_behind`,
  `email_standings_tiebreak_share_of_winner`, `email_standings_tiebreak_score_sum` — the same
  sentences as `tournaments_placement_scoring` and `tournaments_tiebreak_*`.
- `email_player_removed_end_early_detail` — quotes the menu item ”Bryt partiet”
  (`games_call_offer_call`) in "kontomenyn" (`nav_open_account_menu`).
- `telegram_not_linked`, `telegram_stopped` — name the button "Anslut" (`discord_webhook_connect`).
- `email_game_started_footer`, `notification_open_dashboard_button` — name the pages "Aviseringar"
  (`nav_notifications`) and "Mina partier" (`nav_my_games`).
