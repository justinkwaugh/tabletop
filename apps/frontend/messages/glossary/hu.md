# Hungarian (hu) glossary

For the native speaker reviewing `messages/hu.json`.

## 1. Form of address and tone

- **Informal singular (tegezés, „te”)** everywhere: „Próbáld újra”, „A játszmáid”, „Jelentkezz be”.
  This is the register of Hungarian board-gaming communities and of apps made for players (Discord,
  for one). No önözés, no plural „ti”.
- The site speaks as „mi” only where English says "we" („elküldtük”, „nem kérünk”). Failures are
  impersonal: „Nem sikerült betölteni…”.
- Buttons are nouns of action („Mentés”, „Csatlakozás”, „Törlés”). A first-person verb is used where
  the button is the player's own answer or decision: „Elfogadom”, „Elutasítom”, „Visszavonom”,
  „Lépek”, „Megnézem”, „Játszom”, „Igen, feladom”.
- Menu items for the player's own things are first person („Játszmáim”, „Következő köröm”); headings
  and running text are second person („A játszmáid.”).

## 2. Terms

### Games and tables

| English                           | Hungarian                          | Note                                                                         |
| --------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------- |
| game (a title: 1830, YINSH)       | játék                              | also for "title" („Válassz játékot”, „Összes játék”)                         |
| game (one play at a table)        | játszma                            | kept apart from „játék” on purpose; „parti” is the colloquial alternative    |
| game count: titles / plays        | „7 játék” / „7 játszma”            | `title_count` / `played_game_count`                                          |
| board game                        | társasjáték                        |                                                                              |
| library                           | játéktár                           | shelf: „játékpolc”                                                           |
| table / open table                | asztal / nyitott asztal            |                                                                              |
| seat / open seat                  | hely / szabad hely                 | lobby and invitations                                                        |
| seat (numbered, tournament table) | ülőhely                            | „1. ülőhely”, because „1. hely” reads as first place                         |
| host                              | házigazda                          |                                                                              |
| lobby                             | lobbi                              |                                                                              |
| pace                              | tempó                              | Live = Élő, Fast = Gyors, Brisk = Lendületes, Daily = Napi, Relaxed = Ráérős |
| within 1 h / 3 days (pace)        | 1 órán belül / 3 napon belül       | chip: „Gyors · 1 óra”; units are written out, as in „3 órája”                |
| past the 1 h pace                 | lassabb az 1 órás tempónál         | "slower than"; pace names are lower case in a sentence („az élő tempónál”)   |
| your turn                         | Te jössz                           | „Lépek” = Take your turn                                                     |
| turn / move                       | kör / lépés                        | „Utolsó lépés” = last action                                                 |
| game options                      | játékopciók                        | „opció”, so it is not confused with the site's „Beállítások”                 |
| standard (no options)             | alapbeállítás                      |                                                                              |
| undo                              | visszavonás                        | the game's own button is quoted as players see it: az „Undo” gomb            |
| concede                           | feladás                            |                                                                              |
| call the game / called            | játszma lezárása / „Megegyezéssel” | ending by agreement                                                          |
| stalling / stalled                | Akadozik / Elakadt                 |                                                                              |
| abandoned                         | félbemaradt                        |                                                                              |
| follow / watch / revisit          | követés / megnézem / visszanézés   |                                                                              |
| hotseat / local                   | Hotseat / helyi                    | kept in English, as gamers say it                                            |
| exploration                       | próbajátszma                       | a what-if copy of a game                                                     |
| invite link / game link           | meghívólink / játszmalink          |                                                                              |

### Tournaments and leagues

