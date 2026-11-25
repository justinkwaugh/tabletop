# Portuguese (`pt`) glossary

For the native speakers reviewing `messages/pt.json`. One file serves players in Brazil and in
Portugal, so the text is written to read naturally in both wherever the language allows. Where
the two variants cannot share a word or a construction, the file uses Brazilian Portuguese;
section 4 lists every such place with the European Portuguese (pt-PT) form.

## 1. Form of address and tone

- **Third person singular ("você" forms) with the pronoun left out**: `Escolha um jogo`,
  `É a sua vez`, `Tente novamente`. This is how Brazilian apps address the player, and it is also
  the neutral formal address of Portuguese software, where an explicit "você" sounds foreign. The
  word "você" appears only where a pronoun is the whole label (3 keys, see section 4). No "tu".
- Possessives take the article inside sentences (`a sua conta`, `o seu perfil`): required in
  Portugal, natural in Brazil. Obvious possessives are dropped (`antes de alterar a senha`).
- Plain, friendly, short. "Please" is not translated: `Tente novamente.` Buttons are infinitives
  (`Enviar`, `Criar torneio`), instructions are imperatives (`Escolha`, `Insira`), headings and
  labels are in sentence case.
- "Could not …" is `Não foi possível …`; "We couldn't …" is `Não conseguimos …`; "BoardTogether
  couldn't …" is `O BoardTogether não conseguiu …`.
- Nothing has to agree with a runtime name. Statuses and sentences about a player use verbs or
  nouns instead of participles: `{name} saiu`, `Substitui {name}`, `entrou`, `recusou`,
  `A retirada de {name}`, `Vitória de {winners}`, `Venceu o torneio`. Game names are introduced
  as `A partida {name}`. Invitations to act avoid gendered adjectives (`Seja a primeira pessoa a
entrar`, `Que tal uma partida?`, `Boas-vindas!`, `Agora não` for "No thanks").
- Constructions that differ between the variants are avoided rather than chosen: no
  "estar + gerúndio" / "estar a + infinitivo" (`em curso`, simple present), no first-person
  plural past of -ar verbs (`enviamos` / `enviámos` → `foi enviado`, `Não conseguimos`), no clitic
  at the start of a sentence, `num` / `numa`, no "já não" / "não … mais" (`deixou de`), no "ter
  (a) certeza" (`Quer mesmo …?`), no "precisar (de) + infinitivo".

## 2. Terms

### Playing

| English                                        | Portuguese                                    | Note                                                                                |
| ---------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------- |
| title (a game in the library)                  | jogo                                          | `Escolha um jogo`, `Todos os jogos`; `title_count` is "{count} jogos"               |
| game (a table being played)                    | partida                                       | `Minhas partidas`, `Começar uma partida`; `played_game_count` is "{count} partidas" |
| library / game shelf / series                  | biblioteca / estante de jogos / série         |                                                                                     |
| table / open table                             | mesa / mesa aberta                            |                                                                                     |
| seat / open seat                               | lugar / lugar vago                            |                                                                                     |
| host, owner                                    | anfitrião                                     | English uses both words for the same role                                           |
| player / opponent                              | jogador / adversário                          | Generic masculine                                                                   |
| your turn / take your turn                     | É a sua vez / Jogar agora                     | Compound nouns use "turno": `Notificações de turno`                                 |
| next turn (menu)                               | Próxima jogada                                |                                                                                     |
| move / last action                             | jogada / última ação                          |                                                                                     |
| start a game / start game (host)               | Começar uma partida / Iniciar partida         | Two verbs: creating the table, then launching it                                    |
| join / joined / leave / decline                | Entrar / entrou, Já entrou / Sair / Recusar   | "entrar em" has the same preposition in both variants                               |
| enter / play game / continue                   | Abrir / Jogar / Continuar                     | "Enter" opens a game you are already in                                             |
| watch / revisit                                | Assistir / Rever                              |                                                                                     |
| follow / following / unfollow                  | Seguir / Seguidas (tab) / Deixar de seguir    | State on the bookmark: `Segue esta partida`                                         |
| pace                                           | ritmo                                         |                                                                                     |
| Live, Fast, Brisk, Daily, Relaxed (pace names) | Ao vivo, Rápido, Acelerado, Diário, Tranquilo | See review note 13                                                                  |
| within 1 h / past the 1 h pace                 | até 1 h / Ritmo de 1 h ultrapassado           | See review note 14                                                                  |
| hotseat / mode / local                         | Hotseat / modo / local                        | Loanword kept; see review note 5                                                    |
| game options / standard                        | opções de jogo / padrão                       |                                                                                     |
| score (column) / best score                    | pontos / melhor pontuação                     |                                                                                     |
| winner / tied / no winner                      | vencedor / empate / sem vencedor              | Verb family "vencer", not "ganhar"                                                  |
| shared win, joint winners                      | vitória dividida                              |                                                                                     |
| undo / ask to undo                             | desfazer / pedir para desfazer                | The game's own button is quoted as “Undo”; see review note 15                       |
| agree / decline / withdraw (request)           | Concordar / Recusar / Retirar                 |                                                                                     |
| concede / conceded                             | desistir / Desistência                        |                                                                                     |
| call the game / called                         | Encerrar por acordo / Por acordo              | See review note 3                                                                   |
| stalling / stalled / abandoned                 | Sem jogadas / Parada / Abandonada             | See review note 4                                                                   |
| finished (game)                                | terminada                                     | "in progress": `em curso`                                                           |
| explorations                                   | explorações                                   |                                                                                     |
| lobby / looking for players                    | Lobby / À procura de jogadores                |                                                                                     |

