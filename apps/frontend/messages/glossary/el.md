# Greek (el) glossary

For the native-speaker reviewer of `messages/el.json`. Modern Greek, monotonic.

## 1. Form of address and tone

- **Informal singular (εσύ)** everywhere, including security and error texts: «Δοκίμασε ξανά», «Επιβεβαίωσε ότι είσαι εσύ». It is what Greek hobby communities and consumer apps with a friendly voice use (Discord, Skroutz, efood), and it matches the plain English.
- **The site speaks as «εμείς»**: «Δεν μπορέσαμε να…», «Θα σου στείλουμε…». The product is neuter: «το BoardTogether».
- **Buttons**: standard commands are action nouns, as Greek software does (Αποθήκευση, Ακύρωση, Υποβολή, Κλείσιμο, Διαγραφή, Σύνδεση, Εγγραφή, Συμμετοχή, Απόσυρση). Calls to action and links are singular imperatives (Ξεκίνα ένα παιχνίδι, Εξερεύνησε τη βιβλιοθήκη, Πήγαινε στο παιχνίδι, Δήλωσε συμμετοχή).
- **No «παρακαλώ»**: "Please try again" is «Δοκίμασε ξανά».
- **Sentence case** for headings and labels; English Title Case is not copied.
- **Gender**: neutral wording where Greek allows it (verb forms such as «Αποσύρθηκε», «Κέρδισε», «Κάνε εσύ την αρχή», «Ναι, σίγουρα»). Role nouns use the generic masculine (Νικητής, Πρωταθλητής, οικοδεσπότης, αναπληρωματικός).
- **Names in sentences**: a placeholder name never has to be declined. Either a colon or label structure («Αποσύρθηκε: {name}», «Σχεδιασμός: {designer}», «με νικητή: {winner}»), or apposition («Ο παίκτης {name}…», «Ο χρήστης {name}…»), or a bare username before the verb in the compact vote banner («{name} ζητά αναίρεση…»). Game names go in «» after «το παιχνίδι».

## 2. Terms

### Playing

| English                                           | Greek                                              | Note                                                                                                                                           |
| ------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| game (one play of a title)                        | παιχνίδι                                           | «παρτίδα» only for BG Stats "plays"; `title_count` (titles in a series) and `played_game_count` (finished games in Stats) both say «παιχνίδια» |
| title                                             | τίτλος                                             |                                                                                                                                                |
| library / shelf / series                          | βιβλιοθήκη / ράφι / σειρά (παιχνιδιών)             |                                                                                                                                                |
| lobby                                             | λόμπι                                              |                                                                                                                                                |
| table / open table                                | τραπέζι / ανοιχτό τραπέζι                          |                                                                                                                                                |
| seat / open seat                                  | θέση / ελεύθερη θέση                               | «Πάρε θέση» for "Take a seat"                                                                                                                  |
| host, game owner                                  | οικοδεσπότης                                       | one word for both                                                                                                                              |
| player / opponent                                 | παίκτης / αντίπαλος                                |                                                                                                                                                |
| turn / your turn                                  | σειρά / η σειρά σου                                | «σειρά» is also "series"; turn strings always say «η σειρά σου»                                                                                |
| move, action                                      | κίνηση                                             | "Last action" = «Τελευταία κίνηση»                                                                                                             |
| round                                             | γύρος                                              |                                                                                                                                                |
| pace                                              | ρυθμός                                             |                                                                                                                                                |
| pace names: Live / Fast / Brisk / Daily / Relaxed | Ζωντανά / Γρήγορος / Γοργός / Ημερήσιος / Χαλαρός  | masculine, agreeing with «ρυθμός»; «Ζωντανά» is an adverb                                                                                      |
| within 1 h / past the 1 h pace                    | εντός 1 ώρας / εκτός του ρυθμού της 1 ώρας         | filter: «Γρήγορος ή ταχύτερος»                                                                                                                 |
| join / leave / decline (invitation)               | συμμετοχή / αποχώρηση / απόρριψη                   |                                                                                                                                                |
| enter, play game (open a game you play in)        | άνοιγμα (παιχνιδιού)                               | «Είσοδος» avoided: it reads as "log in"                                                                                                        |
| watch (spectate)                                  | παρακολούθηση                                      |                                                                                                                                                |
| follow / following / unfollow                     | ακολουθώ / το ακολουθείς / άρση ακολούθησης        | kept apart from "watch"                                                                                                                        |
| revisit (a finished game)                         | ανασκόπηση                                         |                                                                                                                                                |
| continue (carry a finished game into a new one)   | συνέχεια                                           |                                                                                                                                                |
| undo / undo request                               | αναίρεση / αίτημα αναίρεσης                        |                                                                                                                                                |
| vote: agree / decline / withdraw                  | Συμφωνώ / Αρνούμαι / Απόσυρση                      |                                                                                                                                                |
| concede                                           | παραίτηση, παραιτούμαι                             | chess usage                                                                                                                                    |
| call the game / called                            | λήξη με συμφωνία                                   | ending early by a vote                                                                                                                         |
| abandoned                                         | εγκαταλείφθηκε                                     |                                                                                                                                                |
| stalling / stalled                                | βαλτώνει / βάλτωσε                                 |                                                                                                                                                |
| winner / tied / no winner                         | νικητής / ισοπαλία / χωρίς νικητή                  |                                                                                                                                                |
| hotseat / local                                   | Hotseat / τοπικά                                   |                                                                                                                                                |
| exploration                                       | εξερεύνηση                                         |                                                                                                                                                |
| game options / standard                           | επιλογές παιχνιδιού / κανονικές, κανονικό παιχνίδι |                                                                                                                                                |
| bug report / report (content)                     | αναφορά σφάλματος / αναφορά                        |                                                                                                                                                |
| pay it forward                                    | πέρνα το καλό παρακάτω                             | nav label: «Πέρνα το παρακάτω»                                                                                                                 |
| charity                                           | φιλανθρωπική οργάνωση                              |                                                                                                                                                |

