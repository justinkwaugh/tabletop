<script lang="ts">
    import {
        histogramQuantile,
        SITE_GAME_LENGTH_LIMITS_DAYS,
        SITE_TURN_TIME_LIMITS_SECONDS,
        type SiteStatsNow,
        type SiteStatsReport
    } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { formatRate } from '$lib/utils/gameStats'
    import {
        activeUserSeries,
        bucketLabels,
        chartSlots,
        formatDays,
        formatDuration,
        gameSeries,
        newUserSeries,
        rangeTotals,
        regroupHistogram,
        slotsAreWeeks,
        titleRows,
        TURN_TIME_DISPLAY_LIMITS,
        turnSummary,
        userActionSeries
    } from '$lib/utils/siteStats'
    import BucketBars from './BucketBars.svelte'
    import SiteStatsChart from './SiteStatsChart.svelte'
    import StatFigures from './StatFigures.svelte'

    let { report, now }: { report: SiteStatsReport; now: SiteStatsNow } = $props()

    const { libraryService } = getAppContext()

    const current = $derived(report.current)
    const slots = $derived(chartSlots(current))
    const labels = $derived(slots.map((slot) => slot.label))
    const weekly = $derived(slotsAreWeeks(current))
    const period = $derived(weekly ? 'week' : 'day')
    const totals = $derived(rangeTotals(current.days))
    const turns = $derived(turnSummary(totals.turnTimes))
    const fillMedian = $derived(
        histogramQuantile(SITE_TURN_TIME_LIMITS_SECONDS, totals.publicFillTimes, 0.5)
    )
    const gameMedian = $derived(
        histogramQuantile(SITE_GAME_LENGTH_LIMITS_DAYS, totals.gameLengths, 0.5)
    )
    const rows = $derived(titleRows(current))
    const peakTitleActions = $derived(Math.max(1, ...rows.map((row) => row.userActions)))
    const lastRollup = $derived(current.days.at(-1))
    const uncounted = $derived(totals.uncountedGamesCreated)

    function titleName(titleId: string) {
        return libraryService.titlesById[titleId]?.info.metadata.name ?? titleId
    }

    function duration(seconds: number | undefined) {
        return seconds === undefined ? '–' : formatDuration(seconds)
    }

    function share(rate: number | undefined) {
        return rate === undefined ? '–' : formatRate(rate)
    }
</script>