### Tournaments and leagues

| English                                 | Portuguese                                       | Note                                                          |
| --------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| competitions / tournament / league      | competições / torneio / liga                     |                                                               |
| registration, sign-up                   | inscrições                                       | open / closed / full: `abertas` / `fechadas` / `esgotadas`    |
| sign up / join tournament               | Inscrever-se / Entrar no torneio                 | Roster counts: `Inscritos: {roster}`                          |
| closing date / the close                | data de encerramento / encerramento              | Verb: `as inscrições fecham`                                  |
| withdraw (own sign-up)                  | Cancelar inscrição                               |                                                               |
| withdraw a player / withdrawn / dropped | retirar, retirada / Saiu / sai                   |                                                               |
| substitute                              | substituto; `Substitui {name}` (abbr. `Sub`)     |                                                               |
| roster / roster locked                  | lista de jogadores / Jogadores definidos         |                                                               |
| draft                                   | rascunho                                         |                                                               |
| schedule                                | mesas                                            | `Pré-visualizar mesas`, `Mesas sorteadas`; see review note 10 |
| scheduling                              | agendamento                                      |                                                               |
| draw                                    | sorteio                                          |                                                               |
| knockout / mini / multi-stage           | eliminatório / mini, minitorneio / várias etapas |                                                               |
| bracket                                 | eliminatórias                                    | Neutral for BR "chave" and PT "quadro"; see review note 9     |
| round (knockout) / stage                | fase / etapa                                     | Avoids BR "rodada" vs PT "ronda"; see review note 8           |
| match (two games and a decider)         | confronto                                        | Kept apart from "partida" (one game)                          |
| decider                                 | partida decisiva                                 | Labels `P1`, `P2`, `D` for G1, G2, D                          |
| tiebreak                                | desempate (abbr. `Des.`)                         | Kept apart from the decider                                   |
| bye / walkover / to be decided          | Bye / W.O. / A definir                           | See review note 6                                             |
| champion / runner-up / out in …         | Venceu o torneio / Segundo lugar / Caiu em …     | See review note 20                                            |
| standings, ranking                      | classificação                                    |                                                               |
| place (rank) / average place            | posição / posição média (`Méd.`, `Pos. média`)   |                                                               |
| place (a league slot held for you)      | vaga                                             | Kept apart from "lugar" (seat)                                |
| wins / points                           | vitórias (`V`) / pontos (`Pts`)                  | Record letters W/T/L: `V` / `E` / `D`                         |
| void                                    | anulada                                          |                                                               |
| season / level / group                  | temporada / nível / grupo                        |                                                               |
| seeding (season)                        | nivelamento                                      | See review note 11                                            |
| ladder / pyramid                        | escada / pirâmide                                | See review note 12                                            |
| promoted / relegated                    | sobe de nível / desce de nível                   | Neutral for BR "rebaixamento" vs PT "despromoção"             |
| manage (admin menu)                     | Administrar                                      | Neutral for BR "gerenciar" vs PT "gerir"                      |