| English                              | Hungarian                                           | Note                                                   |
| ------------------------------------ | --------------------------------------------------- | ------------------------------------------------------ |
| competitions (umbrella)              | versenyek                                           |                                                        |
| tournament                           | torna                                               | minitorna, egyenes kieséses torna, többszakaszos torna |
| knockout                             | (egyenes) kieséses                                  |                                                        |
| league / season / group / level      | liga / szezon / csoport / szint                     | „A szint”, „B1 csoport”, „3. szezon”                   |
| ladder / pyramid                     | ranglétra / piramis                                 | „Ranglétra rendszerű liga”                             |
| stage / round                        | szakasz / forduló                                   |                                                        |
| match (knockout pairing)             | párharc                                             | not „meccs”: a match is two games                      |
| decider                              | rájátszás                                           | label „R”; „döntő” is kept for the final               |
| game label G1, G2                    | J1, J2                                              | „játszma”                                              |
| final / semi-finals / quarter-finals | döntő / elődöntő / negyeddöntő                      |                                                        |
| champion / runner-up                 | bajnok / 2. helyezett                               |                                                        |
| bracket                              | ágrajz                                              |                                                        |
| draw                                 | sorsolás                                            |                                                        |
| schedule (tables and seats)          | beosztás                                            |                                                        |
| scheduling (starting the games)      | ütemezés                                            |                                                        |
| registration (tournament)            | nevezés                                             | „Nevezés a tornára”, „Nevezz elsőként!”                |
| sign-up (league)                     | jelentkezés                                         | account sign-up is „regisztráció”                      |
| roster                               | mezőny (létszám)                                    |                                                        |
| standings                            | állás                                               |                                                        |
| ranking / scoring                    | rangsorolás / pontozás                              |                                                        |
| place (rank)                         | helyezés                                            | league spot is „hely”                                  |
| tiebreak                             | segédpont                                           | abbreviation „SP”                                      |
| seeding                              | besorolás                                           | „besoroló szezon”                                      |
| promoted / relegated                 | feljutott / kiesett                                 | go up / go down: feljut / kiesik                       |
| knocked out                          | kiesett                                             | same word as "relegated", different screens            |
| bye                                  | erőnyerő                                            |                                                        |
| walkover                             | játék nélkül                                        |                                                        |
| substitute                           | cserejátékos                                        | chip „Csere”; „Játékos cseréje” = Replace a player     |
| withdraw (yourself) / withdrawn      | visszalépés / visszalépett                          |                                                        |
| withdraw (admin removes a player)    | visszaléptetés                                      |                                                        |
| withdraw (your vote request)         | visszavonom                                         |                                                        |
| void                                 | érvénytelen                                         |                                                        |
| cancelled                            | törölve                                             |                                                        |
| draft                                | piszkozat                                           |                                                        |
| W / T / L                            | Gy / D / V                                          | győzelem, döntetlen, vereség                           |
| Pts / Avg / TB                       | Pont / Átl. / SP                                    |                                                        |
| win rate / even odds / win streak    | győzelmi arány / egyenlő esélyek / győzelmi sorozat |                                                        |

### Account and site

| English                                  | Hungarian                                          |
| ---------------------------------------- | -------------------------------------------------- |
| sign in / sign out / sign up             | bejelentkezés / kijelentkezés / regisztráció       |
| account / username / password            | fiók / felhasználónév / jelszó                     |
| email address                            | e-mail-cím                                         |
| verification code (also "token")         | ellenőrző kód                                      |
| preferences                              | beállítások                                        |
| notifications / reminders                | értesítések / emlékeztetők                         |
| link / unlink (accounts)                 | összekapcsolás / leválasztás                       |
| connect / disconnect (Discord, Telegram) | csatlakoztatás / kapcsolat bontása                 |
| direct message                           | közvetlen üzenet                                   |
| report (content) / bug report            | bejelentés / hibajelentés                          |
| Terms of Service / Privacy Policy        | Felhasználási feltételek / Adatvédelmi tájékoztató |
| pay it forward                           | add tovább („továbbadod a jót”)                    |
| charity                                  | jótékonysági szervezet                             |
| history / stats                          | előzmények / statisztika                           |

## 3. Typography and formatting

- Quotation marks „…”, ellipsis „…”, en dash with spaces for asides ( – ), en dash without spaces for
  ranges (2–4) and for the won–tied–lost record. Page titles use „ – ” where English has „ — ”.
- **No suffix ever follows a placeholder.** Names, numbers and dates stand after a colon
  („Győztes: {winners}”, „Váltás erre: {zone}”, „A nevezés lezárul: {date}”), as a subject
  („{name} visszalépett”), as an unmarked possessor („{winner} győzelmével”, „{name} dobozborítója”)
  or before a postposition („{name} helyett”, „{month} óta”).
- **No article before a number or name placeholder** (it would have to switch between „a” and „az”):
  „{number}. szezon megnyitása”, „Kiesett játékosok megjelenítése ({count})”.
