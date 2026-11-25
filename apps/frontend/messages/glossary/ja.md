# Japanese (ja) glossary

For the native-speaker review of `apps/frontend/messages/ja.json` (the site and its push
notifications) and `libs/email/messages/ja.json` (emails, Discord and Telegram messages).

## 1. Form of address and tone

- **Sentences use です・ます**; labels, buttons, tabs and column headers are short noun phrases or
  dictionary-form verbs (保存 / 閉じる / 参加 / ゲームを始める). Small buttons drop する (参加, 開始, 編集,
  観戦); primary calls to action keep the verb (参加する, エントリーする, アカウントを削除する).
- **The reader is not addressed with a pronoun** unless the sentence needs one; あなた is used only
  where "you/your" carries meaning (あなたの手番, あなたの枠, あなたの勝率) and for the label "You".
- **No さん after player names, anywhere.** Name placeholders also receive あなた, 管理者,
  不明なプレイヤー, "Deleted player 1" and comma-joined lists, so an honorific would misfire; this
  also matches how Board Game Arena's Japanese UI writes player names. If reviewers prefer さん in
  full sentences, it has to be added key by key (see "Please review").
- Errors: 「〜できませんでした。もう一度お試しください。」 Loading: 「〜を読み込み中…」. The site
  speaks as 当サイト / 私たち / 運営, never 弊社.
- Tone is friendly and plain, close to a hobby community site: 卓を立てる, 席につく, 満席, ゲーム棚,
  箱絵 are used on purpose.
- **Emails, bot messages and notifications follow the same rules**: です・ます, no さん, あなた only
  where "you/your" carries meaning (あなたの手番, あなたの席, あなたの枠, あなたは2位でした). An event
  that happened to the reader is told in the passive rather than with あなたを
  ({owner}からゲームに招待されました). The bots speak without a first-person pronoun
  (ここにメッセージを送ります), and "contact us" is 運営までご連絡ください.
- Security and "why you got this" lines use the standard polite email phrases:
  お心当たりがない場合は、このメールは無視していただいて問題ありません /
  このメールは、Board Togetherでこのゲームに参加した方にお送りしています。

## 2. Terms

### Games and tables

| English                                    | Japanese                             | Note                                                                                          |
| ------------------------------------------ | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| game (one play)                            | ゲーム                               | Counter: 3ゲーム (`played_game_count`). Not 局 (too Go/Shogi-specific for 18xx and wargames). |
| title (a game design)                      | タイトル                             | "{count} games" in the library or a series → {count}タイトル (`title_count`).                 |
| library / series / game shelf              | ライブラリ / シリーズ / ゲーム棚     |                                                                                               |
| table                                      | 卓                                   | 募集中の卓, 4人卓, 卓3, 卓を立てる. BGA says テーブル; 卓 is the hobby word and fits headers. |
| seat / open seat / full                    | 席 / 空席 / 満席                     | "Seat 2" → 席2.                                                                               |
| N players per game, N-player table         | N人卓                                | Label "Players per game" → 1ゲームの人数.                                                     |
| N games each                               | 1人Nゲーム                           |                                                                                               |
| host, game owner                           | ホスト                               | One term for both.                                                                            |
| player / opponent / You                    | プレイヤー / 対戦相手 / あなた       |                                                                                               |
| turn / your turn / take your turn          | 手番 / あなたの手番 / 手番を行う     | "Active Player" label → 手番.                                                                 |
| move / last action                         | 手 / 最後の手                        |                                                                                               |
| pace                                       | ペース                               | Names and limits in "Pace" below.                                                             |
| hotseat / local                            | ホットシート / ローカル              |                                                                                               |
| join / joined / leave (a game)             | 参加 / 参加済み / 退出               |                                                                                               |
| invite / invited / decline (invitation)    | 招待 / 招待中 / 辞退                 |                                                                                               |
| open games, looking for players            | 募集中のゲーム / プレイヤー募集中    |                                                                                               |
| in progress / finished / recently finished | 進行中 / 終了 / 最近終了             | "Completed" is also 終了.                                                                     |
| enter / watch / revisit / continue         | 入室 / 観戦 / 振り返る / 続ける      | Continue = start the follow-up game.                                                          |
| follow / following / unfollow              | フォロー / フォロー中 / フォロー解除 |                                                                                               |
| exploration                                | 検討                                 |                                                                                               |
| game options / standard                    | ゲームオプション / 標準              |                                                                                               |
| lobby                                      | ロビー                               |                                                                                               |
| winner / no winner / tied                  | 勝者 / 勝者なし / 引き分け           | Tournament winner → 優勝.                                                                     |
| stalling / stalled                         | 停滞中 / 停滞                        |                                                                                               |
| abandoned / cancelled                      | 中止                                 |                                                                                               |

