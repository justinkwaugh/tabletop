# German (`de`): glossary and review notes

For `apps/frontend/messages/de.json`, written for Germany, Austria and Switzerland.

## 1. Form of address and tone

- **du**, lower case (du, dein, dir), everywhere. German board-game sites and consumer apps (BoardGameArena, Yucata, Lichess, Discord, Steam) use du; Sie would sound like a bank.
- Plain and friendly, short sentences. Infinitives on buttons ("Entwurf speichern"), imperatives in instructions ("Wähle ein Spiel"), "… konnte nicht geladen werden" / "Wir konnten …" for errors, and "Bitte versuche es erneut." as the one retry sentence.
- Person nouns use the generic masculine (Spieler, Sieger, Gegner, Gastgeber, Administrator, Ersatzspieler), as German rulebooks, game boxes and comparable sites do. Where neutral wording costs nothing it is used ("Ein Spiel von …", "Sieg für …", "Geteilter Sieg", "Alle spielen …", "Mach den Anfang"). Whether to gender is a site-wide choice for you; see Please review.
- ß is kept (standard German; Swiss readers know it from shared DACH sites).

## 2. Terms

The key distinction: **Partie** is one play of a game (a table, an instance); **Spiel** is the title (1830, YINSH). English says "game" for both and sometimes "title".

