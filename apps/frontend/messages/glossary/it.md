# Italian (`it`) — translation glossary

For native-speaker reviewers of `messages/it.json` (the site and its push notifications) and
`libs/email/messages/it.json` (emails, Discord and Telegram messages).

## 1. Form of address and tone

- **Informal `tu`** throughout, with second-person imperatives on buttons (_Accedi_, _Salva_, _Annulla_,
  _Unisciti_). This is what Italian gaming communities and consumer apps use; _Lei_ or impersonal forms
  would read as cold on a hobby site.
- Plain, friendly, short sentences. Sentence case for headings and buttons (_Notifiche di turno_, not
  _Notifiche Di Turno_). English all-caps headings stay all-caps (_GIOCATORI_, _PUNTEGGIO_).
- **No gendered forms for the person reading.** Sentences are built so that no participle or adjective
  agrees with the user: _Vuoi davvero…?_ instead of _Sei sicuro…?_, _Ti diamo il benvenuto!_,
  _Iscrizione effettuata_, _Ora fai parte di questa partita_, _Sì, confermo_. No schwa or asterisks.
- Role nouns use the usual generic masculine (_giocatore_, _vincitore_, _sostituto_, _amministratore_).
- **Names in placeholders never force agreement**: _{name} ha lasciato il girone_, _Il ritiro di {name}_,
  _In sostituzione di {name}_, _Di turno: {player}_, _Vittoria: {winners}_.
- Errors: _Impossibile … . Riprova._ for "Could not…", _Non siamo riusciti a…_ for "We couldn't…".
  Progress labels are nouns: _Salvataggio…_, _Invio…_, _Caricamento…_.
- **Emails, bot messages and push notifications** address one player with the same `tu` and the same
  neutral constructions: _{owner} ti invita a giocare_ (not _ti ha invitato_), _{player} ora partecipa
  alla tua partita_ (not _si è unito_), _Hai chiuso in 2ª posizione_ (not _Sei arrivato_), _Sei tra gli
  iscritti_ (not _Ti sei iscritto_), _Se questa modifica non l’hai fatta tu_ (not _Se non sei stato tu_),
  _Questa chat è connessa_ (not _Sei connesso_).
- The Discord and Telegram bots speak in the first person, also without participles: _Ti scriverò qui_,
  _Non riesco a identificare…_, _Non trovo un account…_, _Mando solo le notifiche di BoardTogether_.

## 2. Terms

