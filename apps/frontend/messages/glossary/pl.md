# Polish (pl) — translation glossary

For the native-speaker reviewer of `messages/pl.json`. Source of truth: `messages/en.json`.

## 1. Form of address and tone

- **Informal second person singular ("ty")**, as on Polish board-gaming sites and consumer apps:
  _Zaloguj się_, _Wybierz tytuł_, _Sprawdź pocztę_.
- **Pronouns of address are capitalised** inside sentences (_Twoja tura_, _wyślemy Ci_, _dla
  Ciebie_), the usual courtesy in Polish apps. If the team prefers lower case, it is a mechanical
  change.
- **No gendered forms about the user.** No _-łeś/-łaś_, no _pewien/pewna_, _zapisany/zapisana_.
  Used instead: present tense (_Tak, poddaję grę_), impersonal _-no/-to_ (_Dołączono_,
  _Wycofano_, _zaproszono_), nouns (_odmowa_, _awans_, _spadek_), or a rephrase (_Jesteś już w
  tej grze_, _Jesteś na liście zapisanych_, _Otwórz listę!_ for "Be the first").
- **Names are never inflected.** Player, game, league and series names stay in the nominative,
  through a colon (_Ruch: {player}_, _Wygrana: {winners}_, _gospodarz: {name}_, _za: {name}_) or
  apposition (_Gracz {name} …_, _gry gracza {name}_, _do gry „{name}”_, _serię {name}_). Verbs
  next to a bare name are in the present or future tense, which carry no gender (_{name} prosi
  o…_, _{name} nie dowie się…_). Where a past tense is unavoidable it agrees with _gracz_
  (_Gracz {name} został wycofany_).
- "We couldn't…" / "BoardTogether couldn't…" → impersonal _Nie udało się…_. "Please try again"
  → _Spróbuj ponownie_ (no _proszę_).
- Tone: plain and friendly, no marketing language: _Masz ochotę na partyjkę?_, _Rozkładamy
  gry…_, _Dołóż swoją cegiełkę_.

## 2. Terms