| English                                   | German                                                        | Note                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| game (an instance)                        | Partie                                                        | "Meine Partien", "Partie starten", "Laufende Partien"; counts of plays are "{count} Partien" (`played_game_count`) |
| game (the title), title                   | Spiel                                                         | "Spielebibliothek", "Wähle ein Spiel", column "Spiel"; counts of titles are "{count} Spiele" (`title_count`)       |
| game options, schedule                    | Spieloptionen, Spielplan                                      | fixed compounds keep "Spiel-"                                                                                      |
| series                                    | Reihe                                                         | "Spiele der Reihe 18xx"                                                                                            |
| Start a game (create)                     | Neue Partie                                                   | kept apart from "Partie starten" (the host starts a filled table)                                                  |
| turn, move                                | Zug                                                           | "Dein Zug", "Am Zug", "Zug machen", "Letzter Zug"                                                                  |
| it's your turn                            | du bist am Zug                                                |                                                                                                                    |
| Answer Request (badge/button)             | Antworten                                                     | short for the card; tab title says "Anfrage beantworten"                                                           |
| undo (a move)                             | zurücknehmen, Rücknahme                                       | "zu einem früheren Stand zurück"                                                                                   |
| call the game / called                    | Partie vorzeitig beenden / Vorzeitig beendet                  |                                                                                                                    |
| concede / conceded                        | aufgeben / Aufgegeben                                         |                                                                                                                    |
| abandoned                                 | Abgebrochen                                                   |                                                                                                                    |
| stalling / stalled                        | Stockt / Stillstand                                           |                                                                                                                    |
| winner, win, tied, lost                   | Sieger, Sieg, Unentschieden, Niederlage                       | never "Gewinner"; letters S/U/N                                                                                    |
| no winner                                 | Kein Sieger                                                   |                                                                                                                    |
| host, owner                               | Gastgeber                                                     |                                                                                                                    |
| seat                                      | Platz; Sitzplatz                                              | "Freie Plätze"; "Sitzplatz 2" where it could be read as a ranking place                                            |
| table / open tables                       | Tisch / offene Tische                                         |                                                                                                                    |
| join / joined / leave                     | beitreten / beigetreten / verlassen                           |                                                                                                                    |
| invited / declined / open                 | eingeladen / abgelehnt / offen                                |                                                                                                                    |
| Looking for players                       | Mitspieler gesucht                                            |                                                                                                                    |
| pace                                      | Tempo                                                         | "Tempo: {pace}"                                                                                                    |
| Live, Fast, Brisk, Daily, Relaxed (paces) | Live, Schnell, Zügig, Täglich, Entspannt                      | "Täglich oder schneller"                                                                                           |
| within 1 h; 1 h (pace limit)              | innerhalb von 1 Std.; 1 Std.                                  | "Schnell · innerhalb von 1 Std.", "Täglich · innerhalb eines Tages", "Entspannt · 3 Tage"                          |
| past the 1 h pace                         | Langsamer als das Tempo von 1 Std.                            | "Langsamer als das Live-Tempo"                                                                                     |
| Hotseat, Lobby, Alpha, Beta               | unchanged                                                     |                                                                                                                    |
| library                                   | Bibliothek, Spielebibliothek                                  | "Spieleregal" for "game shelf"                                                                                     |
| follow / following / unfollow             | folgen / Folge ich / Entfolgen                                |                                                                                                                    |
| Enter / Watch / Revisit / Continue        | Öffnen / Zuschauen / Ansehen / Fortsetzen                     |                                                                                                                    |
| History / Stats / Current                 | Verlauf / Statistik / Aktuell                                 | dashboard tabs                                                                                                     |
| in progress                               | Laufend (tab, section), Läuft (status)                        |                                                                                                                    |
| finished / completed                      | Beendet / Abgeschlossen                                       |                                                                                                                    |
| tournament, league, competitions          | Turnier, Liga, Wettbewerbe                                    |                                                                                                                    |
| registration, sign-up (competitions)      | Anmeldung, Anmeldephase, Anmeldeschluss                       |                                                                                                                    |
| sign in / sign out / sign up (account)    | Anmelden / Abmelden / Registrieren                            |                                                                                                                    |
| roster                                    | Teilnehmerfeld, Teilnehmerzahl                                |                                                                                                                    |
| Mini / Knockout / Multi-stage             | Mini, Miniturnier / K.-o.-System, K.-o.-Turnier / Mehrstufig  |                                                                                                                    |
| stage (of a tournament)                   | Phase                                                         |                                                                                                                    |
| bracket                                   | Turnierbaum                                                   |                                                                                                                    |
| round, Final, Semi-finals, Quarter-finals | Runde, Finale, Halbfinale, Viertelfinale                      |                                                                                                                    |
| match (knockout pairing)                  | Match                                                         | as in chess: a Match is made of Partien                                                                            |
| decider                                   | Entscheidungspartie                                           | labels P1, P2, E for G1, G2, D                                                                                     |
| bye / walkover                            | Freilos / Kampflos                                            |                                                                                                                    |
| knocked out                               | ausgeschieden; "Aus im Halbfinale"                            |                                                                                                                    |
| draw (of lots)                            | Auslosung, ausgelost                                          |                                                                                                                    |
| schedule / scheduling                     | Spielplan / Ansetzung                                         |                                                                                                                    |
| standings                                 | Rangliste                                                     |                                                                                                                    |
| ranking, scoring                          | Wertung                                                       |                                                                                                                    |
| place (rank) / average place              | Platz, Platzierung / Durchschnittsplatz, "Ø Platz"            |                                                                                                                    |
| points / score                            | Punkte (Pkt.) / Punkte, Punktzahl                             |                                                                                                                    |
| tiebreak                                  | Tiebreak (TB)                                                 |                                                                                                                    |
| credited (winner), void                   | gewertet, annulliert                                          |                                                                                                                    |
| substitute / withdraw / withdrawn         | Ersatzspieler (Ers.), ersetzen / zurückziehen / zurückgezogen |                                                                                                                    |
| season, group, level                      | Saison, Gruppe, Stufe                                         | plural "Saisons"                                                                                                   |
| seeding (season 0)                        | Einstufung                                                    |                                                                                                                    |
| promoted / relegated                      | Aufstieg / Abstieg; aufsteigen, absteigen                     |                                                                                                                    |
| Pyramid / Ladder                          | Pyramidensystem / Leitersystem                                | "Liga im Leitersystem"                                                                                             |
| place held / confirm your place           | Platz reserviert / Platz bestätigen                           |                                                                                                                    |
| draft                                     | Entwurf                                                       |                                                                                                                    |
| account, username, password               | Konto, Benutzername, Passwort                                 |                                                                                                                    |
| preferences, settings                     | Einstellungen                                                 |                                                                                                                    |
| verify, confirm                           | bestätigen                                                    | "Bestätigungscode" for code and token                                                                              |
| link / unlink / connect / disconnect      | verknüpfen / trennen / verbinden / trennen                    |                                                                                                                    |
| notifications, web notifications          | Benachrichtigungen, Browser-Benachrichtigungen                |                                                                                                                    |
| turn reminders / reminder hours           | Zugerinnerungen / Erinnerungszeiten                           |                                                                                                                    |
| bug report / report (content)             | Fehlerbericht / Meldung, melden                               |                                                                                                                    |
| win rate, win streak, record              | Siegquote, Siegesserie, Bilanz                                |                                                                                                                    |
| Pay it forward                            | Gutes weitergeben                                             |                                                                                                                    |
| charity                                   | Hilfsorganisation                                             |                                                                                                                    |
| Privacy Policy, Terms of Service          | Datenschutzerklärung, Nutzungsbedingungen                     |                                                                                                                    |