| English                               | Italian                                                                        | Note                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| game (a title in the catalogue)       | gioco                                                                          | _Tutti i giochi_, _Scegli un gioco_; `title_count` counts titles: _3 giochi_     |
| game (one played game)                | partita                                                                        | _Le mie partite_, _Nuova partita_; `played_game_count` counts plays: _3 partite_ |
| title                                 | titolo                                                                         |                                                                                  |
| library                               | ludoteca                                                                       | the hobby word for a collection of games to play; see review                     |
| shelf                                 | scaffale                                                                       |                                                                                  |
| table / open table                    | tavolo / tavolo aperto                                                         |                                                                                  |
| seat / open seat                      | posto / posto libero                                                           |                                                                                  |
| host                                  | host                                                                           | loanword, as in Italian apps                                                     |
| turn / your turn                      | turno / _Tocca a te_                                                           |                                                                                  |
| active player                         | di turno                                                                       | _Di turno: {player}_                                                             |
| move                                  | mossa                                                                          | "last action" is _Ultima mossa_                                                  |
| pace                                  | ritmo                                                                          | label and value: _Ritmo: Veloce_                                                 |
| Live / Fast / Brisk / Daily / Relaxed | Live / Veloce / Sostenuto / Giornaliero / Rilassato                            | the pace names, masculine like _ritmo_; see review                               |
| within 1 h / within a day (pace)      | entro 1 h / entro un giorno                                                    | card line _Veloce · entro 1 h_; chip _Veloce · 1 h_                              |
| past the 1 h pace                     | _Oltre il ritmo di 1 h_                                                        | also _Oltre il ritmo Live_, _Oltre il ritmo di 3 giorni_; see review             |
| Fast or faster (pace filter)          | Veloce o più rapido                                                            | _rapido_ avoids _veloce o più veloce_                                            |
| lobby                                 | Lobby                                                                          |                                                                                  |
| looking for players                   | Cercasi giocatori                                                              |                                                                                  |
| start a game (create)                 | Nuova partita                                                                  |                                                                                  |
| start (begin a created game)          | Avvia                                                                          |                                                                                  |
| join / enter / watch / revisit        | Unisciti / Entra / Guarda / Rivedi                                             |                                                                                  |
| leave / decline                       | Abbandona / Rifiuta                                                            |                                                                                  |
| follow / unfollow                     | Segui / Non seguire più                                                        |                                                                                  |
| in progress                           | in corso                                                                       |                                                                                  |
| finished, completed                   | conclusa, concluso                                                             |                                                                                  |
| abandoned                             | abbandonata                                                                    |                                                                                  |
| undo (a move)                         | annullare; _tornare a un punto precedente_                                     |                                                                                  |
| agree / decline (a vote)              | Accetta / Rifiuta                                                              |                                                                                  |
| concede                               | arrendersi; status _Resa_                                                      |                                                                                  |
| call the game                         | chiudere la partita; _Proponi di chiudere la partita_; status _Chiusa ai voti_ | see review                                                                       |
| stalling / stalled                    | A rischio stallo / Stallo                                                      |                                                                                  |
| tie, tied                             | pareggio                                                                       |                                                                                  |
| shared or joint win                   | a pari merito                                                                  |                                                                                  |
| score / points / wins                 | punteggio / punti (Pt) / vittorie (V)                                          |                                                                                  |
| tournament / league / season          | torneo / lega / stagione                                                       |                                                                                  |
| level / group                         | livello / girone                                                               |                                                                                  |
| ladder / pyramid                      | scala / piramide                                                               | _Lega a scala_, _Lega a piramide_                                                |
| promotion / relegation                | promozione / retrocessione                                                     |                                                                                  |
| registration, sign-up (competition)   | iscrizione, iscrizioni                                                         | _Iscriviti_                                                                      |
| sign up (account)                     | Registrati                                                                     | kept distinct from _Iscriviti_                                                   |
| sign in / sign out                    | Accedi / Esci                                                                  |                                                                                  |
| roster                                | iscritti                                                                       | _Numero di iscritti_, _Iscritti definitivi_                                      |
| format                                | formula                                                                        | Mini, Knockout, Multi-stage → Mini, Eliminazione diretta, A più fasi             |
| stage                                 | fase                                                                           |                                                                                  |
| bracket                               | tabellone                                                                      |                                                                                  |
| round                                 | turno                                                                          | _Turno 2_, _passa il turno_                                                      |
| match                                 | incontro                                                                       |                                                                                  |
| game inside a match                   | partita                                                                        | labels P1, P2                                                                    |
| decider                               | bella                                                                          | label B; see review                                                              |
| tiebreak                              | spareggio                                                                      | abbreviation _Spar._                                                             |
| bye                                   | Bye                                                                            | as on Italian draw sheets                                                        |
| walkover / forfeit                    | A tavolino / perdere a tavolino                                                |                                                                                  |
| draw                                  | sorteggio                                                                      |                                                                                  |
| schedule / scheduling                 | calendario / programmazione                                                    |                                                                                  |
| standings, ranking                    | classifica                                                                     |                                                                                  |
| place (rank)                          | posizione                                                                      | _Pos. media_                                                                     |
| place (a spot in a league)            | posto                                                                          | _Il tuo posto è riservato_                                                       |
| seeding                               | piazzamento                                                                    |                                                                                  |
| substitute                            | sostituto; _In sostituzione di_                                                | abbreviation _Sost._                                                             |
| withdraw, withdrawn                   | ritirare, ritiro                                                               |                                                                                  |
| void (game)                           | annullata                                                                      |                                                                                  |
| side (of a two-player game)           | parte                                                                          | _a parti invertite_                                                              |
| board (in prose)                      | plancia                                                                        | _tabellone_ is kept for the bracket                                              |
| stats                                 | statistiche                                                                    |                                                                                  |
| win rate                              | percentuale di vittorie                                                        | _% di vittorie_ as a figure label                                                |
| even odds                             | pari probabilità                                                               |                                                                                  |
| win streak                            | serie di vittorie                                                              |                                                                                  |
| W / T / L                             | V / P / S                                                                      | vittoria, pareggio, sconfitta                                                    |
| notifications / reminders             | notifiche / promemoria                                                         | _Ore dei promemoria_                                                             |
| link / unlink (account)               | collega / scollega                                                             |                                                                                  |
| connect / disconnect (channel)        | connetti / disconnetti                                                         |                                                                                  |
| verification code, token              | codice di verifica                                                             | one word for both                                                                |
| bug report                            | segnalazione di bug                                                            |                                                                                  |
| report (content)                      | segnalazione; _Segnala…_                                                       |                                                                                  |
| pay it forward                        | Passa il favore                                                                | see review                                                                       |
| charity                               | associazione benefica                                                          |                                                                                  |
| free to play                          | gratis                                                                         |                                                                                  |
| Terms of Service / Privacy Policy     | Termini di servizio / Informativa sulla privacy                                |                                                                                  |
| 18xx: companies, shares, track        | compagnie, azioni, binari                                                      |                                                                                  |
| champion (results emails)             | Vincitore / Vincitori                                                          | as on the tournament page; see review                                            |
| finished 2nd                          | _Hai chiuso in 2ª posizione_                                                   | feminine ordinal, no article; see section 3                                      |
| move up / move down / stay (level)    | sali / scendi / resti                                                          | _e sali al Livello {level}_                                                      |
| seeding season                        | Stagione di piazzamento                                                        |                                                                                  |
| sign-up closes soon                   | le iscrizioni chiudono a breve                                                 | the reminder goes out two days before                                            |
| waiting for (players to move)         | _Di turno: {names}_                                                            | not _In attesa di_; see review                                                   |
| invited you                           | ti invita                                                                      | present tense, so no participle agrees                                           |
| joined (notification)                 | ora partecipa                                                                  | _{player} ora partecipa alla tua partita_                                        |
| go back (undo vote, in notifications) | tornare indietro                                                               | short for _tornare a un punto precedente_                                        |
| end the game early                    | chiudere la partita in anticipo                                                |                                                                                  |
| take over a seat                      | prendere il posto di                                                           | _Hai preso il posto di {player}_                                                 |
| removed (a player)                    | _non fa più parte di…: il suo account è stato rimosso_                         | see review                                                                       |
| dashboard (in a button)               | le tue partite                                                                 | _Apri le tue partite_                                                            |
| button (in an email)                  | pulsante                                                                       | _Se il pulsante non funziona, apri…_                                             |
| safely ignore this email              | ignorare tranquillamente questa email                                          |                                                                                  |
| works for 15 minutes (code, link)     | è valido per 15 minuti dalla richiesta                                         | _e funziona solo il più recente_                                                 |
| turn notifications                    | notifiche di turno                                                             |                                                                                  |
| Type /stop / Send /stop               | Digita /stop (Discord) / Invia /stop (Telegram)                                |                                                                                  |
| score (standings column in emails)    | Punti                                                                          | see review                                                                       |
| name fallbacks                        | Un giocatore / Qualcuno, qualcuno                                              | capitalised only where the name starts every sentence                            |