### Account, notifications, site

| English                        | Portuguese                                              | Note                                                          |
| ------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------- |
| sign in / sign out / sign up   | Entrar / Sair / Criar conta                             | "the sign-in page": `página de login`                         |
| username                       | nome de jogador                                         | See review note 1                                             |
| password / reset password      | senha / redefinir senha                                 | See section 4                                                 |
| email                          | e-mail                                                  |                                                               |
| verification code, token       | código de verificação                                   | One word for both                                             |
| link / unlink (an account)     | associar / desassociar                                  | `Contas associadas`                                           |
| connect / disconnect           | conectar / desconectar                                  | See section 4                                                 |
| delete                         | apagar                                                  | Used by Apple in both variants; avoids "excluir" / "eliminar" |
| preferences / settings         | preferências / configurações                            | See section 4                                                 |
| turn notifications / reminders | notificações de turno / lembretes de turno              |                                                               |
| reminder hours                 | horas de lembrete                                       |                                                               |
| time zone                      | fuso horário                                            |                                                               |
| report (content) / a report    | denunciar / denúncia                                    |                                                               |
| report a bug / a bug report    | reportar um bug / relato de bug                         |                                                               |
| screenshot                     | imagem                                                  | Avoids "captura de tela" / "captura de ecrã"                  |
| (opens in a new) tab           | janela                                                  | Avoids "aba" / "separador"                                    |
| refresh, reload                | atualizar / recarregar a página                         |                                                               |
| stats / win rate / even odds   | estatísticas / taxa de vitórias / probabilidades iguais | See review note 19                                            |
| win streak                     | sequência de vitórias                                   |                                                               |
| pay it forward / pass it on    | Passe adiante / faça o bem circular                     | See review note 2                                             |
| charity                        | instituição de caridade                                 |                                                               |
| open source / free to play     | código aberto / grátis                                  |                                                               |

Kept in English: BoardTogether, Board Together, Tabletop (page titles), game titles, Discord,
Telegram, Google, GitHub, BG Stats, Tiltify, charity names, `/stop`, `/notify`, webhook, bot,
bug, link, online, feedback, design, spam, bullying.

Quoted in English, exactly as the player sees them: two labels that the site itself still shows
in English. A message that points at one of them gives the English text inside “…”, so that the
player can find it on the screen, never a translated name.

- **“Deleted player 1”, “Deleted player 2”, …**: the name a deleted account's seats take in
  finished games; it is stored in the game data. The first mention carries a gloss in the
  glossary's own word for delete: `“Deleted player” (jogador apagado)`.
- **“Undo”**: the button on the game screens, which are not translated yet. It is introduced as
  `o botão “Undo”` and has no gloss, because the sentence already says "desfazer".

The verb and the site's own controls stay Portuguese (`desfazer`, `Pedir para desfazer até aqui`).

## 3. Typography and formatting

- Spelling follows the 1990 agreement, which both countries use (`ação`, `atual`, `projeto`,
  `selecionada`). Words that still differ are avoided or listed in section 4.
- Quotation marks “…”, ellipsis `…`, en dash in ranges (`{min}–{max} jogadores`). Separators
  `·`, `→`, `←` are unchanged. Unit after a space: `há {count} min`, `Começa em {seconds} s`.
- **Plurals match the exact value 1 instead of the CLDR categories.** For `pt`, CLDR puts 0 in
  the category `one` ("0 jogo", the Brazilian school rule); Portugal writes "0 jogos", and so do
  Brazilian interfaces in practice. Every plural is therefore written as
  `"selectors": ["count"], "match": { "count=1": "…jogo", "count=*": "…jogos" }`, which
  Paraglide compiles to an equality test: 1 is singular, 0 and everything else plural, in both
  variants. To go back to CLDR, declare `local countPlural = count: plural` and use
  `countPlural=one` / `countPlural=*`.