### Tournaments and leagues

| English                                  | Greek                                         | Note                                        |
| ---------------------------------------- | --------------------------------------------- | ------------------------------------------- |
| competitions                             | διοργανώσεις                                  | tournaments and leagues together            |
| tournament / league / season             | τουρνουά / λίγκα / σεζόν                      |                                             |
| mini / knockout / multi-stage            | μίνι / νοκ άουτ / πολλών φάσεων               |                                             |
| format / stage                           | μορφή / φάση                                  |                                             |
| registration, sign-up (to a competition) | δηλώσεις συμμετοχής; «Δήλωσε συμμετοχή»       | «εγγραφή» is kept for creating an account   |
| roster                                   | συμμετοχές, αριθμός συμμετεχόντων             |                                             |
| draw                                     | κλήρωση                                       |                                             |
| schedule / scheduling                    | πρόγραμμα / προγραμματισμός                   |                                             |
| bracket                                  | ταμπλό                                        |                                             |
| match                                    | αγώνας                                        | a knockout match is two games and a decider |
| decider                                  | μπαράζ                                        | labels: Π1, Π2 (games), Μ (decider)         |
| bye                                      | χωρίς αντίπαλο                                |                                             |
| walkover                                 | άνευ αγώνα                                    |                                             |
| knocked out                              | αποκλείστηκε                                  |                                             |
| final / semi-finals / quarter-finals     | τελικός / ημιτελικοί / προημιτελικοί          |                                             |
| champion / runner-up                     | πρωταθλητής / φιναλίστ                        |                                             |
| group                                    | όμιλος                                        |                                             |
| level (league tier)                      | κατηγορία                                     | the sports word for a division              |
| ladder / pyramid                         | σκάλα / πυραμίδα                              | «Λίγκα σκάλας», «Λίγκα πυραμίδας»           |
| promoted / relegated                     | άνοδος / υποβιβασμός; ανεβαίνουν / πέφτουν    |                                             |
| seeding (season)                         | αρχική κατάταξη                               |                                             |
| ranking / standings                      | κατάταξη / βαθμολογία                         |                                             |
| place (rank) / average place             | θέση / μέση θέση                              | same word as "seat"; context separates them |
| score / points / scoring                 | σκορ / βαθμοί / βαθμολόγηση                   |                                             |
| tiebreak                                 | κριτήριο ισοβαθμίας                           | column «Ισοβαθμία», abbreviation «Ισοβ.»    |
| substitute / withdraw / withdrawn        | αναπληρωματικός / απόσυρση / αποσύρθηκε       |                                             |
| void (game)                              | άκυρο                                         |                                             |
| draft                                    | πρόχειρο                                      |                                             |
| W / T / L                                | Ν / Ι / Η                                     | Νίκες, Ισοπαλίες, Ήττες                     |
| Pts / Avg / TB / Sub                     | Βαθ. / Μ.Ο. / Ισοβ. / Αναπλ.                  |                                             |
| win rate / even odds / win streak        | ποσοστό νικών / ίσες πιθανότητες / σερί νικών |                                             |

### Account and notifications