Not translated: BoardTogether, Board Together, Tabletop, game titles, Discord, Telegram, Google,
GitHub, BG Stats, Tiltify, charity names, `/stop`, `/notify`, `/start`, URLs, Alpha, Beta, Hotseat, the
Discord forum name `bug-reports`.

## 3. Typography and formatting

- Quotation marks «…» without inner spaces; typographic apostrophe ’; single-character ellipsis …
  (English `...` is normalised); capital È.
- UI separators kept as in English: `·`, `—`, `→`, `←`.
- Units take a space: _3 min fa_, _3 h fa_, _Inizio tra 5 s_. Percentages arrive formatted (_47%_).
- Clock times are introduced with _alle ore_ (_fino alle ore 15:30_), which also works for 0:xx and 1:xx.
- Dates arrive already formatted and follow _il_: _Le iscrizioni chiudono il 25 nov, 14:00_. A month with
  its year arrives in full and lower case: _da novembre 2026_.
- Plurals use `one` plus the `*` catch-all, which covers the CLDR `many` and `other` categories.
- A plural selector was added where English has a plain string but Italian needs agreement:
  `create_game_open_tables`, `content_stats_scope_option`, `content_stats_scope_summary`,
  `leagues_sign_up_more_needed`.
- Where one line carries several counts, the label comes first so that nothing has to agree:
  _Concluse: 3 · In corso: 1 · In attesa: 2_, _Iscritti: 5 / 8_, _Posti occupati: 3 su 4_.