### Pace

| English                                   | Japanese                      | Note                                                                   |
| ----------------------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| Live                                      | ライブ                        | Playing together now. BGA's word for this is リアルタイム.             |
| Fast                                      | 高速                          |                                                                        |
| Brisk                                     | サクサク                      | The gamers' word for play that keeps moving (サクサク進む).            |
| Daily                                     | デイリー                      |                                                                        |
| Relaxed                                   | ゆったり                      |                                                                        |
| within 1 h / within a day / within 3 days | 1時間以内 / 1日以内 / 3日以内 | Card line: 高速 · 1時間以内. The chip drops 以内: 高速 · 1時間.        |
| past the 1 h pace                         | 1時間のペースを超過           | A fragment like the English. Live names no time: ライブのペースを超過. |
| Daily or faster                           | デイリー以上の速さ            | Filter options; the fastest is just ライブ.                            |
| {pace} pace                               | ペース：{pace}                | ペース：サクサク.                                                      |

### Requests and votes

| English                                | Japanese                      | Note                                                                   |
| -------------------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| undo to an earlier point (vote)        | 巻き戻し                      | ここまでの巻き戻しを依頼. The player's own Undo button stays 「Undo」. |
| request / answer request               | リクエスト / リクエストに回答 |                                                                        |
| agree / decline / withdraw (a request) | 同意する / 断る / 取り下げる  |                                                                        |
| call the game / called                 | ゲーム終了を提案 / 合意終了   |                                                                        |
| concede / conceded                     | 投了                          |                                                                        |
| report (content) / report a bug        | 通報 / バグを報告             | 通報 for people and content, 報告 for bugs.                            |

### Tournaments and leagues

| English                                        | Japanese                              | Note                                                                             |
| ---------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------- |
| competitions (umbrella)                        | 大会                                  |                                                                                  |
| tournament / league                            | トーナメント / リーグ                 | トーナメント is the generic word here (as on BGA, Lichess), not "knockout".      |
| mini / knockout / multi-stage                  | ミニ / ノックアウト / マルチステージ  |                                                                                  |
| registration, league sign-up                   | エントリー                            | 受付中 / 受付終了 / 締切. Account sign-up is 登録.                               |
| roster / roster size / roster locked           | 参加者 / 定員 / 参加者確定            | "{roster} joined" → 5 / 8人参加.                                                 |
| minimum / maximum players                      | 最少人数 / 最大人数                   |                                                                                  |
| draft                                          | 下書き                                |                                                                                  |
| format / ranking, scoring                      | 形式 / 順位の決め方                   |                                                                                  |
| schedule / scheduling                          | スケジュール                          | スケジュールを一時停止・再開・再試行.                                            |
| draw / new draw                                | 抽選 / 再抽選                         |                                                                                  |
| standings / place (rank) / average place       | 順位表 / 順位 / 平均順位              | Abbr. "Avg" → 平均.                                                              |
| place (a held spot)                            | 枠                                    | あなたの枠, 枠を確定する.                                                        |
| wins / points / score (standings)              | 勝利数 / 勝ち点 / 勝ち点              | Abbr. W → 勝, Pts → 勝点.                                                        |
| tiebreak                                       | タイブレーク                          | Abbr. TB.                                                                        |
| bracket                                        | トーナメント表                        |                                                                                  |
| round N / final / semi-finals / quarter-finals | N回戦 / 決勝 / 準決勝 / 準々決勝      | Generic "Rounds" → ラウンド.                                                     |
| match / game N / decider                       | マッチ / ゲームN / 決定戦             | Chips: G1, G2, 決.                                                               |
| champion / runner-up                           | 優勝 / 準優勝                         |                                                                                  |
| in the final / out in round N                  | 決勝進出 / N回戦敗退                  |                                                                                  |
| knocked out / still in / goes through          | 敗退 / 勝ち残り / 勝ち上がる          |                                                                                  |
| bye / walkover / forfeit                       | 相手なし / 不戦勝 / 不戦敗            |                                                                                  |
| shared (game), joint winners                   | 同時勝利 / 同時優勝                   |                                                                                  |
| substitute                                     | 代役                                  | Chip "Sub" → 代役.                                                               |
| withdraw, withdrawn (tournament)               | 棄権                                  | League sign-up "Withdraw" → エントリーを取り消す; tournament "Leave" → 参加取消. |
| void                                           | 無効                                  |                                                                                  |
| stage                                          | ステージ                              |                                                                                  |
| season / level / group                         | シーズン / レベル / グループ          | シーズン3, レベルA, グループB.                                                   |
| ladder / pyramid (league shape)                | ラダー / ピラミッド                   | "Shape" → 構造.                                                                  |
| promoted / relegated                           | 昇格 / 降格                           |                                                                                  |
| seeding (season)                               | レベル分け                            |                                                                                  |
| returning players / new players                | 継続参加のプレイヤー / 新規プレイヤー |                                                                                  |