- Nouns stay singular after numbers („5 játékos”, „3 játszma”), so most English plurals became plain
  strings. A plural selector is kept only where the wording really differs
  (`tournaments_detail_winners`, `tournaments_detail_show_knocked_out`,
  `tournaments_replace_withdrawn_in_progress`).
- Ordinals are a number and a full stop: „{round}. forduló”, „{table}. asztal”, „{number}. szezon”.
- Relative time uses possessive forms: „5 perce”, „3 órája”, „2 napja”, „1 hete”.
- Compounds with brand names take a hyphen: Discord-bot, Telegram-értesítések, Google-fiók.
  Multi-word names stay apart: „BG Stats alkalmazás”.
- Names kept in English: BoardTogether / Board Together, Tabletop, Discord, Telegram, Google, GitHub,
  BG Stats, Tiltify, charity names, /stop, /notify, URLs.
- Labels that players still see in English are quoted exactly as shown, inside „…”: the name
  „Deleted player 1” given to a deleted account's seats (it is stored in the game data) and the
  game's „Undo” button (with the article „az”). A lower-case gloss in brackets follows where the
  sentence does not already carry the meaning: „Deleted player” (törölt játékos).

## 4. Please review

- `pace_relaxed_name` — „Ráérős” for "Relaxed"; „Kényelmes” and „Laza” are the alternatives.
- `pace_brisk_name`, `library_pace_brisk_or_faster` — „Lendületes” for "Brisk"; „Pörgős” is the more
  colloquial alternative.
- `pace_live_past_limit`, `pace_fast_past_limit` and the other `pace_*_past_limit` — "Past the 1 h
  pace" became „Lassabb az 1 órás tempónál” ("slower than the 1-hour pace"); „túllépte a tempót”
  would read as going too fast.
- Stats chart axis (set in code, not a message) — months are still labelled „26. nov.”, with a
  two-digit year that reads as a day in Hungarian. The messages now receive „2026. november”.
- `delete_account_summary`, `delete_account_kept_finished`, `games_vote_undo_yourself` — two labels
  are quoted in English, because that is what players see: „Deleted player 1” is written into the
  game data in English, and the game screens label their button „Undo”. These become translatable
  („Törölt játékos 1”, „Visszavonás”) once the game data and the game screens are translated. The
  gloss „(törölt játékos)” stands once, in `delete_account_summary`; the „Undo” sentence needs none
  beside „visszavonhatod”.
- `telegram_offer` — „Start (Indítás)”: check what Telegram's Hungarian client shows on that button.
- `games_card_hotseat`, `games_card_player_local` — „Hotseat” left in English.
- `games_card_explorations_heading` — „PRÓBAJÁTSZMÁK” for "Explorations"; no established term.
- `games_card_called`, `games_call_offer_call` — "Called" / "Call the game" as „Megegyezéssel” /
  „Játszma lezárása”.
- `games_card_answer_request`, `library_entry_answer_request` — shortened to „Válaszolj” to fit the
  card button; the tab title says „Válaszolj a kérésre”.
- `games_card_take_your_turn` — „Lépek”.
- `tournaments_knockout_decider` and the „R” labels — „rájátszás” for "decider".
- `tournaments_detail_tiebreak`, `leagues_group_tiebreak_abbr`, `tournaments_tiebreak_*` — „segédpont”
  („SP”); „holtversenybontó” is the longer alternative.
- `tournaments_bracket_bye` — „Erőnyerő” stands in the empty slot of the bracket.
- `leagues_group_substitute_abbr`, `tournaments_replace_*` — „cserejátékos” / „Csere” rather than
  „helyettes”.
- `leagues_group_relegated`, `leagues_format_shape_*` — „kiesik / kiesett” for going down a level; the
  same word means "knocked out" in knockout tournaments.
- `leagues_season_name_seeding`, `leagues_sign_up_seeding_explanation` — „Besorolás”, „besoroló szezon”.
- `tournaments_schedule_repeated_groups` — „Ismétlődő asztaltársaságok”.
- `nav_pay_it_forward`, `content_pif_heading`, `content_pif_pass_it_on` — „Add tovább” / „Inkább add
  tovább másoknak.”; `content_landing_small_print` renders "No tip jar" as „Perselyünk nincs”.
- `library_series_tab_lobby` — „Lobbi”.
- `tournaments_replace_withdrawn_in_progress` — "was withdrawn" became „már visszalépett”, to keep the
  name uninflected.