| English                                      | Polish                                                                   | Note                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| game (one play)                              | gra                                                                      | _partia_ only in the GIPF series blurb                                |
| title                                        | tytuł                                                                    |                                                                       |
| N games (titles in a series, or plays)       | N gier (1 gra, 2 gry, 5 gier)                                            | same word in `title_count` (titles), `played_game_count` (plays)      |
| library / series / shelf                     | biblioteka (gier) / seria / półka                                        |                                                                       |
| table                                        | stół                                                                     | _otwarte stoły_                                                       |
| seat (lobby)                                 | miejsce                                                                  | _wolne miejsce_, _Zajęte miejsca: 2 z 4_                              |
| seat (tournament schedule)                   | pozycja                                                                  | _Pozycja 1_, _pozycje startowe_; avoids reading "Miejsce 1" as a rank |
| place (rank, league spot)                    | miejsce                                                                  | _średnie miejsce_, _Twoje miejsce na poziomie B_                      |
| host / owner                                 | gospodarz                                                                |                                                                       |
| player / opponent                            | gracz / przeciwnik                                                       | with 2–4: _2 graczy_ (as in _dwóch graczy_)                           |
| N-player                                     | N-osobowa / N-osobowe                                                    | _4-osobowa_, _grupy 5-osobowe_                                        |
| turn                                         | tura                                                                     | _Twoja tura_, _Rozegraj turę_, _Następna tura_                        |
| move / last action                           | ruch / ostatni ruch                                                      |                                                                       |
| pace                                         | tempo                                                                    | names: _Na żywo, Szybkie, Żwawe, Dzienne, Spokojne_ (neuter)          |
| within 1 h / a day / 3 days (pace)           | w ciągu 1 godz. / w ciągu doby / w ciągu 3 dni                           | chip: _Szybkie · 1 godz._                                             |
| past the pace                                | Wolniej niż ustalone tempo (1 godz.)                                     | _przekroczone tempo_ would read as playing too fast                   |
| start a game (create)                        | Załóż grę                                                                | _Gra założona_                                                        |
| start game (begin play)                      | Rozpocznij grę / Start                                                   |                                                                       |
| join / leave / decline                       | Dołącz / Opuść / Odrzuć                                                  | status _Dołączono_, table full _Komplet_                              |
| enter / watch / revisit                      | Wejdź / Oglądaj / Przejrzyj                                              |                                                                       |
| follow / following / unfollow                | Obserwuj / Obserwowane, Obserwujesz / Przestań obserwować                |                                                                       |
| undo                                         | cofnąć, cofnięcie                                                        | in-game button quoted in English: _przyciskiem „Undo”_                |
| concede / conceded                           | Poddaj grę / Poddana                                                     |                                                                       |
| call the game / called                       | Zaproponuj zakończenie gry / Za zgodą graczy                             |                                                                       |
| stalling / stalled                           | Zamiera / Zamarła                                                        |                                                                       |
| agree / decline / withdraw (vote)            | Zgódź się / Odmów / Wycofaj                                              | tally _Zgoda: 2 z 4_                                                  |
| in progress / finished                       | W toku / Zakończona (gra), Zakończony (turniej, sezon), Zakończone (tab) |                                                                       |
| tournament / league / season / group / level | turniej / liga / sezon / grupa / poziom                                  |                                                                       |
| mini / knockout / multi-stage                | Mini, Miniturniej / Pucharowy, Turniej pucharowy / Wieloetapowy          |                                                                       |
| stage / round / match                        | etap / runda / mecz                                                      |                                                                       |
| final, semi-final, quarter-final             | finał, półfinał, ćwierćfinał                                             |                                                                       |
| decider                                      | dogrywka                                                                 | label _D_; games _G1_, _G2_                                           |
| tiebreak                                     | tie-break                                                                | abbreviation _TB_                                                     |
| split match                                  | remis w meczu                                                            |                                                                       |
| shared win / place, joint winners            | ex aequo                                                                 | _Zwycięzcy ex aequo_                                                  |
| bracket                                      | drabinka                                                                 |                                                                       |
| ladder / pyramid (league shape)              | Drabina, Liga drabinkowa / Piramida, Liga piramidowa                     | "shape" = _Struktura_                                                 |
| promoted / relegated                         | Awans / Spadek                                                           |                                                                       |
| seeding                                      | rozstawienie                                                             |                                                                       |
| bye / walkover                               | wolny los / walkower                                                     |                                                                       |
| draw                                         | losowanie                                                                |                                                                       |
| registration (tournament), sign-up (league)  | zapisy                                                                   | _Zapisy otwarte_, _Zapisz się_, _Wypisz się_                          |
| sign up (account)                            | Zarejestruj się / Załóż konto                                            |                                                                       |
| roster                                       | lista graczy                                                             | _Lista graczy zamknięta_, _Zapisani: 5 / 8_                           |
| held place                                   | zarezerwowane miejsce                                                    |                                                                       |
| substitute                                   | zastępca, zastępstwo                                                     | abbreviation _Zast._                                                  |
| withdraw (league/tournament)                 | Wycofaj się / Wycofanie / Wycofano                                       |                                                                       |
| knocked out                                  | wyeliminowany; _Odpada w półfinale_                                      |                                                                       |
| champion / runner-up                         | 1. miejsce / 2. miejsce                                                  |                                                                       |
| void                                         | unieważniona                                                             |                                                                       |
| draft                                        | szkic                                                                    |                                                                       |
| schedule / scheduling                        | harmonogram / planowanie gier                                            |                                                                       |
| ranking, standings                           | klasyfikacja                                                             |                                                                       |
| scoring / score (tournament) / score (game)  | punktacja / punkty / wynik                                               |                                                                       |
| wins, points, average                        | Wygrane (W), Punkty (Pkt), Śr.                                           |                                                                       |
| won / tied / lost                            | wygrana / remis / przegrana                                              | letters _W / R / P_                                                   |
| win rate / even odds / win streak            | odsetek wygranych / równe szanse / seria wygranych                       |                                                                       |
| preferences                                  | Ustawienia                                                               |                                                                       |
| notifications / reminders                    | powiadomienia / przypomnienia                                            | web = _w przeglądarce_                                                |
| sign in / sign out                           | Zaloguj się / Wyloguj się                                                |                                                                       |
| username / password / email                  | nazwa użytkownika / hasło / e-mail, adres e-mail                         |                                                                       |
| verification code, token                     | kod weryfikacyjny                                                        | one word for both English terms                                       |
| link / unlink, connect / disconnect          | Połącz / Odłącz                                                          |                                                                       |
| report (content) / bug report                | Zgłoś, zgłoszenie / zgłoszenie błędu                                     |                                                                       |
| pay it forward                               | Podaj dobro dalej                                                        | bare _Podaj dalej_ reads as "retweet/share"                           |
| charity                                      | organizacja charytatywna                                                 |                                                                       |
| Terms of Service / Privacy Policy            | Regulamin / Polityka prywatności                                         |                                                                       |
| Alpha / Beta                                 | Alfa / Beta                                                              |                                                                       |
| Lobby                                        | Lobby                                                                    |                                                                       |