- Counts use `{count: number}` (as in every language); Italian groups digits only from 10.000, so most counts look unchanged.

Emails and notifications:

- Email subjects put the news first, then a colon and the names, so no name needs a preposition or an
  article: _Partita iniziata: {game} ({title})_, _Iscrizioni aperte: {league}, Stagione {season}_,
  _Risultati finali: {tournament}_.
- In sentences a name stands in apposition, so nothing agrees with it: _La partita {game} è iniziata_,
  _Il torneo {tournament} si è concluso_, _{league}: la Stagione {season} è iniziata_.
- Ordinals are feminine, `{place}ª`, and always read _in {place} posizione_. That takes no article, so 8
  and 11 never need _all’_. `email_ordinal` is a plain string, since the ending doesn't change.
- A full timestamp follows _il giorno_ (_il giorno 8 novembre 2026 alle ore 10:05 CET_), right on every
  day of the month. The sign-up deadline starts with the weekday and takes no article: _prima che le
  iscrizioni chiudano venerdì 23 ottobre alle ore 20:00 CEST_.
- Where the English formats a number (`{wins: number}`, `{games: number}`, `{count: number}`) the Italian
  does too, so half wins read _2,5 vittorie_.
- Name fallbacks: _Qualcuno_ (`email_game_invitation_unnamed_owner`) and _Un giocatore_
  (`email_player_removed_unnamed_player`) are capitalised because every sentence that takes them starts
  with the name. _qualcuno_, _gli altri giocatori_ and _il tuo girone_ are lower case because they come
  mid-sentence.
- The quoted bug report is set in «…». The Discord command descriptions are 57 and 60 characters long.

## 4. Please review

Source issues that the translation cannot fix:

- `games_vote_undo_yourself` — names the game's Undo button in English, as game UIs are not translated.
- `delete_account_summary`, `delete_account_kept_finished` — keep the name «Deleted player» in English,
  because shared code generates it in English.

Term choices with a real alternative:

- `dashboard_go_to_library`, `dashboard_explore_library`, `library_page_title`, `loading_game_library`,
  `content_back_to_library`, `content_landing_library_count`, `library_title_unavailable`,
  `library_series_unavailable` — _ludoteca_ for "library"; the alternative is _libreria_.
- `tournaments_knockout_decider`, `tournaments_knockout_decider_numbered`,
  `tournaments_knockout_decider_label`, `tournaments_knockout_decider_label_numbered`,
  `tournaments_form_decider`, `tournaments_detail_decider_options`, `tournaments_bracket_legend` —
  _bella_ for "decider". The alternative is _spareggio_ for the decider and _tie-break_ (TB) for the
  tiebreak, now _spareggio_ in `tournaments_detail_tiebreak` and _Spar._ in `leagues_group_tiebreak_abbr`.
