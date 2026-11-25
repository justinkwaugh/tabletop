# Spanish (`es`) — translation glossary

One `es` file serves Spain and Latin America (Mexico, Argentina and others). Where the regions
differ, the word that reads naturally in both was chosen; the unavoidable regional choices are
marked **(regional)** below.

## 1. Form of address and tone

- **Informal singular _tú_** everywhere (_Elige un juego_, _Revisa tu correo_). It is what Board
  Game Arena, Discord, Steam and most consumer apps use in Spanish on both sides of the Atlantic.
- No _vosotros_ (Spain only), no _ustedes_ as a plural "you", no _voseo_ (Argentina). Sentences
  that address several people are phrased impersonally.
- Plain and short, like the English. Error messages drop "please" (_Inténtalo de nuevo_), as
  Spanish interfaces usually do.
- Failures: _No se pudo…_ (impersonal, works for "We couldn't", "Could not", "X couldn't load").
  Things that have just happened: present perfect (_Tu reporte se ha enviado_) or a participle
  phrase (_Enlace copiado_). Past events told later: simple past (_{name} se retiró_).
- Gender: role nouns use the generic masculine, as is standard (_jugador_, _ganador_,
  _anfitrión_, _administrador_, _campeón_). Everything said about the reader or about a named
  player avoids gender: _Te damos la bienvenida_, _Participas_, _Se retiró_, _Sí, eliminar_,
  _Inscripción realizada_, _Suplente de {name}_.
- Sentences with a name placeholder never need the name inflected: _Turno: {player}_,
  _Victoria de {winners}_, _Se retiró a {name}_.
- **Emails, push notifications, Discord and Telegram** use the same _tú_. The two bots speak in
  the first person, as in English (_Te escribiré aquí_, _No encontré ninguna cuenta…_).
- News in an email or a notification is told in the present perfect, like the site's toasts
  (_{owner} te ha invitado a jugar_, _Tu partida ha empezado_, _Tu cuenta se ha eliminado_)
  **(regional)**: Latin American readers would also expect the simple past (_te invitó_). A
  sentence that carries its date takes the simple past in both regions (_Tu contraseña se
  cambió el {time}_), and so do closed facts about the reader (_Terminaste en el puesto 3_,
  _Jugaste esta partida_, _Si no lo solicitaste_).
- In emails and notifications too, nothing agrees with a name or with the reader: _¡Victoria de
  {names}!_, _Empate: {names}_, _{player} ha quedado fuera de…_ (not _fue retirado_), _Este chat
  ya está conectado…_ (not _Estás conectado_), _contándote a ti_ (not _tú incluido_).

## 2. Terms

### The site and games