### Account, notifications, site

| English                             | Japanese                                 | Note                                          |
| ----------------------------------- | ---------------------------------------- | --------------------------------------------- |
| sign in / sign out / sign up        | ログイン / ログアウト / 登録 (新規登録)  | English mixes "sign in" and "login"; unified. |
| username / password / email         | ユーザー名 / パスワード / メールアドレス |                                               |
| linked account / link / unlink      | 連携アカウント / 連携 / 連携解除         |                                               |
| verification code, token            | 確認コード                               | One term for both.                            |
| confirm it's you                    | 本人確認                                 |                                               |
| administrator                       | 管理者                                   |                                               |
| preferences / profile               | 設定 / プロフィール                      |                                               |
| notifications / web notifications   | 通知 / ブラウザ通知                      |                                               |
| turn reminders / reminder hours     | 手番リマインダー / リマインダーの時間帯  |                                               |
| connect / disconnect (bot, webhook) | 接続 / 接続を解除                        |                                               |
| webhook / Integrations (Discord)    | ウェブフック / 連携サービス              | Discord's own Japanese labels.                |
| stats / history                     | 統計 / 履歴                              |                                               |
| win rate / win streak               | 勝率 / 連勝                              |                                               |
| W / T / L                           | 勝 / 分 / 敗                             |                                               |
| even odds                           | 全員互角なら                             |                                               |
| pay it forward                      | 恩送り                                   |                                               |
| charity / donation                  | 慈善団体 / 寄付                          |                                               |
| box cover                           | 箱絵                                     |                                               |
| designed by / published by          | デザイン： / 出版：                      |                                               |
| alpha / beta                        | アルファ / ベータ (heading: ベータ版：)  |                                               |
| time zone                           | タイムゾーン                             |                                               |

### Emails, notifications and bots