- `nav_pay_it_forward`, `content_pif_heading`, `content_pif_page_title`, `content_pif_pass_it_on`,
  `content_landing_small_print` — _Passa il favore_ for "Pay it forward"; Italian has no fixed idiom.
- `games_call_offer_call`, `games_call_ask_end`, `games_card_called` — "call the game" as _Proponi di
  chiudere la partita_ and _Chiusa ai voti_.
- `games_card_conceded`, `games_card_stalled`, `games_card_stalling` — very short status labels:
  _Resa_, _Stallo_, _A rischio stallo_.
- `tournaments_knockout_round`, `tournaments_knockout_round_match`, `tournaments_bracket_rounds_label` —
  _turno_ for a tournament round, the same word as a game turn; _round_ would be the alternative.
- `tournaments_format`, `leagues_format_heading` — _Formula_; the alternative is _Formato_.
- `pace_brisk_name`, `pace_brisk_line`, `pace_brisk_summary`, `library_pace_brisk_or_faster` —
  _Sostenuto_ for "Brisk", from _ritmo sostenuto_; the alternative is _Spedito_.
- `pace_live_name`, `pace_live_past_limit`, `library_pace_live` — _Live_ kept in English, as Italian
  players say; the alternative is _In tempo reale_.
- `leagues_season_name_seeding`, `leagues_sign_up_seeding_explanation` — _piazzamento_ for "seeding".
- `content_stats_even_odds`, `content_stats_key_even_odds`, `content_stats_win_rate_meter` —
  _pari probabilità_ for "even odds".
- `tournaments_knockout_champion` — _Primo posto_ rather than _Campione_, to stay gender-neutral.
- `tournaments_status_roster_locked` — _Iscritti definitivi_ for "Roster locked".
- `games_card_hotseat` — _Hotseat_ kept as the name of the mode.
- `games_player_status_host`, `games_player_status_joined`, `games_player_status_invited`,
  `games_player_status_declined`, `games_player_status_open` — _host_, _partecipa_, _invito inviato_,
  _invito rifiutato_, _libero_, chosen to avoid gendered participles.

Wording to confirm:

- `games_card_answer_request`, `library_entry_answer_request` — shortened to _Rispondi_ so the card
  button stays narrow; the tab title has the full _Rispondi alla richiesta_.
- `library_entry_joined` — _Partecipi_ for "Joined".
- `pace_live_past_limit`, `pace_fast_past_limit`, `pace_brisk_past_limit`, `pace_daily_past_limit`,
  `pace_relaxed_past_limit` — _Oltre il ritmo di 1 h_ for "Past the 1 h pace"; the alternative is
  _Oltre il limite di 1 h_.
- `tournaments_registration_closes_on`, `tournaments_registration_closed_on`,
  `tournaments_registration_closes_on_capped`, `tournaments_registration_closed_on_capped`,
  `tournaments_summary_completed_on`, `games_card_stall_deadline` — _il {date}_ reads _il 8 nov_ and
  _il 11 nov_ on those two days, where Italian writes _l’8_ and _l’11_. A colon would avoid the article
  (_Chiusura delle iscrizioni: {date}_).
- `time_ago_just_now` — _un attimo fa_.
- `telegram_offer` — Telegram's Start button is written _Avvia_, as Telegram shows it in Italian.
- `content_stats_outcome_letter_won`, `content_stats_outcome_letter_tied`,
  `content_stats_outcome_letter_lost` — V, P, S.
- `games_option_none` — _Nessuno_; the gender of the option it describes is not known.
- `auth_email_placeholder` — sample address localised to _nome@esempio.com_.
- `content_landing_loading` — _Sistemiamo i giochi sullo scaffale…_ for "Setting out the games…".