- A plural was added where English has none but Portuguese must agree: `create_game_open_tables`,
  `content_stats_scope_option`, `content_stats_scope_summary`, `content_stats_month_tooltip`,
  `leagues_format_sign_up_automatic`, `leagues_format_sign_up_by_administrator`,
  `leagues_list_card_format`, `leagues_roster_signed_up`, `leagues_sign_up_count_signed_up`,
  `leagues_sign_up_count_confirmed_or_signed_up`, `leagues_sign_up_more_needed`.
- Where several counts sit in one line, a label with a colon replaces agreement:
  `Terminadas: {finished} · Em curso: {active} · À espera: {waiting}`, `Inscritos: {roster}`.
- Counts are inserted as they are (`{count}`), not as `{count: number}`: grouping differs
  ("1.234" in Brazil, "1 234" in Portugal) and no count here reaches five digits.
- Ordinals are spelled out (`Segundo lugar`), so "2º" (Brazil) vs "2.º" (Portugal) never shows.
- Hours are written without an article (`É válido até {time}`; `As inscrições fecham em {date}`,
  where `{date}` arrives as "25 de nov., 14:00"), which avoids "à 1:05" / "às 15:30".

## 4. Where a pt-PT file would differ

These are the places where no shared wording exists and the Brazilian form was used. Each line
gives the Brazilian form, the pt-PT form, and the keys.

- **senha** → palavra-passe. 21 keys: `auth_password`, `profile_password`, `auth_new_password`,
  `auth_password_show`, `auth_password_hide`, `auth_title_reset_password`,
  `auth_title_password_reset`, `auth_page_title_reset_password`, `auth_login_forgot_password`,
  `auth_login_use_username`, `auth_login_failed`, `auth_forgot_intro`, `auth_forgot_link_sent`,
  `auth_reset_success`, `auth_reset_failed`, `auth_reset_set_password`,
  `auth_reauth_password_rejected`, `auth_reauth_no_method`,
  `auth_reauth_request_change_password`, `auth_reauth_confirmed_change_password`,
  `delete_account_removed_identity`.
- **salvar, Salvando…** → guardar, A guardar…: `saving`, `leagues_manage_save`,
  `leagues_form_save_draft`, `tournaments_form_save_draft`, `tournaments_schedule_save`,
  `tournaments_correction_save`, `preferences_save_failed`, `time_zone_save_failed`,
  `leagues_form_save_failed`, `leagues_save_sign_up_policy_failed`,
  `tournaments_form_save_failed`, `tournaments_schedule_save_failed`,
  `tournaments_schedule_roster_locked_note`.
- **Progress labels in "-ando…"** (Carregando…, Enviando…, Entrando…, Apagando…, Criando…,
  Confirmando…, Adicionando…, Preparando…, Configurando…) → "A carregar…", "A enviar…", "A
  entrar…" and so on: `library_loading`, `library_loading_games`, `loading_game_library`,
  `dashboard_loading_games`, `dashboard_loading_followed`, `dashboard_history_loading`,
  `content_stats_loading`, `create_game_loading_titles`, `library_competitions_loading`,
  `tournaments_loading`, `tournaments_form_loading_titles`, `leagues_form_loading_titles`,
  `games_card_loading_game`, `auth_signing_in`, `auth_join_joining`, `auth_signup_creating`,
  `auth_forgot_sending`, `auth_reauth_confirming`, `games_bug_report_adding`,
  `games_bug_report_sending`, `delete_account_deleting`, `tournaments_schedule_preparing`,
  `web_notifications_setting_up`.
- **configurações** → definições: `delete_account_removed_settings`,
  `web_notifications_blocked_help`, `topic_registrations_load_failed`,
  `discord_webhook_unsupported`, `discord_webhook_instructions`,
  `leagues_save_sign_up_policy_failed`.
- **conectar, desconectar, conectado** → ligar, desligar, ligado:
  `notification_channel_disconnect`, `discord_webhook_connect`, `discord_bot_connected`,
  `telegram_connected`, `discord_bot_disconnect_failed`, `discord_webhook_disconnect_failed`,
  `telegram_disconnect_failed`, `discord_webhook_instructions`, `telegram_offer`.