## 3. Typography and formatting

- Quotation marks „…“. Dash: en dash with spaces (" – "), also in page titles ("Meine Partien – Board Together") where English has an em dash; ranges without spaces ("2–4 Spieler"). Separators " · ", "→", "←" are unchanged.
- Ellipsis "…" with a no-break space before it, written ` …` in the file ("Wird geladen …"). The same no-break space sits between number and unit in "vor 5 Min.", "vor 3 Std.", "Start in 5 s", and in the pace texts ("Zügig · 4 Std.", "innerhalb von 3 Tagen"), so a wrapped card line never splits them.
- Headings and buttons in sentence case; all-caps headings stay all caps (SPIELER, PUNKTE).
- Numbers, percentages, dates and times mostly arrive formatted for German ("47 %", "25. Nov., 14:00", "November 2026"). Sentences are built around that output: "Anmeldeschluss am {date} Uhr", "seit {month}", "im {month}", "bis {time} Uhr".
- Abbreviations: Min., Std., Pkt., Ers., TB, Ø (average), S/U/N (Sieg, Unentschieden, Niederlage).
- Plurals use `one` and `other`. Where the German noun does not change (Spieler, Gegner, Zeichen) the message is a plain string. A plural was added where German needs agreement and English has none: `games_call_ends_if`, `leagues_sign_up_more_needed`, `leagues_list_card_format`.
- Names and other runtime values are never inflected: "Am Zug: {player}", "Sieger: {winners}", "Tempo: {pace}", "{name}: zurückgezogen", "Die unbeendeten Partien von {name}". Game names inside screen-reader labels are quoted („{name}“).

## 4. Please review

Terms with competing usage:

- `nav_pay_it_forward`, `content_pif_heading`, `content_pif_page_title`, `content_pif_pass_it_on`, `content_pif_other_charities`: "Pay it forward" as "Gutes weitergeben" / "Gib Gutes weiter." The idiom has no fixed German form; alternatives are "Freude weitergeben" or keeping the English.
- `content_landing_small_print`: "No tip jar" as "Keine Kaffeekasse".
- `games_call_offer_call`, `games_card_called`: "Call the game" as "Partie vorzeitig beenden". There is no set German community term.
- `games_card_stalling`, `games_card_stalled`: "Stockt" / "Stillstand". The colloquial pair "Schläft ein" / "Eingeschlafen" would also fit.
- `leagues_level` and every "Stufe": alternatives "Ebene" or "Klasse".
- `leagues_shape_ladder`, `leagues_shape_pyramid`, `library_competitions_ladder_league`, `library_competitions_pyramid_league`: "Leitersystem" / "Pyramidensystem", chosen because a bare "Leiter" also reads as "leader".
- `pace_fast_name`, `pace_brisk_name`, `pace_daily_name`, `pace_relaxed_name`: "Schnell", "Zügig", "Täglich", "Entspannt"; "Live" stays. Alternatives: "Flott" for Brisk, "Gemütlich" for Relaxed.
- `pace_fast_line`, `pace_brisk_line`, `pace_daily_line`, `pace_relaxed_line`: "innerhalb von 1 Std." is plain but long for the line under a game's name. "binnen 1 Std." is the shorter alternative.
- `pace_live_past_limit` and the other `pace_*_past_limit`: "Langsamer als das Tempo von 1 Std.", because "Tempo überschritten" reads as going too fast.
- `library_pace_fast_or_faster`: "Schnell oder schneller" echoes the way "Fast or faster" does. "Schnell oder Live" says the same with today's five paces.
- `tournaments_detail_tiebreak`, `leagues_group_tiebreak_abbr`: "Tiebreak" / "TB". Chess players would say "Feinwertung".
- `tournaments_schedule_heading` and the other "Spielplan" strings: correct for a fixture list, but board gamers also call the game board "Spielplan". Alternative "Tischplan".
- `tournaments_status_scheduling_paused`, `tournaments_detail_pause_scheduling`, `tournaments_schedule_waiting_scheduling`: "Ansetzung" for scheduling is sports jargon.
- `tournaments_knockout_game_label`, `tournaments_knockout_decider_label`, `tournaments_bracket_legend`: P1, P2 and E instead of G1, G2 and D.
- `tournaments_bracket_legend`, `tournaments_scoring_knockout`, `tournaments_form_knockout_help`: "one game from each side" as "zwei Partien mit vertauschten Seiten".
- `dashboard_tab_history`: "Verlauf"; "Archiv" is the alternative.
- `dashboard_tab_following`, `games_card_unfollow`: "Folge ich", "Entfolgen".
- `content_stats_even_odds`, `content_stats_key_even_odds`, `content_stats_win_rate_meter`: "even odds" as "bei gleichen Chancen".
- `content_stats_won_tied_lost`: "Bilanz (S–U–N)", because the three spelled-out words do not fit the figure.
- `games_card_explorations_heading`: "ERKUNDUNGEN" for the private what-if copies of a game. "ANALYSEN" is closer to chess usage.
- `games_card_continue`: "Fortsetzen" starts a follow-up game from a finished one and could be read as "resume".
- `leagues_sign_up`, `leagues_my_place_signed_up`: "Anmelden" and "Du bist angemeldet" are also the login words. Clear on the league page; "Teilnehmen" / "Du bist dabei" would avoid the overlap.
- `library_title_designed_by`: "Ein Spiel von …" instead of "Autor: …", so the credit needs no gender.
- `games_option_none`: "Ohne", so it fits an option name of any gender.
- Generic masculine throughout (see section 1).

English text that reaches German readers untranslated:

- The pace choice in the form that creates or edits a game is still English ("Fast · moves within an hour", from `GAME_PACE_LABELS` in `libs/frontend-components`). A player picks "Fast" there and sees "Schnell" on the card and in the lobby.
- `delete_account_summary`, `delete_account_kept_finished`: "Deleted player" stays English because `libs/common` writes that name into the game.
- `games_vote_undo_yourself`: „Undo“ names the button in the game UI, which is still English.
- `games_vote_failed_reason`: `{reason}` comes from the server in English.

Things to confirm:

- `telegram_offer`: assumes Telegram's German button reads „Starten“.
- `discord_webhook_instructions`, `discord_webhook_unsupported`: assume Discord's German labels „Integrationen“ and „Webhooks“.
- `auth_email_placeholder`: left as `name@company.com`; `name@beispiel.de` would be the German habit.
- `auth_invitation_heading`: the trailing "..." after the question mark is dropped ("Dieser Partie beitreten?").
- `auth_challenge_expiry`: "Er gilt bis …" follows a sentence about a link or a code. Both are masculine, so it works as long as "token" stays "Code".
