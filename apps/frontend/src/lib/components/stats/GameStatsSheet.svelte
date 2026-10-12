<script lang="ts">
    import { evenOddsWinRate } from '@tabletop/common'
    import { createTimeAgo } from '@tabletop/frontend-components'
    import {
        countOf,
        formatAverage,
        formatRate,
        formatRecord,
        localMonth,
        monthName,
        type GameStatsScope,
        type MonthIndex
    } from '$lib/utils/gameStats'
    import MonthlyGamesChart from './MonthlyGamesChart.svelte'
    import OutcomeStrip from './OutcomeStrip.svelte'
    import WinRateMeter from './WinRateMeter.svelte'

    let { scope, months }: { scope: GameStatsScope; months: MonthIndex[] } = $props()

    const timeAgo = createTimeAgo()
    const summary = $derived(scope.summary)
    const facts = $derived([
        countOf(summary.opponentCount, 'opponent'),
        `first finished ${monthName(localMonth(summary.firstFinishedAt), 'long')}`,
        `last finished ${timeAgo.format(summary.lastFinishedAt)}`,
        summary.averageDays < 1
            ? 'under a day per game on average'
            : `${countOf(Math.round(summary.averageDays), 'day')} per game on average`,
        ...(scope.kind === 'title' && scope.bestScore !== undefined
            ? [`best score ${scope.bestScore}`]
            : []),
        ...(summary.tournamentGames > 0
            ? [
                  `${countOf(summary.tournamentGames, 'tournament table')}, ${summary.tournamentWins} won`
              ]
            : [])
    ])
</script>