- **Você** → Tu: `games_player_you`, `games_card_winner_you_and_others`, `content_stats_you_won`.
- **Minhas partidas, Meus** → As minhas partidas, Os meus: `nav_my_games`,
  `dashboard_page_title`, `dashboard_tabs_label`, `library_series_created_unlisted`,
  `tournaments_tab_mine`.
- **Semifinais, Quartas de final** → Meias-finais, Quartos de final:
  `tournaments_knockout_semi_finals`, `tournaments_knockout_quarter_finals`,
  `tournaments_knockout_semi_final_match`, `tournaments_knockout_quarter_final_match`,
  `tournaments_knockout_in_semi_finals`, `tournaments_knockout_in_quarter_finals`,
  `tournaments_knockout_out_in_semi_finals`, `tournaments_knockout_out_in_quarter_finals`.
- **Tela de Início, menu Compartilhar** (the iOS names) → ecrã principal, menu Partilhar:
  `web_notifications_unsupported`.
- **marrom, cinza** → castanho, cinzento: `content_color_brown`, `content_color_gray`.
- **no seu ritmo** → ao seu ritmo: `content_landing_intro`, `content_landing_page_description`.
- **app** → aplicação: `preferences_bg_stats_help`, `discord_webhook_unsupported`.
- **arrecadado** → angariado: `content_pif_raised_by_players`, `content_pif_raised_so_far`.

## 5. Please review

1. **Username → "nome de jogador"** (`auth_username`, `profile_username`, `auth_username_placeholder`,
   `profile_username_placeholder`, `auth_username_exists`, `profile_username_exists`,
   `auth_login_use_username`, `auth_login_failed`, `nav_username_not_assigned`,
   `delete_account_type_username`, `delete_account_removed_identity`, `games_bug_report_privacy`,
   `tournaments_replace_username_placeholder`). Chosen because "nome de usuário" is Brazil-only and
   "nome de utilizador" Portugal-only. Is it clear enough on the sign-in form?
2. **Pay it forward → "Passe adiante"** (`nav_pay_it_forward`, `content_pif_heading`,
   `content_pif_page_title`, `content_landing_small_print`, `content_pif_other_charities`), and
   "Pass it on instead." → "Em vez disso, faça o bem circular." (`content_pif_pass_it_on`).
   Portuguese has no shared idiom; Brazil would recognise "corrente do bem".
3. **Call the game → "Encerrar por acordo", Called → "Por acordo"** (`games_call_offer_call`,
   `games_card_called`). The request itself reads "pede para encerrar a partida".
4. **Stalling → "Sem jogadas", Stalled → "Parada"** (`games_card_stalling`, `games_card_stalled`).
   "Parada" also labels a game that ended because nobody moved.
5. **Hotseat** kept as a loanword (`games_card_hotseat`); the alternative is "Mesmo dispositivo".
6. **Bye, W.O.** kept as the hobby's loanwords (`tournaments_bracket_bye`,
   `tournaments_bracket_walkover`); Portugal also says "isento" and "falta de comparência".
7. **Lobby** kept (`library_series_tab_lobby`).
8. **Knockout round → "fase", stage → "etapa"** (`tournaments_knockout_round`,
   `tournaments_knockout_round_match`, `tournaments_knockout_in_round`,
   `tournaments_knockout_out_in_round`, `tournaments_bracket_rounds_label`,
   `tournaments_bracket_whole`, `tournaments_scoring_knockout`, `tournaments_detail_stages`,
   `tournaments_format_multi_stage`, `tournaments_format_multi_stage_tournament`). Chosen to avoid
   "rodada" (Brazil) vs "ronda" (Portugal); "fase" would otherwise be the natural word for stage.
9. **Bracket → "Eliminatórias"** (`tournaments_bracket_heading`, `tournaments_bracket_load_failed`).
10. **Schedule → "Mesas"** (`tournaments_schedule_heading`, `tournaments_schedule_preview_heading`,
    `tournaments_schedule_preview`, `tournaments_schedule_save`, `tournaments_detail_schedule_ready`,
    `tournaments_detail_awaiting_schedule`). The schedule is the drawn list of tables and seats, not
    a list of dates, so "calendário" was avoided.