| English                                      | Japanese                                             | Note                                                                             |
| -------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| subject line                                 | ゲーム開始：{game}（{title}）                        | Event first, then the name after ：, so a mail app cuts the name, not the event. |
| request (password reset, email change)       | リクエスト                                           | 〜がリクエストされました; same word as the site's vote requests.                 |
| you can safely ignore this email             | このメールは無視していただいて問題ありません         |                                                                                  |
| if you did not request / expect this         | お心当たりがない場合は                               |                                                                                  |
| contact us                                   | 運営までご連絡ください                               | Questions: 運営までお問い合わせください.                                         |
| if the button does not work                  | ボタンが使えない場合は                               | The link follows at the end of the line.                                         |
| turn notifications / turn on                 | 手番通知 / オンにする                                | As on the notifications page (通知ページ).                                       |
| dashboard                                    | マイゲーム                                           | "Open dashboard" → マイゲームを開く.                                             |
| open the game / join the game                | ゲームを開く / ゲームに参加する                      |                                                                                  |
| view invitation / vote (buttons)             | 招待を見る / 投票する                                |                                                                                  |
| left Board Together (deleted the account)    | 退会                                                 | Leaving a game stays 退出 (プレイヤー退出).                                      |
| was removed (by an administrator)            | 除外                                                 | プレイヤー除外, Board Togetherから除外されました.                                |
| take over a seat / give a seat               | 席を引き継ぐ / 席を割り当てる                        | 管理者が{player}の席をあなたに割り当てました.                                    |
| end the game early                           | ゲームを早めに終了                                   | The menu item is quoted as the site shows it: 「ゲーム終了を提案」.              |
| "{names} won!" / "{names} tied"              | {names}の勝ち！ / {names}の引き分け                  | Lists arrive joined with 、 (Alice、Bob、Carol).                                 |
| waiting for {names}                          | {names}の手番です                                    |                                                                                  |
| Nth (place)                                  | N位                                                  | `email_ordinal` is a plain string.                                               |
| final results / final standings              | 最終結果 / 最終順位表                                |                                                                                  |
| champion / champions (panel label)           | 優勝 / 同時優勝                                      | No champion: 該当者なし.                                                         |
| stay in a level                              | 残留                                                 | With 昇格 / 降格.                                                                |
| move up to fill a place                      | 繰り上がる                                           | Not 昇格, which is earned by results.                                            |
| bottom level joins another level             | 統合                                                 |                                                                                  |
| seeding season                               | レベル分けシーズン                                   |                                                                                  |
| sign-up open / closes soon                   | エントリー受付中 (受付開始) / まもなくエントリー締切 |                                                                                  |
| a player with no known name                  | 不明なプレイヤー                                     | "A Player", "Someone" in winner lists and standings.                             |
| a player whose name is withheld              | あるプレイヤー                                       | "A player" in the player-removed email.                                          |
| someone (unnamed host of an invitation)      | ほかのプレイヤー                                     | Also "the other players".                                                        |
| your group (no opponent names)               | 同じグループのプレイヤー                             |                                                                                  |
| unavailable account                          | 利用できないアカウント                               | As on the site.                                                                  |
| type /stop (Discord) / send /stop (Telegram) | /stop と入力 / /stop を送信                          |                                                                                  |
| press Connect                                | 「接続」を押す                                       | The site's button label.                                                         |
| bug-reports forum / "You wrote"              | bug-reportsフォーラム / あなたの報告                 | The forum's name is kept.                                                        |

Kept as written: BoardTogether / Board Together, Tabletop, game titles, designer and charity
names, Discord, Telegram, Google, GitHub, BG Stats, Tiltify, /stop, /notify, /start, the
bug-reports forum name, URLs, `name@company.com`.

## 3. Typography and formatting

- Full-width 。、「」（）：？！ in Japanese text; half-width digits and Latin letters; no space
  between Japanese and Latin or digits (Discordでログイン, 4人卓), and none after ？ or ！.
- Quotation marks are 「」 ("{search}" → 「{search}」). Ellipsis is … (U+2026). Ranges use 〜
  (U+301C): 3〜5人, 月曜〜金曜.
- UI separators " · ", " — ", "→", "←" are kept as in English. "Label: value" uses ：.
- Counters: 人 (people), 卓 (tables), ゲーム (games), タイトル (titles), 件 (items), 枚
  (screenshots), 回戦 (rounds), 連勝 (streaks).
- English plural variants collapse to one string (Japanese has only `other`). Two messages
  instead select on the exact number: `tournaments_detail_winners` (1 → 優勝：, otherwise
  同時優勝：) and `tournaments_knockout_in_round` (1 → 1回戦に出場中, otherwise N回戦進出).
- `{count: number}` groups thousands where a count can grow large (history and stats game
  counts). Dates, times, percentages and month names arrive already formatted for the page
  language and are used as they come: a registration deadline as 「11月25日 14:00」
  (`tournaments_registration_closes_on`), a stats month as 「2026年11月」
  (`content_stats_since_month` → 2026年11月から).