Left in the original: BoardTogether / Board Together (never inflected), Tabletop, game titles, Google,
GitHub, BG Stats, Tiltify, Gamers Outreach, SpecialEffect, `/stop`, `/notify`, URLs, _open source_,
_webhook_, _bot_. Discord, Telegram and GitHub take Polish endings where grammar needs them (_na
Discordzie_, _w Telegramie_, _na GitHubie_).

Quoted in English, inside „…”, because that is what players see for now: the name a deleted
account's seats get in finished games („Deleted player 1”, „Deleted player 2”… – stored in the game
data) and the game's „Undo” button (the game screens are not translated yet). A Polish name there
would point players at a label they will not find. `delete_account_summary` adds the gloss
_(usunięty gracz)_; `games_vote_undo_yourself` needs none beside _cofnąć_.

## 3. Typography and formatting

- Quotation marks „…”, ellipsis … (one character), dash – (en dash with spaces) where English has
  an em dash, including page titles (_Moje gry – Board Together_). Separators " · ", "→", "←" kept.
- Plurals: all four categories (one / few / many / other). Plural selectors were added where
  English has plain text but Polish needs agreement (`create_game_open_tables`,
  `content_stats_scope_option`, `content_stats_scope_summary`, `leagues_group_finished_of_total`,
  `leagues_sign_up_more_needed`). Counts in a summary line use a label and colon instead
  (_zakończone: 3 · w toku: 1_, _Zapisani: 5_), which needs no agreement; four English plurals
  became plain text that way or as an adjective (`games_card_seat_count` _{count}-osobowa_,
  `library_series_show_more`, `tournaments_games_finished`, `tournaments_schedule_games_finished`).
- Dates, times, percentages and money arrive already formatted in Polish; sentences put them
  after a colon or where the abbreviated form reads correctly (_Zamknięcie zapisów: 25 lis,
  14:00_). A month with its year arrives in the nominative (_listopad 2026_), so it follows a
  colon too, never a preposition (_pierwsza: listopad 2026_, not _od listopad 2026_).
- `{count: number}` is not used: Polish groups digits only from 10 000 up, beyond any count here.
- Units: _5 min temu_, _3 godz. temu_, _Start za 5 s_, _w ciągu 4 godz._, _3 dni_.
- Sentence case throughout (English Title Case labels are not copied). Small all-caps headings
  stay in capitals (_GRACZE_, _WYNIK_).