| English                            | Spanish                                                   | Note                                                                                           |
| ---------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| game (one being played)            | **partida**                                               | _Empezar una partida_, _Mis partidas_                                                          |
| game, title (Fresh Fish, 1830…)    | **juego**                                                 | "Pick a title" → _Elige un juego_; the "Title" column → _Juego_                                |
| N games (a count)                  | _N partidas_ (played), _N juegos_ (titles)                | `played_game_count` in the stats; `title_count` in the library and series                      |
| library                            | **biblioteca (de juegos)**                                | Hobby alternative: _ludoteca_                                                                  |
| series                             | serie                                                     |                                                                                                |
| table, open table                  | **mesa**, mesa abierta                                    |                                                                                                |
| seat, open seat                    | **asiento**, asiento libre                                | Alternatives: _plaza_ (Spain), _lugar_ (Latin America)                                         |
| host, game's owner                 | **anfitrión**                                             | One word for both English words                                                                |
| player, opponent                   | jugador, **rival**                                        |                                                                                                |
| turn, your turn                    | turno, tu turno                                           |                                                                                                |
| move                               | **jugada**                                                |                                                                                                |
| pace                               | **ritmo**                                                 | Names and wording in _Game pace_ below                                                         |
| score (column, heading)            | **puntos**                                                | _puntuación_ only where a noun is needed; avoids _puntaje_ / _puntuación_ split                |
| winner, no winner, tied            | ganador, sin ganador, empate                              |                                                                                                |
| W / T / L                          | **V / E / D**                                             | victoria, empate, derrota                                                                      |
| win rate                           | porcentaje de victorias, **% de victorias** (short label) |                                                                                                |
| even odds                          | igualdad de probabilidades                                |                                                                                                |
| finished, in progress              | terminada, en curso                                       | _terminado_ for a tournament                                                                   |
| current (tab)                      | actuales                                                  |                                                                                                |
| follow, following, unfollow        | seguir, siguiendo (tab: **Sigo**), dejar de seguir        | See review list                                                                                |
| watch, revisit                     | ver, repasar                                              |                                                                                                |
| join, leave                        | unirse, salir                                             |                                                                                                |
| undo                               | **deshacer**                                              | The game's own button is quoted in English: _el botón “Undo”_                                  |
| ask, request (undo and call votes) | **proponer, propuesta**                                   | _Sam propone deshacer…_, _Enviar propuesta_                                                    |
| agree, decline                     | aceptar, rechazar                                         |                                                                                                |
| concede                            | **rendirse**                                              | _Sí, me rindo_; finished label _Por rendición_                                                 |
| call the game                      | **dar por terminada la partida**                          | Finished label _Por acuerdo_                                                                   |
| stalling, stalled                  | inactiva, estancada                                       |                                                                                                |
| abandoned                          | abandonada                                                |                                                                                                |
| hotseat                            | Hotseat (not translated)                                  | See review list                                                                                |
| explorations                       | exploraciones                                             |                                                                                                |
| bug report, to report              | **reporte (de error), reportar**                          | **(regional)** Latin American usage, understood in Spain (_informar de un error_, _denunciar_) |
| pay it forward                     | **cadena de favores**                                     | Title of the film in Spain and Latin America                                                   |
| charity                            | organización benéfica                                     |                                                                                                |
| sign in, sign out                  | iniciar sesión, cerrar sesión                             |                                                                                                |
| sign up (account)                  | registrarse; _registro_                                   |                                                                                                |
| username, password, email          | nombre de usuario, contraseña, **correo electrónico**     | _correo_ when short; not _email_ / _mail_                                                      |
| link (account), unlink             | vincular, desvincular                                     |                                                                                                |
| settings                           | configuración                                             | Not _ajustes_                                                                                  |
| preferences                        | preferencias                                              |                                                                                                |
| reminder                           | recordatorio                                              |                                                                                                |
| time zone                          | zona horaria                                              |                                                                                                |
| draft                              | borrador                                                  |                                                                                                |
| manage                             | administrar                                               |                                                                                                |

### Game pace

The five names are written as adjectives of _ritmo_ (masculine) and are the same wherever a pace
is shown: the _Ritmo_ column, game cards, the lobby filter.

| English                       | Spanish                    | Note                                                           |
| ----------------------------- | -------------------------- | -------------------------------------------------------------- |
| Live                          | **En vivo**                |                                                                |
| Fast                          | **Rápido**                 |                                                                |
| Brisk                         | **Ágil**                   |                                                                |
| Daily                         | **Diario**                 |                                                                |
| Relaxed                       | **Relajado**               | See review list                                                |
| Fast · within 1 h (card line) | Rápido · en menos de 1 h   | _Diario · en menos de un día_, _Relajado · en menos de 3 días_ |
| Fast · 1 h (chip)             | Rápido · 1 h               | _Ágil · 4 h_, _Relajado · 3 días_                              |
| Past the 1 h pace             | **Fuera del ritmo de 1 h** | _…de 1 día_, _…de 3 días_; Live: _Fuera del ritmo en vivo_     |
| Daily or faster (filter)      | Diario como mínimo         | Avoids _Rápido o más rápido_ for "Fast or faster"              |
| {pace} pace                   | Ritmo: {pace}              | _Ritmo: Rápido_; the name keeps its capital after the colon    |

### Tournaments and leagues