- Short error labels that have no full stop in English have none in Japanese either
  (リーグを読み込めませんでした); multi-sentence messages always end with 。.

Emails, notifications and bots

- Names that players give (games, tournaments, leagues) take 「」 inside a sentence, because
  nothing else sets them off in plain text: 「{game}」であなたの手番です,
  「{league}」のシーズン{season}が始まりました. They stand bare after ： and beside " · "
  (ゲーム開始：{game}（{title}）, {league} · シーズン{season}). Game titles, player names, group and
  level names are never bracketed.
- One-line notification texts, push titles and push bodies have no 。; ！ is kept where the
  English has it (あなたの手番です！).
- **Exception to "no space next to Latin":** in Discord and Telegram messages a slash command or a
  URL has a half-width space on each side (/stop を送信してください, {url} で「接続」を押して
  ください). Telegram only makes a command tappable when no letter touches it, and it would
  otherwise pull the following Japanese, even 。, into the link.
- In email footers the link comes last, after ：, with nothing behind it.
- Dates and times arrive formatted with the time zone and are used as they come:
  「2026年11月25日 14:30 JST」 in account emails ({time}に、パスワードが変更されました),
  「10月24日土曜日 3:00 JST」 for a league deadline, which is set in （） so its inner space
  cannot be misread.
- English plurals are plain strings here too ({days}日間, {minutes}分, {wins: number}勝,
  {count: number}人).

## 4. Please review

Policy

- **さん**: no honorific after names in any message (reason in section 1). Say if sentences such
  as `games_vote_undo_request` or `leagues_group_withdrew` should read 「Samさんが…」.

Terms with competing or missing community usage

- `nav_pay_it_forward`, `content_pif_heading`, `content_pif_other_charities`,
  `content_landing_small_print`: "pay it forward" → 恩送り; the alternative is ペイ・フォワード.
- `games_call_offer_call`, `games_call_ask_end`, `games_card_called`: "call the game / called" →
  ゲーム終了を提案 / 合意終了. No settled Japanese word for this 18xx habit (打ち切り? コールド?).
- `games_card_result_abandoned`: "Abandoned" → 中止 (same word as "Cancelled"); 放棄 or 不成立?
- `games_card_enter`, `library_entry_enter`: "Enter" → 入室 (lobby wording); 開く or 入る?
- `pace_live_name`, `pace_fast_name`, `pace_brisk_name`, `pace_daily_name`, `pace_relaxed_name`:
  ライブ / 高速 / サクサク / デイリー / ゆったり. Japanese has no settled names for such a scale;
  the alternatives are リアルタイム (Live), 速い or スピーディー (Fast), テキパキ or 軽快 (Brisk),
  1日1手 (Daily), のんびり or まったり (Relaxed). A change also touches `pace_*_line`,
  `pace_*_summary` and `library_pace_*`.
- `pace_fast_past_limit` and the other `pace_*_past_limit`: "Past the 1 h pace" →
  1時間のペースを超過, a fragment; 「1時間のペースを超えています」 if a full sentence reads better in
  the tooltip.
- `library_pace_daily_or_faster`, `library_pace_brisk_or_faster`, `library_pace_fast_or_faster`:
  "or faster" → 以上の速さ (デイリー以上の速さ); デイリーかそれより速い is the plainer option.
- `tournaments_bracket_bye`, `tournaments_bracket_nobody`, `tournaments_bracket_walkover`: an
  empty round-1 slot reads 相手なし, a later empty slot 該当者なし, a walkover 不戦勝. Japanese
  calls both a bye and a walkover 不戦勝; BYE is another option for the slot.
- `leagues_season_name_seeding`, `leagues_sign_up_seeding_explanation`: "seeding" → レベル分け,
  because シード means a seeded bracket position in Japanese.
- `content_stats_even_odds`, `content_stats_key_even_odds`, `content_stats_win_rate_meter`:
  "even odds" → 全員互角なら (the win rate if everyone were equally strong).
- `tournaments_detail_score`, `leagues_group_points`, `leagues_group_points_abbr`,
  `tournaments_scoring_wins`, `tournaments_form_mini_help`: score / points / Pts → 勝ち点 / 勝点;
  ポイント / Pt is the alternative.