<div class="panels">
    <section class="panel wide">
        <h3>
            User actions per {period}
            <span>{totals.systemActions.toLocaleString()} automatic actions not counted</span>
        </h3>
        <SiteStatsChart
            caption={`User actions per ${period}`}
            {labels}
            series={userActionSeries(slots)}
        />
    </section>
    <section class="panel">
        <h3>Active users <span>took at least one action</span></h3>
        <SiteStatsChart caption="Active users" {labels} series={activeUserSeries(slots, weekly)} />
    </section>
    <section class="panel">
        <h3>Games per {period}</h3>
        <SiteStatsChart caption={`Games per ${period}`} {labels} series={gameSeries(slots)} />
        <p class="footnote">
            Public games took {duration(fillMedian)} to fill (median). Also created and not counted:
            {uncounted.hotseat} hotseat, {uncounted.forks} forked, {uncounted.explorations} exploration.
        </p>
    </section>
    <section class="panel">
        <h3>Turn time <span class="badge">estimated from turn gaps</span></h3>
        <StatFigures
            small
            figures={[
                { value: duration(turns.median), label: 'median' },
                { value: duration(turns.p75), label: '75th percentile' },
                { value: share(turns.within1h), label: 'within 1 h' },
                { value: share(turns.within24h), label: 'within 24 h' }
            ]}
        />
        <BucketBars
            caption="Turns by time taken"
            labels={bucketLabels(TURN_TIME_DISPLAY_LIMITS, formatDuration)}
            counts={regroupHistogram(
                totals.turnTimes,
                SITE_TURN_TIME_LIMITS_SECONDS,
                TURN_TIME_DISPLAY_LIMITS
            )}
        />
        <p class="footnote">
            {turns.turns.toLocaleString()} turns, each from the previous player's action to this player's
            next one.
        </p>
    </section>
    <section class="panel">
        <h3>New users per {period}</h3>
        <SiteStatsChart
            caption={`New users per ${period}`}
            {labels}
            height={160}
            series={newUserSeries(slots)}
        />
        <h3 class="spaced">Game length <span>games finished in the range</span></h3>
        <StatFigures
            small
            figures={[
                { value: gameMedian === undefined ? '–' : formatDays(gameMedian), label: 'median' },
                { value: totals.games.finished.toLocaleString(), label: 'finished' },
                { value: totals.games.abandoned.toLocaleString(), label: 'abandoned' }
            ]}
        />
        <BucketBars
            caption="Finished games by length"
            labels={bucketLabels(SITE_GAME_LENGTH_LIMITS_DAYS, formatDays)}
            counts={totals.gameLengths}
        />
    </section>
    <section class="panel uncollected">
        <h3>Notifications and reminders</h3>
        <p class="pending">Not collected yet</p>
        <p class="footnote">
            Time from a turn notification to the player's action, and how many reminders go out
            before they act, need the reminder log, which comes next.
        </p>
    </section>
    <section class="panel">
        <h3>Health</h3>
        <dl class="facts">
            <dt>Notification clients</dt>
            <dd>
                {now.notificationClients.webPush} web push · {now.notificationClients.discord} Discord
            </dd>
            {#if lastRollup}
                <dt>Last day rolled up</dt>
                <dd>
                    {lastRollup.rollup.gamesInPlay} games read in {(
                        lastRollup.rollup.durationMs / 1000
                    ).toFixed(1)} s
                </dd>
            {/if}
        </dl>
    </section>
    <section class="panel wide">
        <h3>By game</h3>
        <div class="table-scroll">
            <table>
                <thead>
                    <tr>
                        <th>Game</th>
                        <th class="number">Created</th>
                        <th class="number">Started</th>
                        <th class="number">Finished</th>
                        <th class="number">Abandoned</th>
                        <th class="number">User actions</th>
                        <th aria-hidden="true"></th>
                        <th class="number">Active users</th>
                        <th class="number">Median turn</th>
                        <th class="number">Within 24 h</th>
                    </tr>
                </thead>
                <tbody>
                    {#each rows as row (row.titleId)}
                        <tr>
                            <td>{titleName(row.titleId)}</td>
                            <td class="number">{row.games.created}</td>
                            <td class="number">{row.games.started}</td>
                            <td class="number">{row.games.finished}</td>
                            <td class="number">{row.games.abandoned}</td>
                            <td class="number">{row.userActions.toLocaleString()}</td>
                            <td class="share" aria-hidden="true">
                                <span
                                    class="bar"
                                    style:width={`${(row.userActions / peakTitleActions) * 100}%`}
                                ></span>
                            </td>
                            <td class="number">{row.activeUsers}</td>
                            <td class="number">{duration(row.turns.median)}</td>
                            <td class="number">{share(row.turns.within24h)}</td>
                        </tr>
                    {:else}
                        <tr><td colspan="10" class="empty">No play in this range.</td></tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </section>
</div>

<style>
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
    .panel.uncollected {
        border-style: dashed;
        background: transparent;
    }
    h3 {
        margin-bottom: 12px;
        font-size: 13px;
        font-weight: 500;
        color: var(--color-gray-300);
    }
    h3 span {
        margin-left: 6px;
        font-weight: 400;
        color: var(--color-gray-500);
    }
    h3 .badge {
        border: 1px solid var(--color-gray-700);
        border-radius: 999px;
        padding: 1px 8px;
        font-size: 11px;
    }
    h3.spaced {
        margin-top: 22px;
    }
    .pending {
        font-family: 'Source Sans 3', sans-serif;
        font-size: 22px;
        color: var(--color-gray-400);
    }
    .footnote {
        margin-top: 12px;
        font-size: 12px;
        color: var(--color-gray-500);
    }
    .facts {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 6px 16px;
        font-size: 13px;
    }
    .facts dt {
        color: var(--color-gray-400);
    }
    .table-scroll {
        overflow-x: auto;
    }
    table {
        width: 100%;
        font-size: 14px;
    }
    th,
    td {
        padding: 8px 10px;
        text-align: left;
        font-weight: 400;
        white-space: nowrap;
    }
    th:first-child,
    td:first-child {
        padding-left: 0;
    }
    thead th {
        font-size: 13px;
        font-weight: 500;
        color: var(--color-gray-400);
    }
    tbody tr {
        border-top: 1px solid rgb(54 65 83 / 0.6);
    }
    .number {
        text-align: right;
        font-variant-numeric: tabular-nums;
    }
    .share {
        width: 18%;
        min-width: 70px;
    }
    .bar {
        display: block;
        height: 8px;
        border-radius: 2px;
        background: #3b8eff;
    }
    .empty {
        color: var(--color-gray-500);
    }
    @media (max-width: 760px) {
        .panels {
            grid-template-columns: minmax(0, 1fr);
        }
    }
</style>