| English                             | Spanish                                                              | Note                                                                    |
| ----------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| tournament, league                  | torneo, liga                                                         |                                                                         |
| competitions                        | **torneos y ligas**                                                  | Avoids _competición_ (Spain) / _competencia_ (Latin America)            |
| mini, knockout, multi-stage         | Mini / minitorneo, **Eliminatoria / torneo eliminatorio**, Por fases |                                                                         |
| registration, sign-up (league)      | **inscripción**                                                      | One word for both                                                       |
| roster                              | lista de participantes, participantes                                |                                                                         |
| round, stage                        | ronda, fase                                                          |                                                                         |
| final, semi-finals, quarter-finals  | final, semifinales, cuartos de final                                 |                                                                         |
| bracket                             | **cuadro**                                                           | Alternatives: _llave_ (Latin America), _bracket_                        |
| match (knockout pairing)            | **duelo**                                                            | Distinct from _partida_ (game). Alternatives: _cruce_, _enfrentamiento_ |
| side                                | **bando**                                                            | As in chess: _una partida con cada bando_                               |
| split match                         | duelo igualado                                                       |                                                                         |
| decider                             | **desempate** (partida de desempate)                                 | Label _D_; games _P1_, _P2_                                             |
| tiebreak                            | **desempate** (criterio)                                             | Column header _Desempate_, abbreviation _Des._                          |
| bye                                 | **Bye**                                                              | See review list                                                         |
| walkover                            | **Retirada**                                                         | See review list                                                         |
| champion, runner-up                 | campeón, subcampeón                                                  |                                                                         |
| knocked out, out in round N         | eliminado, _Fuera en la ronda N_                                     |                                                                         |
| draw, new draw                      | sorteo, nuevo sorteo                                                 |                                                                         |
| schedule; scheduling                | **calendario**; **programación**                                     |                                                                         |
| standings, ranking                  | **clasificación**                                                    |                                                                         |
| place (rank)                        | **puesto**                                                           | _Puesto promedio_, abbreviation _Prom._                                 |
| place (a berth in a league level)   | **plaza**                                                            | _Tu plaza en el nivel A está reservada_                                 |
| substitute                          | **suplente**                                                         | Same form for any gender; abbreviation _Supl._                          |
| withdraw, withdrawn                 | retirar(se), _Se retiró_                                             |                                                                         |
| void                                | anulada                                                              |                                                                         |
| season, level, group                | temporada, nivel, grupo                                              |                                                                         |
| ladder, pyramid                     | **escalera, pirámide**                                               | _Liga en escalera_, _Liga en pirámide_ (as in racket-sport clubs)       |
| promoted, relegated; go up, go down | asciende, desciende; suben, bajan                                    |                                                                         |
| seeding (season)                    | **posicionamiento**                                                  | As in video games' _partidas de posicionamiento_                        |
| returning players                   | jugadores de la temporada anterior                                   |                                                                         |
| shape (of a league)                 | estructura                                                           |                                                                         |

### Emails, notifications and bots

These messages are in `libs/email/messages/es.json` (emails, Discord, Telegram) and in the
`push_*` keys of the site file (browser notifications).