- `tournaments_scoring_knockout`, `tournaments_form_knockout_help`,
  `tournaments_form_decider_help`, `tournaments_bracket_legend`,
  `tournaments_detail_games_per_match_value`: "one game from each side" → 席を入れ替えて1ゲームずつ,
  "split match" → 勝ち数が並んだマッチ, "side" → サイド.
- `games_card_result_tied` against `tournaments_bracket_game_shared`: the same outcome is 引き分け
  on a game card and in stats, 同時勝利 in tournament texts (English: tied / shared).
- `games_option_yes`, `games_option_no`: boolean game options show はい / いいえ; あり / なし?
- `leagues_format_shape`, `leagues_form_shape_label`: "shape" → 構造.
- `dashboard_tab_current`, `tournaments_tab_mine`: "Current" → 参加中, "Mine" → 参加済み.
- `library_title_games_community`: "Community games" → みんなのゲーム.
- `games_card_winner_you_and_others`: "You and others" → あなたほか.

Text that depends on parts of the product not translated here

- `games_vote_undo_yourself`: keeps 「Undo」 in English because the button inside game UIs is not
  localized yet.
- `games_card_explorations_heading`: "Explorations" → 検討, while game UIs still say
  "Exploration".
- `games_card_hotseat`: ホットシート; the shared create-game form still says "Hotseat".
- `pace_live_name`, `pace_fast_name`, `pace_brisk_name`, `pace_daily_name`, `pace_relaxed_name`:
  cards, the lobby table and the pace filter show the Japanese pace names, but the shared
  create-game form still lists the paces in English ("Brisk · moves every few hours"), so a host
  picks "Brisk" there and then sees サクサク.
- `games_vote_failed_reason`: {reason} arrives from the server in English.
- `delete_account_summary`, `delete_account_kept_finished`: keep the literal name
  "Deleted player", which is stored in game data, with a Japanese gloss.
- `telegram_offer`: Telegram's Start button is given as 「開始」（Start）; check the label the
  Japanese Telegram app shows.
- `discord_webhook_instructions`, `discord_webhook_unsupported`: Discord menu names 連携サービス
  and ウェブフック; check against the current Japanese Discord client.

Emails, notifications and bots (`libs/email/messages/ja.json`, and `push_*` in the site file)

- **さん** again: with no honorific, a hiragana name runs into the particle after it
  (はなこが「木曜の夜」に参加しました, たろうから…招待されました). Names open the sentence where
  that reads naturally (`notification_took_over_seat_summary`, `push_took_over_seat_body`), but
  this is where the no-さん policy shows most.
- `email_game_started_subject`, `email_game_end_subject`, `email_player_removed_subject_left`,
  `email_player_removed_subject_removed`, `email_tournament_results_subject`,
  `email_league_sign_up_subject_open`, `email_league_sign_up_subject_reminder`,
  `email_league_season_start_subject`, `email_league_season_results_subject`: subjects read
  「ゲーム終了：{game}（{title}）」, event first, where the English is a sentence. A sentence
  (「{game}」が終了しました) is friendlier but puts the event where mail apps cut it off.
