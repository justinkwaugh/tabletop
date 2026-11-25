# Hungarian (hu) glossary

For the native speaker reviewing `messages/hu.json` (the site and its push notifications) and
`libs/email/messages/hu.json` (emails, Discord and Telegram messages).

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
- Emails, push notifications, Discord and Telegram messages keep the same „te”. Emails speak as
  „mi” („töröltük”, „szólunk”, „Gratulálunk!”); the Discord and Telegram bots speak as „én”, as
  they do in English („Itt írok majd neked”).
- Email and bot buttons follow the site: „… megnyitása” for Open, first-person „Megnézem …” for
  View / See, „Szavazok” for Vote, „Lépek” for Take your turn.

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

### Emails, notifications and bots

| English                                    | Hungarian                                                      | Note                                                                     |
| ------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| on Board Together                          | a Board Together oldalon                                       | the name never takes a suffix; „oldal” carries it („oldalt”, „oldalról”) |
| BoardTogether account                      | BoardTogether-fiók / Board Together fiók                       | hyphen only after the one-word form                                      |
| verify, confirm (email) / reset (password) | megerősítés / visszaállítás                                    | as on the site; code: „ellenőrző kód”                                    |
| works for N minutes (code, link)           | a kéréstől számítva {minutes} percig érvényes                  |                                                                          |
| a request was made to … / … requested      | kérés érkezett … / …-t kérték                                  | „E-mail-cím módosítását kérték”                                          |
| was changed / was deleted / was removed    | megváltozott / töröltük / eltávolítottuk                       | English passives become an intransitive verb or „mi”                     |
| you can safely ignore this email           | nyugodtan hagyd figyelmen kívül ezt az e-mailt                 |                                                                          |
| please contact us                          | vedd fel velünk a kapcsolatot                                  | no „kérjük”                                                              |
| if the button does not work, open …        | Ha a gomb nem működik, nyisd meg ezt a linket: …               |                                                                          |
| invited you to play                        | meghívott játszani                                             | subject: „{owner} játszmára hív: {title}”                                |
| your {title} game {game}                   | a játszmád: {game} ({title})                                   | the title follows the game's name in brackets                            |
| game started / has ended                   | elkezdődött / véget ért                                        | subjects open with the verb: „Véget ért a játszmád: …”                   |
| won / tied (result line)                   | {names} nyert! / {names} döntetlent ért el                     | singular verb after a list of names                                      |
| waiting for {names}                        | {names} van soron                                              | the game card says „Soron van”                                           |
| turn notifications                         | értesítés, ha te jössz                                         | as the heading on the notifications page                                 |
| left / was removed (a player)              | kilépett, elhagyta / kikerült, eltávolítottuk                  |                                                                          |
| it will stop on their turn                 | meg fog állni, amikor ő kerül sorra                            |                                                                          |
| end the game early / Call the game (menu)  | idő előtt lezárni / „Játszma lezárása”                         | the menu item is quoted                                                  |
| final results / final standings            | végeredmény / végső állás                                      |                                                                          |
| champion / champions                       | bajnok / bajnokok                                              |                                                                          |
| Wins / Avg place (email table columns)     | Győz. / Átl. hely.                                             | the site has room for „Győzelmek”, „Átl. helyezés”                       |
| 1st, 2nd, 3rd (you finished 3rd)           | 1., 2., 3. („3. helyen végeztél”)                              | `email_ordinal` is „{place}.”                                            |
| takes / share first place                  | Az első helyen végzett: … / Megosztott első hely: …            |                                                                          |
| seeding season                             | besoroló szezon                                                |                                                                          |
| place is held / not confirmed yet          | a helyedet fenntartjuk / még nincs megerősítve                 | the level follows in brackets, as on the site                            |
| move up / move down / stay in (a level)    | feljutsz / kiesel / maradsz                                    | „…ide: {level} szint”, „…itt: {level} szint”                             |
| dashboard                                  | Játszmáim                                                      | the page's name on the site: „Játszmáim megnyitása”                      |
| joined / declined (a game invitation)      | csatlakozott / elutasította a meghívót                         |                                                                          |
| asks to end the game / to go back (votes)  | a játszma befejezését kéri / visszavonást kér                  | as in the site's vote banner                                             |
| {player}'s seat / take over a seat         | {player} helye / átveszi a helyét                              | unmarked possessor, the name stays uninflected                           |
| I'll message you here (bot)                | Itt írok majd neked                                            |                                                                          |
| type /stop, send /stop                     | a /stop paranccsal                                             | „parancs” carries the suffix, never the command                          |
| chat (Telegram)                            | csevegés                                                       |                                                                          |
| press Connect                              | nyomd meg a Csatlakoztatás gombot                              | the site's button label, capitalised, unquoted                           |
| stand-ins for a missing name               | Egy játékos, Valaki, Senki, A többi játékos, Nem elérhető fiók | capitalised: each opens a sentence or stands as a name                   |

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
- Email subjects, previews and notification lines put the event first and the names after a colon
  („Megnyílt a jelentkezés: {league}, {season}. szezon”, „Te jössz: {game}”). In a Discord channel
  post {game} is the title, a separator and a link, so it only ever ends a sentence or opens one as
  its subject.