| English                              | Spanish                                               | Note                                                                 |
| ------------------------------------ | ----------------------------------------------------- | -------------------------------------------------------------------- |
| email (the message)                  | **correo**                                            | _este correo_; the address stays _(dirección de) correo electrónico_ |
| subject lines                        | _{league}: …_, _Partida iniciada: {game} ({title})_   | The name the reader recognises comes first                           |
| Game started (label, subject)        | **Partida iniciada**                                  | In a sentence: _{game} ha empezado_                                  |
| game ended (subject)                 | Partida terminada                                     |                                                                      |
| you can safely ignore this email     | puedes ignorar este correo sin problema               |                                                                      |
| please contact us                    | contáctanos                                           |                                                                      |
| click the button below               | **usa el botón de abajo**                             | Works for mouse and touch; avoids _haz clic_ / _pulsa_               |
| stops working (code, link)           | deja de funcionar                                     |                                                                      |
| won, tied (result line)              | _¡Victoria de {names}!_, _Empate: {names}_            | No verb, so one name or several both work                            |
| left (the game, the site)            | ha salido de (la partida), ha dejado (Board Together) |                                                                      |
| was removed (a player)               | **ha quedado fuera de**                               | See review list                                                      |
| end the game early                   | terminar la partida antes de tiempo                   |                                                                      |
| Call the game (menu entry)           | “Dar por terminada la partida”                        | Quoted as the account menu (_el menú de la cuenta_) shows it         |
| dashboard                            | **Mis partidas**                                      | The page's name on the site: _Ir a Mis partidas_                     |
| take your turn (button)              | Jugar tu turno                                        | Same as the game card                                                |
| open game (button), open the game    | Abrir partida, Abrir la partida                       | Buttons are infinitives, as on the site (_Unirse a la partida_)      |
| asks to end the game                 | propone terminar la partida                           |                                                                      |
| asks to go back (undo vote)          | **propone deshacer jugadas**                          | See review list                                                      |
| take over a seat                     | ocupar el asiento                                     | _Has ocupado el asiento de {player}_                                 |
| turn notifications                   | notificaciones de turno                               |                                                                      |
| I'll message you (bot)               | te escribiré                                          | The site says _te escribe_                                           |
| type /stop, send /stop               | escribe /stop (Discord), envía /stop (Telegram)       |                                                                      |
| press Connect                        | selecciona Conectar                                   | The button's label on the notifications page                         |
| post (webhook)                       | publicar                                              |                                                                      |
| user id                              | ID de usuario                                         | As Discord calls it                                                  |
| you finished 3rd                     | **terminaste en el puesto 3**                         | `email_ordinal` is the bare number; see typography                   |
| final standings                      | clasificación final                                   |                                                                      |
| Wins, Avg place, Score, Tiebreak     | **Vict.**, Prom., Puntos, Desempate                   | Column headers of the results table; measured                        |
| a held place                         | plaza reservada                                       |                                                                      |
| Season 2, Seeding season (as a name) | temporada 2, temporada de posicionamiento             | Lowercase: these two only ever sit inside a sentence                 |
| A Player (no username)               | Jugador sin nombre                                    |                                                                      |
| Congratulations!                     | ¡Felicidades!                                         | Not _¡Enhorabuena!_ (Spain) or _¡Felicitaciones!_ (Latin America)    |
| the bug-reports forum                | el foro bug-reports                                   | The channel's name on Discord                                        |

Six messages are stand-ins for a missing name, and each is written for the place its sentences
give it. Keep that place when rewording:

- start of the sentence: `email_game_invitation_unnamed_owner` (_Alguien_),
  `email_player_removed_unnamed_player` (_Un jugador_), `email_standings_nobody` (_Nadie_, which
  also stands alone in the champion panel);
- after a preposition or a colon: `email_game_end_no_winner_names` (_alguien_),
  `email_game_started_no_active_names` (_los demás jugadores_),
  `email_league_season_start_no_opponent_names` (_tu grupo_).

### Regional choices made on purpose

| Used                          | Avoided              | Why                                        |
| ----------------------------- | -------------------- | ------------------------------------------ |
| agregar                       | añadir               | Standard in Latin America, normal in Spain |
| seleccionar, tocar            | pulsar, presionar    | "Press" differs by region                  |
| escribir (a code, an address) | introducir, ingresar |                                            |
| expirar                       | caducar, vencer      |                                            |
| en línea, en vivo             | online, en directo   |                                            |
| controles (game controllers)  | mandos               |                                            |
| promedio                      | media                |                                            |
| en este momento               | ahora mismo          |                                            |
| marrón, morado                | café, violeta        | **(regional)** no neutral word exists      |

### Labels players see in English

Two labels that the messages point at reach players in English and stay English for now. The
messages quote them exactly as players see them, in English inside “…”, because a translated name
would send the reader looking for a label that is not on the screen. A Spanish gloss in
parentheses follows only where the sentence does not already say what the label means.

- **“Deleted player 1”, “Deleted player 2”, …** — the name the game data stores for a deleted
  account's seats in finished games. `delete_account_summary`: _a nombre de “Deleted player”
  (jugador eliminado)_; `delete_account_kept_finished`: _“Deleted player 1” (jugador eliminado 1) y
  así sucesivamente_. The gloss says _eliminado_ because the account action is _Eliminar cuenta_.
  The email that confirms the deletion says the same (`email_account_deleted_subline`: _apareces
  como “Deleted player” (jugador eliminado)_).
- **“Undo”** — the button in the game screens, a part of the site that is not translated yet.
  `games_vote_undo_yourself`: _con el botón “Undo”_. No gloss, as the sentence already says
  _deshacer_; _el botón_ tells the reader what the English word names.

## 3. Typography and formatting

- **Quotation marks:** “…” (comillas inglesas), the form readers in both regions see on screens.
  «…» is the academic first choice in print; switching is a global search and replace.
