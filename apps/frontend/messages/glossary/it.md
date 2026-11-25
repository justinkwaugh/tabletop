# Italian (`it`) — translation glossary

For native-speaker reviewers of `messages/it.json`.

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

Not translated: BoardTogether, Board Together, Tabletop, game titles, Discord, Telegram, Google,
GitHub, BG Stats, Tiltify, charity names, `/stop`, `/notify`, URLs, Alpha, Beta, Hotseat.

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
- `{count: number}` is not used: Italian groups digits only from 10.000 and no count here gets that far.

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