- `auth_email_placeholder` is a Polish-style sample address (_nazwa@domena.pl_).

## 4. Please review

- `games_card_stalling`, `games_card_stalled` — _Zamiera_ / _Zamarła_ for a game going idle and one ended for idleness; alternative _Zastój_
- `games_call_offer_call`, `games_card_called` — "Call the game" has no set Polish term: _Zaproponuj zakończenie gry_, result label _Za zgodą graczy_
- `tournaments_detail_tiebreak`, `leagues_group_tiebreak_abbr`, `tournaments_tiebreak_*` — _tie-break_ (TB) kept; alternatives _punkty pomocnicze_, _małe punkty_
- `tournaments_knockout_decider*`, `tournaments_form_decider` — _dogrywka_ for the third, deciding game
- `tournaments_bracket_heading`, `leagues_shape_ladder`, `library_competitions_ladder_league` — _drabinka_ (bracket) next to _Drabina_ / _Liga drabinkowa_ (ladder) are close in sound
- `tournaments_knockout_champion`, `tournaments_knockout_runner_up` — _1. miejsce_ / _2. miejsce_ chosen over _Mistrz_ / _Wicemistrz_ to avoid gender
- `tournaments_schedule_seat`, `tournaments_schedule_each_seat`, `tournaments_seated_option_help` — tournament "seat" as _pozycja_, while the lobby uses _miejsce_
- `tournaments_bracket_legend`, `tournaments_scoring_knockout`, `tournaments_form_knockout_help` — "one game from each side" read as each player playing each side once (_po jednej każdą stroną_)
- `tournaments_schedule_waiting_capacity` — "Waiting for player capacity" explained as _Czeka, aż gracze skończą inne gry_
- `games_card_hotseat` — _Hot seat_ kept; alternatives _Gorące krzesła_, _Na jednym urządzeniu_
- `pace_*_name`, `library_pace_*` — _Spokojne_ added for "Relaxed" beside _Na żywo_, _Szybkie_, _Żwawe_, _Dzienne_ (neuter, agreeing with _tempo_); alternatives _Niespieszne_ for "Relaxed", _Dobowe_ for "Daily"
- `pace_*_past_limit` — "Past the 1 h pace" as _Wolniej niż ustalone tempo (1 godz.)_; _Przekroczone tempo_ sounds like playing too fast, _Przekroczony czas na ruch_ like a hard time limit
- `content_stats_since_month` — the month arrives in the nominative, which _od_ cannot take, so "since {month}" is _pierwsza: listopad 2026_ (the first finished game); alternative _od: listopad 2026_
- `games_card_explorations_heading` — _EKSPLORACJE_; alternative _ANALIZY_
- `delete_account_summary`, `delete_account_kept_finished`, `games_vote_undo_yourself` — „Deleted player” / „Deleted player 1” and „Undo” are quoted in English, as players see them today; they become translatable (_Usunięty gracz_, _Cofnij_) once the game data and the game screens are translated
- `telegram_offer` — Telegram's own button is written _Start_; the Polish Telegram app may label it differently
- `discord_webhook_instructions`, `discord_webhook_unsupported` — Discord menu names _Integracje_ and _Webhooki_ written from memory of the Polish client
- `nav_pay_it_forward`, `content_pif_*` — _Podaj dobro dalej_ for "Pay it forward"
- `content_stats_all_badge` — _Wsz._ must fit a 36 px badge
- `content_pif_us_charity`, `content_pif_uk_charity` — shortened to the country (_USA_, _Wielka Brytania_) to fit the pill beside the logo
- `games_player_status_joined` — _przy stole_ for "joined", gender-free
- `content_landing_welcome` — _Masz ochotę na partyjkę?_ for "Care to play a game?"
- `auth_invitation_heading` — English "Join this game?..." → _Dołączyć do tej gry?_ without the ellipsis
- `submit` — one key serves send, save and confirm forms: _Wyślij_
