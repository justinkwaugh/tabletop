# Japanese (ja) glossary

For the native-speaker review of `apps/frontend/messages/ja.json`.

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

Kept as written: BoardTogether / Board Together, Tabletop, game titles, designer and charity
names, Discord, Telegram, Google, GitHub, BG Stats, Tiltify, /stop, /notify, URLs,
`name@company.com`.

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