Emails, bot messages and push notifications — source issues:

- `email_account_email_change_requested_preview` — the English ends "until the new address is verified
  on {time}", but `{time}` is when the request was made. The Italian attaches it to the request.
- `email_player_removed_end_early_detail` — quotes the menu item «Proponi di chiudere la partita»
  (`games_call_offer_call`); the two must change together.
- `telegram_not_linked`, `telegram_stopped` — name the site's _Connetti_ button
  (`discord_webhook_connect`); they must change together too.

Emails, bot messages and push notifications — term choices with a real alternative:

- `email_standings_champion`, `email_standings_champions` — _Vincitore_ / _Vincitori_, as on the
  tournament page. The bracket's _Primo posto_ would read as the reader's own group place in the league
  results email, which names the league champion. The alternative is _Campione_ / _Campioni_.
- `email_standings_column_score` — _Punti_, so the header fits its narrow column; the tournament page has
  _Punteggio_.
- `email_standings_column_average_place` — _Pos. media_ as on the tournament page; _Media_, as in the
  league tables, would fit the column better.
- `email_tournament_results_finished_average_place`, `email_tournament_results_finished_wins`,
  `email_league_season_results_seeded`, `email_league_season_results_promoted`,
  `email_league_season_results_relegated`, `email_league_season_results_stayed`,
  `email_league_season_results_substitute` — "You finished {place}" as _Hai chiuso in {place} posizione_.
- `email_league_season_results_substitute` — "as a substitute" as _in sostituzione di un altro
  giocatore_, to avoid _come sostituto_ or _sostituta_.
- `email_player_removed_preview_removed`, `email_player_removed_subline_removed` — "was removed" as _non
  fa più parte di…: il suo account è stato rimosso_, so that no participle agrees with the player's name.
- `email_game_started_waiting`, `email_game_started_preview_waiting` — "Waiting for {names}" as _Di
  turno: {names}_. _In attesa di_ breaks with the fallback _gli altri giocatori_.
- `notification_undo_vote_summary`, `notification_undo_vote_heading`, `push_undo_vote_title` — "go back"
  as _tornare indietro_, shorter than the site's _tornare a un punto precedente_.
- `notification_player_joined_summary`, `notification_player_joined_heading`, `push_player_joined_body` —
  "joined" as _ora partecipa_, after the site's _partecipa_; the alternative is _si unisce a_.
- `notification_open_dashboard_button` — _Apri le tue partite_ for "Open dashboard".
- `telegram_connected_as`, `telegram_connected` — "You're connected" as _Questa chat è connessa…_, to
  avoid _connesso_ or _connessa_.

Emails, bot messages and push notifications — wording to confirm:

- `email_account_email_change_requested_preview`, `email_account_password_reset_requested_preview`,
  `email_account_email_changed_preview`, `email_account_password_changed_preview` — _il giorno {time}_
  rather than _il {time}_.
- `email_league_sign_up_subject_reminder`, `email_league_sign_up_preview_reminder`,
  `email_league_sign_up_eyebrow_reminder` — _chiudono a breve_ for "closes soon".
- `email_unnamed_player` — _Un giocatore_ keeps its capital inside a list (_Vittoria di Un giocatore e
  Bob!_), as "A Player" does in English.
- `email_game_started_warning_heading` — _Non saprai quando tocca a te_ for "You won't hear when it's
  your turn".
- `email_tournament_results_champion` — _Sei tu. Congratulazioni!_ under the winner's name.
- `discord_command_notify_description`, `discord_command_stop_description` — imperatives, _Attiva…_ and
  _Disattiva…_.
- `push_player_joined_title`, `push_player_declined_title`, `push_invited_title` — noun titles: _Nuovo
  giocatore!_, _Invito rifiutato_, _Invito a una partita!_.
- `push_lost_seat_title` — _Il tuo posto è passato a un altro giocatore_.