- A list of names takes a singular verb („Alice és Bob nyert!”), so one wording serves one name and
  several.
- Dates and times in emails arrive formatted („október 23., péntek 20:00 CEST”) and stand after a
  colon: „…mielőtt a jelentkezés lezárul: {closes}”, „…megváltozott ekkor: {time}”.
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
- `email_standings_column_wins`, `email_standings_column_average_place` — „Győz.” and „Átl. hely.”
  are abbreviated to fit the 52 px and 64 px columns of the email table; „Gy” and „Átl.” are shorter
  still.
- `email_game_started_waiting`, `email_game_started_preview_waiting` — "Waiting for {names}" became
  „{names} van soron” ("it is {names}'s turn"), so the names need no suffix.
- `email_game_started_warning_button` — „Értesítések bekapcsolása”; "turn" is left to the heading
  above it („Nem kapsz értesítést, ha te jössz”).
- `email_player_removed_subject_removed`, `email_player_removed_preview_removed`,
  `email_player_removed_subline_removed` — "was removed" as „Eltávolítottunk egy játékost”,
  „kikerült a játszmádból” and „fiókját eltávolítottuk”.
- `email_game_end_result_draw` — „{names} döntetlent ért el”; „holtversenyben végzett” is the
  alternative for a tie among several players.
- `email_tournament_results_preview_takes` — with no champion it reads „Az első helyen végzett:
  Senki.”
- `email_league_season_results_promoted` and the other `email_league_season_results_*` — „feljutsz
  ide: {level} szint”. With Level A this is „A szint”, which can be read as "the level"; the site
  has the same wording.
- `email_league_season_name_seeding` — lower-case „besoroló szezon”: it only follows a colon or a
  comma.
- `email_league_season_start_moved_up` — "moved up" as „Feljutottál”, the word for promotion,
  although the place was not won.
- `email_bug_report_forum` — the forum's name „bug-reports” is left in English, as Discord shows it.
- `notification_lost_seat_heading` — turned round to „{player} kapta meg a helyedet egy
  adminisztrátortól”, to keep the name uninflected.
- `notification_discord_webhook_connected` — „{site}: ide érkeznek majd {username} értesítései.”, so
  no article stands before the site's name.
- `notification_was_invited_button`, `email_tournament_results_button`,
  `email_league_season_results_button`, `email_league_season_start_button` — "View / See" buttons as
  first-person „Megnézem …”, after the site's „Megnézem”.
- `discord_command_notify_description`, `discord_command_stop_description` — „Értesítés, ha te
  jössz, vagy ha meghívtak egy játszmába” / „Nincs több értesítés, …”; Discord's own commands use
  nouns of action („… leállítása”).
- `telegram_not_linked` — „csevegés” for a Telegram chat; check the word Telegram's Hungarian client
  uses.
- `push_took_over_seat_title` — „Csatlakoztál egy folyamatban lévő játszmához” is long for a
  notification title; „Beszálltál egy játszmába” is the shorter alternative.