11. **Seeding → "Nivelamento"** (`leagues_season_name_seeding`, `leagues_sign_up_seeding_explanation`).
12. **Ladder → "escada"** (`leagues_shape_ladder`, `library_competitions_ladder_league`,
    `leagues_format_shape_ladder`). Is this what club ladders are called where you play?
13. **Pace names** (`pace_live_name`, `pace_fast_name`, `pace_brisk_name`, `pace_daily_name`,
    `pace_relaxed_name`; repeated in the filter options `library_pace_daily_or_faster`,
    `library_pace_brisk_or_faster`, `library_pace_fast_or_faster`, `library_pace_live`): "Ao vivo",
    "Rápido", "Acelerado", "Diário", "Tranquilo", fastest first, all agreeing with "ritmo".
    "Relaxed" is "Tranquilo" because "relaxado" also means "sloppy" in Brazil. Does "Acelerado"
    (4 h) read as slower than "Rápido" (1 h)?
14. `pace_fast_line`, `pace_brisk_line`, `pace_daily_line`, `pace_relaxed_line`: "within 1 h" is
    "até 1 h" and "within a day" is "até 1 dia", which avoids the Brazil-only "em até".
    `pace_live_past_limit`, `pace_fast_past_limit`, `pace_brisk_past_limit`,
    `pace_daily_past_limit`, `pace_relaxed_past_limit`: "Past the 1 h pace" is "Ritmo de 1 h
    ultrapassado"; "ultrapassado" is meant as "exceeded" but can also mean "outdated", and
    "excedido" is the alternative.
15. **“Deleted player” and “Undo” are quoted in English** (`delete_account_summary`,
    `delete_account_kept_finished`, `games_vote_undo_yourself`), because that is what the player
    sees: the name is stored in the game data and the button belongs to the game screens, and
    neither is translated yet. These three messages become translatable once the game data and
    the game screens are translated; they should then quote the Portuguese labels (for example
    “Jogador apagado 1” and `o botão “Desfazer”`) and drop the gloss. Until then, is one gloss
    enough: "(jogador apagado)" on the first mention only, and none on “Undo”?
16. `content_stats_you_won` / `content_stats_they_won` → "Você venceu" / "Adv. venceu". The table
    header does not wrap, so the second one is abbreviated.
17. Width: `nav_my_games` ("Minhas partidas") is the top-bar button on every page, and the four
    dashboard tabs (`dashboard_tab_current`, `dashboard_tab_following`, `dashboard_tab_history`,
    `dashboard_tab_stats`) do not wrap. Both should be checked on a narrow phone.
18. `auth_onboarding_oops` keeps "Oops…" (Brazil says "Ops", Portugal "Ups").
19. **Even odds → "probabilidades iguais"** (`content_stats_even_odds`, `content_stats_key_even_odds`,
    `content_stats_win_rate_meter`). Brazil might prefer "chances iguais".
20. `tournaments_knockout_champion` → "Venceu o torneio" and `tournaments_knockout_runner_up` →
    "Segundo lugar", to avoid "Campeão / Campeã".
21. `library_series_18xx_description`: "locomotiva" and "linhas" stand in for trem / comboio and
    trilhos / carris, which differ between the variants.
22. `content_pif_pass_it_on_body` says "jogos digitais" for video games (videogames / videojogos);
    `content_pif_special_effect_description` and `content_pif_pass_it_on_wide` say "equipamentos
    adaptados" for adapted controllers (controles / comandos).
23. `tournaments_correction_heading` ("Correct tournament credit") → "Corrigir resultado para o
    torneio"; the credited winners are "os vencedores que contam para o torneio".
24. `tournaments_replace_with` / `tournaments_replace_withdraw`: the legend "Substituir por" is
    answered by "Substituto" or "Ninguém (retirar)".
25. `content_pif_us_charity` / `content_pif_uk_charity` are shortened to "Dos EUA" / "Do Reino
    Unido" to fit the pill beside the logo.
26. `leagues_closing_now`, `leagues_closes_in_minutes`, `leagues_closes_in_hours`,
    `leagues_closes_in_days`: "Fecham em …" in the plural, with "as inscrições" understood.