- Opening **¿** and **¡** always. One-character ellipsis **…**, also where English has "...".
- **Sentence case** for headings, buttons and tabs (_Colores de jugador preferidos_).
- Labels followed by an explanation use a colon instead of a spaced dash (_Puestos: los
  jugadores…_). The UI separators " · ", "→", "←" and the " — " of page titles are kept.
- **Counts are written raw**, with no grouping separator: Spain and Argentina group as 1.234,
  Mexico as 1,234, so plain digits are the only unambiguous form. Numbers that the code formats
  (percentages _50 %_, decimals _3,4_, dates _25/11/2026_) follow the `es` locale, i.e. the
  Spain and Argentina convention; a Mexican reader sees a decimal comma.
- **Number + unit symbol** with a no-break space (U+00A0, a literal character in the JSON):
  _hace 5 min_, _hace 3 h_, _42 s_, _Rápido · 1 h_, _EE. UU._ A unit written as a word takes a
  normal space (_hace 3 días_, _Relajado · 3 días_).
- **Plurals:** `one` plus the `*` catch-all (it covers the CLDR categories `many` and `other`).
  Plural variants were added where English has a plain string but Spanish must agree
  (`create_game_open_tables`, `content_stats_scope_option`, `content_stats_scope_summary`,
  `leagues_format_sign_up_*`, `leagues_sign_up_count_*`, `leagues_sign_up_more_needed`,
  `leagues_roster_signed_up`, `leagues_list_card_format`, and a second selector in
  `content_stats_tournament_tables`).
- Where a count would force agreement that cannot be guaranteed, the text is a label and a
  number: _Terminadas: 3 · En curso: 1 · Pendientes: 2_, _Inscritos: 5 / 8_,
  _Mínimo para empezar: 6_.
- **Short labels were measured** against the fixed-width columns and phone-width tab rows they
  sit in (site font, headless browser): _Part._, _Prom._, _Des._, _Todo_, _Sigo_, _Responder_,
  _Retirada_.
- The results table in emails has fixed columns (52, 64 and 84 px) with 11 px capitals. Measured
  the same way: _Vict._ 34 px (_Victorias_, 67 px, does not fit the 52 px column and squeezes
  the names on a phone), _Prom._ 40 px, _Puntos_ 50 px, _Desempate_ 75 px.
- **Places in emails** are a number after _puesto_ (_Terminaste en el puesto 3_), so
  `email_ordinal` is the bare number. It avoids a gendered ordinal about the reader (_3.º_ /
  _3.ª_) and the short forms _1.er_ / _3.er_ before a noun. A free-standing ordinal would be
  _3.º_.
- **Dates and times in emails** arrive formatted (_23 de octubre de 2026 a las 20:00 CEST_,
  _viernes, 23 de octubre, 20:00 CEST_) and follow _el_; no time-zone word is added.
- Discord command descriptions are 61 and 64 characters (the limit is 100).

## 4. Please review

Problems in the source that a translation cannot fix:

- The pace choices in the game-creation form (shared components) are still English ("Fast · moves
  within an hour"); game cards, game tables and the lobby filter now show the Spanish names.
- `delete_account_summary`, `delete_account_kept_finished`, `games_vote_undo_yourself` — quote
  two labels in English, because that is how players see them: "Deleted player N", which the game
  data stores, and the "Undo" button of the game screens. Both become translatable once the game
  data and the game screens are translated; the Spanish names would then be _Jugador eliminado N_
  and _Deshacer_, with no English left in these three messages.
- `games_card_hotseat` — left as _Hotseat_ because the game-creation form (shared components)
  still says "Hotseat". Spanish options once that form is translated: _Pasar y jugar_,
  _Mismo dispositivo_.
- `email_account_email_change_requested_preview`, `email_account_password_reset_requested_preview`
  — the English ends "…is verified on {time}" and "…for your account on {time}", but `{time}` is
  when the request was made. Spanish says so: _El {time} se solicitó…_
- `email_bug_report_forum` and the other `email_bug_report_*` — the rest of that email (its
  heading, its text and the first sentence of the footer) is written in English by the
  bug-report tool and is not in the catalogue, so a Spanish reader gets a mixed email.

Terms with competing usages:

- `nav_pay_it_forward`, `content_pif_heading`, `content_pif_page_title`,
  `content_pif_pass_it_on`, `content_pif_other_charities`, `content_landing_small_print` — "pay
  it forward" as _Cadena de favores_, with _sigue la cadena_ / _sumarte a la cadena de favores_
  for the verb.
- `tournaments_bracket_bye` — _Bye_ kept as tournament players say it. Alternatives: _Exento_,
  _Pase directo_, _Sin rival_.
- `tournaments_bracket_walkover` — _Retirada_: on this site a walkover always follows a
  withdrawal, and the label sits in a very narrow column. Alternatives: _W. O._,
  _Incomparecencia_.
- `tournaments_bracket_heading`, `tournaments_bracket_whole`, `tournaments_bracket_load_failed`
  — bracket as _cuadro_; Latin American readers may prefer _llave_.
- `tournaments_format_knockout`, `tournaments_format_knockout_tournament` — _Eliminatoria_ /
  _Torneo eliminatorio_; alternative _Eliminación directa_ (in Latin America _eliminatorias_
  can also mean qualifiers).
- `tournaments_knockout_round_match`, `tournaments_bracket_your_match`,
  `tournaments_detail_games_per_match`, `tournaments_form_knockout_help`,
  `tournaments_scoring_knockout` — match as _duelo_.
- `leagues_season_name_seeding`, `leagues_sign_up_seeding_explanation` — seeding as
  _posicionamiento_. Alternatives: _clasificatoria_, _siembra_.
- `leagues_sign_up_held_explanation`, `leagues_sign_up_place_held`, `leagues_my_place_held`,
  `leagues_group_substitute` — a held place as _plaza_ (against _puesto_ for rank). Latin
  American alternatives: _lugar_, _cupo_.
- `games_vote_ask_to_undo`, `games_vote_confirm_undo`, `games_vote_send_request`,
  `games_call_ask_end`, `games_call_ask_everyone`, `games_tab_title_answer` — ask / request as
  _proponer_ / _propuesta_ rather than _pedir_ / _solicitud_.
- `games_card_called`, `games_card_conceded`, `games_card_stalling`, `games_card_stalled`,
  `games_call_offer_call` — _Por acuerdo_, _Por rendición_, _Inactiva_, _Estancada_,
  _Dar por terminada la partida_.
- `pace_relaxed_name` and the messages built on it — Relaxed as _Relajado_. Alternatives:
  _Pausado_, _Tranquilo_.
- `pace_fast_line` and the other `pace_*_line` — "within 1 h" as _en menos de 1 h_ (_dentro de
  1 h_ would mean "an hour from now"). Alternative: _máx. 1 h_.
- `pace_fast_past_limit` and the other `pace_*_past_limit` — "Past the 1 h pace" as _Fuera del
  ritmo de 1 h_, after the set phrase _fuera de ritmo_. Alternative: _Más lento que el ritmo de
  1 h_.
- `nav_report_bug`, `nav_report`, `games_report_title`, `games_report_send` and the other
  report strings — _reportar_ / _reporte_ **(regional)**.
- `library_series_tab_lobby` — _Sala_; alternative: keep _Lobby_.
- `tournaments_schedule_heading` and the other schedule strings — schedule as _calendario_,
  although it is a table plan without dates; scheduling as _programación_.
- `content_stats_even_odds`, `content_stats_key_even_odds`, `content_stats_win_rate_meter` —
  "even odds" as _igualdad de probabilidades_.
- `library_series_18xx_description` — "rusts their fleet" as _oxide su flota_, the calque 18xx
  players use.
- `tournaments_knockout_champion`, `tournaments_knockout_runner_up` — generic masculine
  _Campeón_ / _Subcampeón_ shown beside any player's name. The results emails do the same
  (`email_standings_champion`, `email_standings_champions`: _Campeón_, _Campeones_).

Emails, notifications and bots:

- All `email_*`, `notification_*` and `push_*` news sentences — present perfect (_te ha
  invitado_, _ha empezado_, _se ha unido_) **(regional)**; Latin American alternative: simple
  past (_te invitó_, _empezó_, _se unió_).
- `email_player_removed_subject_removed`, `email_player_removed_preview_removed`,
  `email_player_removed_subline_removed` — "was removed" as _ha quedado fuera de_, because the
  literal passive agrees with the player (_fue retirado_ / _retirada_). It says less plainly
  than the English that an administrator did it. Alternative: _Se ha retirado a {player} de…_,
  which needs the stand-in _Un jugador_ reworded.
- `notification_undo_vote_summary`, `notification_undo_vote_heading`, `push_undo_vote_title` —
  "asks to go back" as _propone deshacer jugadas_, with the site's verb for undo. Alternative:
  _propone volver atrás_.
- `notification_open_dashboard_button` — "Open dashboard" as _Ir a Mis partidas_, the name the
  site gives that page.
- `email_game_started_subject`, `email_game_started_eyebrow` — _Partida iniciada_. Alternative:
  _Empieza la partida_.
- `email_tournament_results_finished_average_place`, `email_tournament_results_finished_wins`
  and the five `email_league_season_results_*` sentences — the place as _en el puesto {place}_
  with a bare number (`email_ordinal`). Alternative: _en el puesto {place}.º_.
- `email_league_season_name`, `email_league_season_name_seeding` — lowercase (_temporada 2_,
  _temporada de posicionamiento_) because the subject, the preview and the heading line all
  place them mid-sentence (_Fin de la temporada 2_).
- `email_standings_column_wins` — _Vict._, to fit the column. Alternative: _V_, as in the
  league tables of the site.
- `email_unnamed_player` — "A Player" as _Jugador sin nombre_; it replaces a missing username
  in name lists and in the results table.
- `discord_command_notify_description`, `discord_command_stop_description` — _Activa_ /
  _Desactiva las notificaciones de turnos e invitaciones a partidas_ instead of a literal
  _Notifica_ / _Deja de notificar_.
- `email_tournament_results_shared_champion`, `email_tournament_results_champion` —
  _¡Felicidades!_

Labels shortened to fit:

- `dashboard_tab_following` — _Sigo_. _Siguiendo_ is the usual label, but with _Estadísticas_
  the four tabs overflow phones 360–375 px wide (the tab row does not wrap).
- `games_card_answer_request`, `library_entry_answer_request` — _Responder_ (English "Answer
  Request"), to keep the card's corner button narrow; the browser-tab title keeps
  _Responder propuesta_.
- `tournaments_detail_avg_place`, `leagues_group_average_place_abbr` — _Prom._;
  `leagues_group_games_column` — _Part._; `leagues_group_tiebreak_abbr` — _Des._;
  `leagues_group_substitute_abbr` — _Supl._; `content_stats_all_badge` — _Todo_.
- `content_stats_outcome_letter_won`, `…_tied`, `…_lost` — _V_, _E_, _D_.

Small liberties:

- `auth_invitation_heading` — _¿Te unes a esta partida?_ without the trailing "...".
- `auth_onboarding_token_sent`, `auth_onboarding_send_new_token` — "token" as _código_, the word
  the other verification messages use.
- `auth_email_placeholder` — _nombre@ejemplo.com_.
- `telegram_offer` — _Iniciar_ is the label of Telegram's Start button in Spanish.
- `content_landing_load_failed`, `library_series_shelf_load_failed` — "the game shelf" as
  _los juegos_ (_estantería_ / _estante_ / _librero_ differ by region).
- `email_game_invitation_subject`, `email_game_invitation_preview` — "Join {owner}'s game of
  {title}" as _{owner} te invita a una partida de {title}_, which avoids _de … de_.
- `email_game_end_subject` — _Partida terminada: {game} ({title})_, built like the subject of
  the game-started email.
- `email_verification_preview` — _Tu código de verificación es {code}_ without "email", so the
  code shows in the inbox preview.
- `push_player_declined_title` — "Player declined" as _Invitación rechazada_.
- `telegram_connected_as`, `telegram_connected` — "You're connected" as _Este chat ya está
  conectado a la cuenta {username}_ / _a tu cuenta_, like `telegram_not_linked`.
- `email_league_season_start_moved_up` — present tense (_Subes al nivel {level}… jugadores que
  no siguen esta temporada_), which sidesteps the regional choice of past tense.
- `email_league_season_start_merged` — "has joined Level {level}" as _se ha integrado en el
  nivel {level}_.