<section class="sheet" aria-label={`${scope.name} stats`}>
    <header class="sheet-head">
        {#if scope.kind === 'title' && scope.thumbnailUrl}
            <img src={scope.thumbnailUrl} alt="" />
        {/if}
        <div>
            <h2>{scope.name}</h2>
            <p class="facts">{facts.join(' · ')}</p>
        </div>
    </header>

    <dl class="figures">
        <div class="figure">
            <dt>games finished</dt>
            <dd class="value">{summary.games}</dd>
            <dd class="note">{scope.gamesNote}</dd>
        </div>
        <div class="figure">
            <dt>won–tied–lost</dt>
            <dd class="value">{formatRecord(summary)}</dd>
        </div>
        <div class="figure">
            <dt>win rate</dt>
            <dd class="value">{formatRate(summary.winRate)}</dd>
            <dd class="note">even odds: {formatRate(summary.evenOddsWinRate)}</dd>
        </div>
        <div class="figure">
            <dt>best win streak</dt>
            <dd class="value">{summary.bestWinStreak}</dd>
            <dd class="note">currently {summary.currentWinStreak}</dd>
        </div>
        {#if summary.finishes}
            <div class="figure">
                <dt>average finish</dt>
                <dd class="value">{formatAverage(summary.finishes.average)}</dd>
                <dd class="note">
                    at {formatAverage(summary.finishes.averagePlayerCount)}-player tables
                </dd>
            </div>
        {/if}
    </dl>

    <div class="panels">
        <div class="panel">
            <h3>Win rate by player count</h3>
            <table class="player-counts">
                <tbody>
                    {#each summary.playerCounts as size (size.playerCount)}
                        <tr>
                            <th scope="row">{size.playerCount} players</th>
                            <td class="games">{countOf(size.games, 'game')}</td>
                            <td class="rate">{formatRate(size.winRate)}</td>
                            <td class="meter">
                                <WinRateMeter
                                    rate={size.winRate}
                                    evenOdds={evenOddsWinRate(size.playerCount)}
                                />
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
            <ul class="key" aria-hidden="true">
                <li><span class="swatch"></span>Your win rate</li>
                <li><span class="tick"></span>Even odds at that table size</li>
            </ul>
        </div>
        <div class="panel">
            <h3>Last {countOf(summary.recentOutcomes.length, 'game')}</h3>
            <OutcomeStrip outcomes={summary.recentOutcomes} />
            <ul class="key" aria-hidden="true">
                <li>W won</li>
                <li>T tied</li>
                <li>L lost</li>
                <li>newest on the right</li>
            </ul>
        </div>
        <div class="panel wide">
            <h3>Games finished per month</h3>
            <MonthlyGamesChart monthlyGames={scope.monthlyGames} {months} />
        </div>
        {#if summary.opponents.length}
            <div class="panel wide">
                <h3>Most played opponents</h3>
                <table class="opponents">
                    <thead>
                        <tr>
                            <th scope="col">Opponent</th>
                            <th scope="col" class="number">Games</th>
                            <th scope="col" class="number">You won</th>
                            <th scope="col" class="number">They won</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each summary.opponents as opponent, index (index)}
                            <tr>
                                <td>{opponent.name}</td>
                                <td class="number">{opponent.games}</td>
                                <td class="number">{opponent.wins}</td>
                                <td class="number">{opponent.opponentWins}</td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/if}
    </div>
</section>

<style>
    .sheet {
        min-width: 0;
    }
    .sheet-head {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 20px;
    }
    .sheet-head img {
        width: 64px;
        height: 64px;
        object-fit: contain;
        flex-shrink: 0;
    }
    h2 {
        font-family: 'Source Sans 3', sans-serif;
        font-size: 26px;
        font-weight: 600;
        line-height: 1.15;
        color: var(--color-gray-100);
    }
    .facts {
        color: var(--color-gray-400);
        font-size: 14px;
    }
    .figures {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(0, 1fr);
    }
    .figure {
        display: flex;
        flex-direction: column;
        padding: 0 20px;
        border-left: 1px solid var(--color-gray-700);
    }
    .figure:first-child {
        padding-left: 0;
        border-left: 0;
    }
    .figure .value {
        order: -1;
        font-family: 'Source Sans 3', sans-serif;
        font-size: 32px;
        font-weight: 600;
        line-height: 1.1;
        color: var(--color-gray-100);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }
    .figure dt {
        margin-top: 2px;
        font-size: 14px;
        color: var(--color-gray-300);
    }
    .figure .note {
        font-size: 12px;
        color: var(--color-gray-400);
    }
    .panels {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        margin-top: 24px;
    }
    .panel {
        min-width: 0;
        border: 1px solid rgb(54 65 83 / 0.6);
        border-radius: 12px;
        background: rgb(30 41 57 / 0.5);
        padding: 18px 20px;
    }
    .panel.wide {
        grid-column: 1 / -1;
    }
    h3 {
        margin-bottom: 10px;
        font-size: 13px;
        font-weight: 500;
        color: var(--color-gray-400);
    }
    table {
        width: 100%;
        font-size: 14px;
    }
    th,
    td {
        padding: 10px 12px;
        text-align: left;
        font-weight: 400;
        white-space: nowrap;
    }
    th:first-child,
    td:first-child {
        padding-left: 0;
    }
    th:last-child,
    td:last-child {
        padding-right: 0;
    }
    tbody tr {
        border-top: 1px solid rgb(54 65 83 / 0.6);
    }
    thead th {
        font-size: 13px;
        font-weight: 500;
        color: var(--color-gray-400);
    }
    .number,
    .games,
    .rate {
        text-align: right;
        font-variant-numeric: tabular-nums;
    }
    .games {
        color: var(--color-gray-400);
    }
    .rate {
        font-weight: 500;
    }
    td.meter {
        width: 40%;
        min-width: 80px;
    }
    .opponents td:first-child {
        white-space: normal;
        overflow-wrap: break-word;
    }
    .key {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 18px;
        margin-top: 10px;
        color: var(--color-gray-400);
        font-size: 12px;
    }
    .swatch,
    .tick {
        display: inline-block;
        margin-right: 6px;
        vertical-align: -1px;
    }
    .swatch {
        width: 10px;
        height: 10px;
        border-radius: 2px;
        background: var(--stats-mark);
    }
    .tick {
        width: 2px;
        height: 12px;
        background: var(--color-gray-200);
    }
    @media (max-width: 850px) {
        .figures {
            grid-auto-flow: row;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            row-gap: 14px;
        }
        .figure {
            padding: 0 16px 0 0;
            border-left: 0;
        }
        .figure .value {
            font-size: 26px;
        }
        .panels {
            grid-template-columns: minmax(0, 1fr);
        }
        th,
        td {
            padding-inline: 6px;
        }
    }
</style>