- `email_game_invitation_subject`, `email_game_invitation_preview`: the same English ("Join
  {owner}'s game of {title}") is a statement in the subject (…に招待されました) and the invitation
  in the preview (…に参加しませんか？), so the inbox line does not repeat itself.
- `email_game_end_footer`, `email_game_started_footer`, `email_player_removed_footer`,
  `email_tournament_results_footer`, `email_league_sign_up_footer`,
  `email_league_season_start_footer`, `email_league_season_results_footer`: "You played in this
  game on Board Together." → このメールは、…に参加した方にお送りしています, the usual Japanese way
  to say why an email was sent.
- `email_unnamed_player`, `email_game_end_no_winner_names`: "A Player" / "Someone" → 不明なプレイヤー;
  `email_player_removed_unnamed_player`: "A player" → あるプレイヤー;
  `email_game_invitation_unnamed_owner`: "someone" → ほかのプレイヤー. 名無しのプレイヤー or 誰か?
- `email_player_removed_subline_left`, `email_player_removed_subline_removed`,
  `email_player_removed_preview_removed`: "left Board Together" → 退会, "was removed" → 除外
  (アカウント停止 would say more than the English does).
- `email_account_deleted_subline`: "a deleted player" is written as the label players see,
  「Deleted player」（削除済みプレイヤー）, like `delete_account_summary` on the site.
- `email_account_email_change_requested_detail`, `email_account_password_reset_requested_detail`,
  `email_account_email_changed_detail`, `email_account_password_changed_detail`,
  `email_account_deleted_detail`: the panel above the date is a noun phrase (パスワードの変更), not
  パスワードが変更されました, which the line above it already says.
- `email_game_started_waiting`, `email_game_started_preview_waiting`: "Waiting for {names}" →
  {names}の手番です.
- `email_game_end_result_won`, `email_game_end_result_draw`: {names}の勝ち！ / {names}の引き分け;
  勝者：{names} is the label-style alternative.
- `email_tournament_results_champion`, `email_tournament_results_shared_champion`: "That is you." /
  "You share the top of the table." → あなたの優勝です。 / あなたも同時優勝です。
- `email_league_season_start_moved_up`: "moved up" → 繰り上がりました;
  `email_league_season_results_stayed`: "stay" → 残留します;
  `email_league_season_start_merged`: "has joined Level {level}" → レベル{level}に統合されました.
- `email_league_sign_up_detail`: the deadline sits in brackets, エントリー締切（{closes}）までに.
- `email_bug_report_you_wrote`: "You wrote" → あなたの報告.
- `notification_open_dashboard_button`: "Open dashboard" → マイゲームを開く, the site's name for it.
- `notification_took_over_seat_heading`, `notification_lost_seat_heading`: "gave" → 割り当てました.
- `push_lost_seat_title`: 席がほかのプレイヤーに引き継がれました drops あなたの to stay short; the
  body says あなたの席.
- `telegram_connected_as`, `telegram_connected`, `telegram_not_linked`, `telegram_stopped`,
  `telegram_help`, `discord_install_welcome`, `discord_notify_started`: half-width spaces around
  /stop and {url} (reason in section 3). Check in Telegram that /stop is tappable and the link
  stops at the URL.
- `discord_command_notify_description`, `discord_command_stop_description`: ます form without 。
  (手番とゲームへの招待を通知します); a noun phrase (手番と招待の通知) is the alternative. Compare
  with the built-in commands in the Japanese Discord client.

Limits set by the code, not by the translation

- A half-width space follows 。 where a template joins two messages: every footer before
  `email_button_fallback`, `email_league_season_results_preview` before the result sentence,
  `email_league_season_start_games` before `email_league_season_start_seeding_note`.
- `email_bug_report_forum` follows a sentence that arrives in English, and the rest of that
  email (heading, lead, note) is written in English by the bug-report tool.
- `email_game_started_warning_body`, `email_game_started_turns_set_up`: name the browser and
  Discord only, as the English does; the site's notifications page also lists Telegram.
- In Discord webhook posts {game} arrives as "title · linked game name", so the brackets read
  「Fresh Fish · Thursday night fish」であなたの手番です.

Style

- `dashboard_heading`: 「あなたのゲーム。」 keeps the full stop of the English heading as copy style,
  like `content_pif_heading` 「恩送りをしましょう。」.
- `content_landing_welcome`: headline 「ゲームでも／いかがですか？」 with the highlight on ゲーム.
- `content_stats_key_won`, `content_stats_key_tied`, `content_stats_key_lost`: the legend reads
  「勝：勝ち」「分：引き分け」「敗：負け」, a little redundant because the chips are kanji.
- `library_series_18xx_description`: uses the 18xx expression 列車が錆びる.
- `tournaments_schedule_each_seat`, `tournaments_schedule_every_pair_meets`,
  `tournaments_schedule_opponents_meet`, `tournaments_schedule_repeated_groups`: labels followed
  by a hard-coded value such as "2×" (各席 2×, 同じ顔ぶれの卓 0).