| English                                                   | Greek                                                 | Note                                  |
| --------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------- |
| sign in / sign up / sign out                              | σύνδεση / εγγραφή / αποσύνδεση                        |                                       |
| link / unlink (an account)                                | σύνδεση λογαριασμού / κατάργηση σύνδεσης              | «Αποσύνδεση» would read as "sign out" |
| connect / disconnect (a channel)                          | σύνδεση / αποσύνδεση                                  |                                       |
| username / password                                       | όνομα χρήστη / κωδικός πρόσβασης                      |                                       |
| email                                                     | email                                                 | Latin, neuter, not declined           |
| verification code, token                                  | κωδικός επαλήθευσης                                   | one word for both                     |
| notifications / reminders                                 | ειδοποιήσεις / υπενθυμίσεις                           |                                       |
| web notifications                                         | ειδοποιήσεις στο πρόγραμμα περιήγησης                 | browser = «πρόγραμμα περιήγησης»      |
| preferences / settings                                    | προτιμήσεις / ρυθμίσεις                               |                                       |
| bot, webhook, URL, spam, online                           | unchanged                                             | as Greek users write them             |
| Discord: direct message / server / mention / Integrations | άμεσο μήνυμα / διακομιστής / αναφέρω / «Ενσωματώσεις» | Discord's own Greek interface         |
| iOS: Home Screen / Share                                  | οθόνη Αφετηρίας / «Κοινή χρήση»                       | Apple's Greek                         |

Left in English on purpose: BoardTogether, Board Together, Tabletop (page titles), game and charity names, BG Stats, Alpha, Beta, `/stop`, `/notify`.

## 3. Typography and formatting

- Quotation marks «…» with no inner space. Question mark `;`. Ano teleia `·` where English has a semicolon. Ellipsis `…` (also where English types `...`). Elision with `’`: γι’ αυτό, απ’ όσα.
- Separators `·`, `—`, `→`, `←` kept. Ranges with an en dash: «2–4 παίκτες».
- All-caps strings carry no accents (ΠΑΙΚΤΕΣ, ΣΚΟΡ, ΕΠΙΛΟΓΕΣ ΠΑΙΧΝΙΔΙΟΥ). Labels the site upper-cases with CSS are written in normal case; the page sets `lang="el"`, so the browser drops the accents itself.
- Plurals: `one` and `other` everywhere. Plural variants were **added** where English has one string but Greek needs agreement (`create_game_open_tables`, `content_stats_scope_option`, `content_stats_scope_summary`, `leagues_roster_signed_up`, `leagues_sign_up_more_needed`, `leagues_format_sign_up_*`, `leagues_list_card_format`). Where a count has no plural input, the text is built so that it needs none («Ολοκληρώθηκαν: {finished} · Σε εξέλιξη: {active}», «Συμμετοχές: {roster}», «νίκες: {wins}»).
- Numbers: `{count: number}` (1.234) in the six game and opponent counts that can pass a thousand. Percentages, dates and times arrive formatted by the page («58%», «1 Νοε, 11 π.μ.», «3:30 μ.μ.», «Νοέμβριος 2026»).
- A placeholder that carries a clock time is never the last word before a full stop, because Greek times end in «π.μ.» / «μ.μ.» and would give «..» (`tournaments_registration_closes_on` and its three siblings use a dash instead; Greek is a 12-hour language, so their deadline still arrives as «25 Νοε, 2 μ.μ.», without minutes). Dates take «έως {date}» or a colon rather than «στις», which would not agree with the first of the month.
- A month arrives in the nominative with its year («Νοέμβριος 2026»), so it follows a colon rather than a preposition: «από: {month}», «πρώτη ολοκλήρωση: {month}».
- Short time units are abbreviated like the English ones: «πριν από 5 λεπ.», «πριν από 3 ώρ.», «Ξεκινά σε 30 δευτ.», and the pace chip «Γρήγορος · 1 ώρ.». Where the hour stands in the genitive it is written out («εντός 4 ωρών», «του ρυθμού της 1 ώρας»), because «ώρ.» cannot show the case. Days, weeks, months and years are written out.
- Strings that are lower-case in English because they sit inside a line (player status, the stats facts line, colour names) stay lower-case.

## 4. Please review

Terms with more than one defensible Greek form:

- `nav_pay_it_forward`, `content_pif_heading`, `content_pif_page_title`, `content_pif_pass_it_on`, `content_pif_other_charities`, `content_landing_small_print`: "pay it forward" has no set Greek phrase. I used «Πέρνα το καλό παρακάτω», shortened to «Πέρνα το παρακάτω» in the header. Alternatives: «Δώσ’ το παρακάτω», «Ανταπόδωσε το καλό».
- `games_card_stalling`, `games_card_stalled`: «Βαλτώνει» / «Βάλτωσε» is vivid and slightly colloquial. Neutral alternative: «Σε αδράνεια» / «Στάσιμο».
- `games_call_offer_concede`, `games_card_conceded`, `games_call_yes_concede`, `games_call_concede_confirm`: «παραίτηση» follows chess sites. «Εγκατάλειψη» was avoided because "Abandoned" is «Εγκαταλείφθηκε».
- `games_call_offer_call`, `games_card_called`: "call the game" as «Λήξη με συμφωνία».
- `tournaments_bracket_bye`: «Χωρίς αντίπαλο» instead of the loanword «μπάι».
- `leagues_level` and every "Level" string: «Κατηγορία» rather than «Επίπεδο».
- `tournaments_detail_tiebreak`, `leagues_group_tiebreak_abbr`: «Ισοβαθμία» and «Ισοβ.» as short headers for «κριτήριο ισοβαθμίας». The loanword «τάι μπρέικ» is the alternative.
- `games_card_revisit`, `library_entry_revisit`: «Ανασκόπηση». Plainer: «Προβολή».
- `games_card_enter`, `games_card_play_game`, `library_entry_enter`: «Άνοιγμα», «Άνοιγμα παιχνιδιού».
- `dashboard_tab_following`, `nav_following_game`, `games_card_unfollow`: «Ακολουθώ», «Το ακολουθείς», «Άρση ακολούθησης».
- `library_series_any`: «Αδιάφορο» for the "Any" filter value.
- `pace_live_name`, `library_pace_live`: «Ζωντανά», an adverb beside four adjectives. Alternatives: «Live», as Greek players say it, or «Σε πραγματικό χρόνο».
- `pace_brisk_name`: «Γοργός» for the pace between Fast (1 hour) and Daily. Alternatives: «Σβέλτος», «Ζωηρός».
- `pace_fast_line`, `pace_brisk_line`, `pace_daily_line`, `pace_relaxed_line`: under a game's name the pace is a masculine adjective without its noun («Γρήγορος · εντός 1 ώρας»). «Γρήγορος ρυθμός · εντός 1 ώρας» is clearer but longer on a phone card.
- `pace_*_past_limit`: «Εκτός του ρυθμού της 1 ώρας», the opposite of «εντός 1 ώρας». Alternatives: «Πέρα από τον ρυθμό της 1 ώρας», «Ξεπέρασε το όριο της 1 ώρας».
- `content_stats_since_month`: «από: Νοέμβριος 2026», with a colon because the month cannot be declined. Alternative: «Νοέμβριος 2026 – σήμερα».
- `tournaments_knockout_champion`: «Πρωταθλητής» (generic masculine). «Νικητής» is the alternative.
- `tournaments_replace_with`: the legend became «Τρόπος αντικατάστασης», because «Αντικατάσταση με» does not read with the option «Απόσυρση».
- `tournaments_correction_heading`, `tournaments_correction_winners_intro`, `tournaments_correction_winners_legend`: "credit" as «νικητές που προσμετρώνται».
- `tournaments_schedule_repeated_groups`: «Επαναλαμβανόμενες συνθέσεις» (the same players meeting again at a table).
- `content_stats_even_odds`, `content_stats_key_even_odds`, `content_stats_win_rate_meter`: "even odds" as «ίσες πιθανότητες».
- `games_report_reason_intimate_image`: «Προσωπικές εικόνες που κοινοποιήθηκαν χωρίς συναίνεση».
- `library_series_18xx_description`: 18xx jargon, «πριν το επόμενο τρένο σκουριάσει τον στόλο τους».

Text that depends on something this file does not control:

- `pace_*_name`, `library_pace_*`: game cards, the series table and its filter now use the Greek pace names. The create-game form still lists the paces in English ("Fast · moves within an hour"), because it comes from the shared component library. When that library is translated, it should use the same five names.
- `games_card_hotseat`: kept «Hotseat», the name the create-game form shows. A Greek name would be «Στην ίδια συσκευή».
- `games_card_explorations_heading`: «ΕΞΕΡΕΥΝΗΣΕΙΣ» should follow whatever the game screen calls its Explore mode.
- `delete_account_summary`, `delete_account_kept_finished`: "Deleted player 1" is the name stored in the game, so it is quoted in English with a Greek gloss.
- `games_vote_undo_yourself`, `telegram_offer`: they name buttons outside the site («κουμπί αναίρεσης (Undo)», «Έναρξη» (Start)).
- `leagues_page_title`, `leagues_detail_page_title`, `leagues_detail_page_title_loading`, `tournaments_page_title`, `tournaments_detail_page_title`: "Tabletop" left as in English.
- `nav_about_us`, `nav_my_games`, `nav_pay_it_forward`: header labels are longer than the English («Σχετικά», «Τα παιχνίδια μου», «Πέρνα το παρακάτω»). «Σχετικά» is also the About page heading; the page title says «Σχετικά με εμάς». Worth a look at widths between 768 and 900 px.
- `time_ago_minutes`, `time_ago_hours`, `start_countdown_seconds`, `pace_fast_summary`, `pace_brisk_summary`: abbreviations «λεπ.», «ώρ.», «δευτ.».
- `auth_email_placeholder`: «onoma@example.com».
