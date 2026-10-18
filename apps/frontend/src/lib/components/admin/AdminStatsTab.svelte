<script lang="ts">
    import { onMount } from 'svelte'
    import {
        addUtcDays,
        histogramQuantile,
        isRealUtcDay,
        SITE_GAME_LENGTH_LIMITS_DAYS,
        SITE_STATS_MAX_RANGE_DAYS,
        SITE_TURN_TIME_LIMITS_SECONDS,
        utcDayCount,
        utcDayOf,
        type SiteStatsNow,
        type SiteStatsRange
    } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { LatestRequest } from '$lib/utils/latestRequest'
    import { formatRate } from '$lib/utils/gameStats'
    import {
        bucketLabels,
        changeFrom,
        chartSlots,
        formatDays,
        formatDuration,
        formatUtcDay,
        presetRange,
        previousRange,
        RANGE_PRESETS,
        rangeTotals,
        regroupHistogram,
        slotLatest,
        slotsAreWeeks,
        slotSum,
        titleRows,
        TURN_TIME_DISPLAY_LIMITS,
        turnSummary,
        type DayRange
    } from '$lib/utils/siteStats'
    import SiteStatsChart from './stats/SiteStatsChart.svelte'
    import BucketBars from './stats/BucketBars.svelte'

    const { api, libraryService } = getAppContext()

    const yesterday = addUtcDays(utcDayOf(new Date()), -1)
    let range = $state<DayRange>(presetRange(28, yesterday))
    let preset = $state<number | undefined>(28)
    let current = $state<SiteStatsRange>()
    let previous = $state<SiteStatsRange>()
    let now = $state<SiteStatsNow>()
    let busy = $state(false)
    let error = $state('')
    let rebuildNote = $state('')
    const requests = new LatestRequest()

    const slots = $derived(current ? chartSlots(current) : [])
    const labels = $derived(slots.map((slot) => slot.label))
    const weekly = $derived(slotsAreWeeks(range))
    const period = $derived(weekly ? 'week' : 'day')
    const totals = $derived(rangeTotals(current?.days ?? []))
    const previousTotals = $derived(rangeTotals(previous?.days ?? []))
    const turns = $derived(turnSummary(totals.turnTimes))
    const previousTurns = $derived(turnSummary(previousTotals.turnTimes))
    const rows = $derived(current ? titleRows(current) : [])
    const peakTitleActions = $derived(Math.max(1, ...rows.map((row) => row.userActions)))
    const medianGameDays = $derived(
        histogramQuantile(SITE_GAME_LENGTH_LIMITS_DAYS, totals.gameLengths, 0.5)
    )
    const rolledThrough = $derived(current?.rolledThrough)
    const daysBehind = $derived(
        rolledThrough && rolledThrough < yesterday ? utcDayCount(rolledThrough, yesterday) - 1 : 0
    )
    const computedAt = $derived(current?.days.at(-1)?.computedAt)
    const rangeDays = $derived(utcDayCount(range.from, range.to))

    async function load() {
        const request = requests.begin()
        busy = true
        error = ''
        const earlier = previousRange(range)
        try {
            const [loadedNow, loadedCurrent, loadedPrevious] = await Promise.all([
                api.getSiteStatsNow(),
                api.getSiteStatsRange(range.from, range.to),
                api.getSiteStatsRange(earlier.from, earlier.to)
            ])
            if (!request()) return
            now = loadedNow
            current = loadedCurrent
            previous = loadedPrevious
        } catch (failure) {
            if (request())
                error = failure instanceof Error ? failure.message : 'Could not load site stats'
        } finally {
            if (request()) busy = false
        }
    }

    function choosePreset(days: number) {
        preset = days
        range = presetRange(days, yesterday)
        void load()
    }

    function chooseDay(edge: 'from' | 'to', day: string) {
        const next = { ...range, [edge]: day }
        if (!isRealUtcDay(next.from) || !isRealUtcDay(next.to) || next.from > next.to) return
        if (utcDayCount(next.from, next.to) > SITE_STATS_MAX_RANGE_DAYS) return
        preset = undefined
        range = next
        void load()
    }

    async function rebuild() {
        if (!confirm('Roll up every day from the first game through yesterday?')) return
        try {
            const runId = await api.startSiteStatsRollup()
            rebuildNote = `Rebuild ${runId} started. Days fill in as it runs; press Refresh to see them.`
        } catch (failure) {
            rebuildNote = failure instanceof Error ? failure.message : 'Could not start the rebuild'
        }
    }

    function titleName(titleId: string) {
        return libraryService.titlesById[titleId]?.info.metadata.name ?? titleId
    }

    function formatChange(change: number | undefined) {
        if (change === undefined) return ''
        const sign = change > 0 ? '+' : change < 0 ? '−' : '±'
        return `${sign}${formatRate(Math.abs(change))} vs previous ${rangeDays} days`
    }

    onMount(() => {
        void load()
    })
</script>

{#snippet figure(value: string, label: string, note?: string)}
    <div class="figure">
        <dt>{label}</dt>
        <dd class="value">{value}</dd>
        {#if note}<dd class="note">{note}</dd>{/if}
    </div>
{/snippet}

<div class="site-stats" aria-busy={busy}>
    <div class="controls">
        <div class="presets" role="group" aria-label="Range">
            {#each RANGE_PRESETS as days (days)}
                <button
                    class:selected={preset === days}
                    aria-pressed={preset === days}
                    onclick={() => choosePreset(days)}>{days === 365 ? '1 year' : `${days} days`}</button
                >
            {/each}
        </div>
        <label>
            From
            <input
                type="date"
                value={range.from}
                max={range.to}
                onchange={(event) => chooseDay('from', event.currentTarget.value)}
            />
        </label>
        <label>
            To
            <input
                type="date"
                value={range.to}
                min={range.from}
                max={yesterday}
                onchange={(event) => chooseDay('to', event.currentTarget.value)}
            />
        </label>
        <span class="spacer"></span>
        <button class="action" onclick={() => void load()} disabled={busy}>Refresh</button>
        <button class="action" onclick={() => void rebuild()}>Rebuild…</button>
    </div>
    <p class="status">
        Days are UTC days{weekly ? ', shown by week' : ''}.
        {#if rolledThrough}
            Rolled up through {formatUtcDay(rolledThrough)}{#if computedAt}, computed {new Date(
                    computedAt
                ).toLocaleString()}{/if}.
            {#if daysBehind > 0}<strong>Behind by {daysBehind} {daysBehind === 1 ? 'day' : 'days'}.</strong
                >{/if}
        {:else if current}
            <strong>Nothing has been rolled up yet. Use Rebuild to fill in history.</strong>
        {/if}
    </p>
    {#if rebuildNote}<p class="status">{rebuildNote}</p>{/if}
    {#if error}<p role="alert" class="error">{error}</p>{/if}

    {#if now}
        <h2>Right now</h2>
        <dl class="figures">
            {@render figure(
                now.users.active.toLocaleString(),
                'users',
                `${now.users.incomplete} incomplete · ${now.users.inactive} inactive`
            )}
            {@render figure(
                now.games.started.toLocaleString(),
                'games in progress',
                `${now.games.waitingForPlayers} waiting for players · ${now.games.waitingToStart} waiting to start`
            )}
            {@render figure(now.games.finished.toLocaleString(), 'games finished all time')}
            {@render figure(
                now.games.quietFor7Days.toLocaleString(),
                'in progress, quiet 7+ days',
                `${now.games.quietFor30Days} of them 30+ days`
            )}
        </dl>
    {/if}

    {#if current && previous}
        <h2>{formatUtcDay(range.from)} – {formatUtcDay(range.to)}</h2>
        <dl class="figures">
            {@render figure(
                totals.userActions.toLocaleString(),
                'user actions',
                formatChange(changeFrom(totals.userActions, previousTotals.userActions))
            )}
            {@render figure(
                current.activeUsers.toLocaleString(),
                'active users',
                formatChange(changeFrom(current.activeUsers, previous.activeUsers))
            )}
            {@render figure(
                totals.games.created.toLocaleString(),
                'games created',
                formatChange(changeFrom(totals.games.created, previousTotals.games.created))
            )}
            {@render figure(
                totals.newUsers.toLocaleString(),
                'new users',
                formatChange(changeFrom(totals.newUsers, previousTotals.newUsers))
            )}
            {@render figure(
                turns.median === undefined ? '–' : `≈ ${formatDuration(turns.median)}`,
                'median turn',
                turns.median !== undefined && previousTurns.median !== undefined
                    ? `${formatDuration(previousTurns.median)} in the previous ${rangeDays} days`
                    : ''
            )}
        </dl>

        <div class="panels">
            <section class="panel wide">
                <h3>User actions per {period}</h3>
                <SiteStatsChart
                    caption={`User actions per ${period}`}
                    {labels}
                    series={[
                        {
                            key: 'actions',
                            name: 'User actions',
                            tone: 'blue',
                            kind: 'column',
                            values: slots.map((slot) => slotSum(slot, (day) => day.userActions))
                        }
                    ]}
                />
            </section>
            <section class="panel">
                <h3>Active users <span>took at least one action</span></h3>
                <SiteStatsChart
                    caption="Active users"
                    {labels}
                    series={[
                        ...(weekly
                            ? []
                            : [
                                  {
                                      key: 'daily',
                                      name: 'That day',
                                      tone: 'blue' as const,
                                      kind: 'column' as const,
                                      values: slots.map((slot) =>
                                          slotSum(slot, (day) => day.activeUsers)
                                      )
                                  }
                              ]),
                        {
                            key: 'week',
                            name: 'Trailing 7 days',
                            tone: 'orange',
                            kind: 'line',
                            values: slots.map((slot) => slotLatest(slot, (day) => day.activeUsers7d))
                        },
                        {
                            key: 'month',
                            name: 'Trailing 28 days',
                            tone: 'green',
                            kind: 'line',
                            values: slots.map((slot) =>
                                slotLatest(slot, (day) => day.activeUsers28d)
                            )
                        }
                    ]}
                />
            </section>
            <section class="panel">
                <h3>Games per {period}</h3>
                <SiteStatsChart
                    caption={`Games per ${period}`}
                    {labels}
                    series={[
                        {
                            key: 'created',
                            name: 'Created',
                            tone: 'blue',
                            kind: 'column',
                            values: slots.map((slot) => slotSum(slot, (day) => day.games.created))
                        },
                        {
                            key: 'started',
                            name: 'Started',
                            tone: 'orange',
                            kind: 'column',
                            values: slots.map((slot) => slotSum(slot, (day) => day.games.started))
                        },
                        {
                            key: 'finished',
                            name: 'Finished',
                            tone: 'green',
                            kind: 'column',
                            values: slots.map((slot) => slotSum(slot, (day) => day.games.finished))
                        }
                    ]}
                />
            </section>
            <section class="panel">
                <h3>Turn time <span class="badge">estimated from turn gaps</span></h3>
                <dl class="figures small">
                    {@render figure(
                        turns.median === undefined ? '–' : formatDuration(turns.median),
                        'median'
                    )}
                    {@render figure(turns.p75 === undefined ? '–' : formatDuration(turns.p75), '75th percentile')}
                    {@render figure(
                        turns.within24h === undefined ? '–' : formatRate(turns.within24h),
                        'within 24 h'
                    )}
                    {@render figure(turns.turns.toLocaleString(), 'turns')}
                </dl>
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
                    From the previous player's action to this player's next action. Reminders and
                    notifications are not counted yet.
                </p>
            </section>
            <section class="panel">
                <h3>New users per {period}</h3>
                <SiteStatsChart
                    caption={`New users per ${period}`}
                    {labels}
                    height={160}
                    series={[
                        {
                            key: 'users',
                            name: 'New users',
                            tone: 'blue',
                            kind: 'column',
                            values: slots.map((slot) => slotSum(slot, (day) => day.newUsers))
                        }
                    ]}
                />
                <h3 class="spaced">Game length <span>games finished in the range</span></h3>
                <dl class="figures small">
                    {@render figure(
                        medianGameDays === undefined ? '–' : formatDays(medianGameDays),
                        'median'
                    )}
                    {@render figure(totals.games.finished.toLocaleString(), 'finished')}
                    {@render figure(totals.games.abandoned.toLocaleString(), 'abandoned')}
                </dl>
                <BucketBars
                    caption="Finished games by length"
                    labels={bucketLabels(SITE_GAME_LENGTH_LIMITS_DAYS, formatDays)}
                    counts={totals.gameLengths}
                />
            </section>
            <section class="panel wide">
                <h3>By game</h3>
                <div class="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>Game</th>
                                <th class="number">Created</th>
                                <th class="number">Finished</th>
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
                                    <td class="number">{row.created}</td>
                                    <td class="number">{row.finished}</td>
                                    <td class="number">{row.userActions.toLocaleString()}</td>
                                    <td class="share" aria-hidden="true">
                                        <span
                                            class="bar"
                                            style:width={`${(row.userActions / peakTitleActions) * 100}%`}
                                        ></span>
                                    </td>
                                    <td class="number">{row.activeUsers}</td>
                                    <td class="number"
                                        >{row.turns.median === undefined
                                            ? '–'
                                            : formatDuration(row.turns.median)}</td
                                    >
                                    <td class="number"
                                        >{row.turns.within24h === undefined
                                            ? '–'
                                            : formatRate(row.turns.within24h)}</td
                                    >
                                </tr>
                            {:else}
                                <tr><td colspan="8" class="empty">No play in this range.</td></tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
        <p class="footnote">
            Range figures leave out hotseat, forked and exploration games, and games since deleted.
            "Right now" counts every game. Undone actions are not counted.
        </p>
    {/if}
</div>

<style>
    .site-stats {
        color: var(--color-gray-100);
    }
    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 14px;
    }
    .presets {
        display: inline-flex;
        border: 1px solid var(--color-gray-700);
        border-radius: 8px;
        overflow: hidden;
    }
    .presets button {
        padding: 5px 12px;
        font-size: 13px;
        color: var(--color-gray-300);
    }
    .presets button + button {
        border-left: 1px solid var(--color-gray-700);
    }
    .presets button.selected {
        background: var(--color-gray-700);
        color: var(--color-gray-100);
    }
    label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: var(--color-gray-400);
    }
    input[type='date'] {
        border: 1px solid var(--color-gray-700);
        border-radius: 6px;
        background: var(--color-gray-800);
        color: var(--color-gray-100);
        padding: 4px 8px;
        font-size: 13px;
        color-scheme: dark;
    }
    .spacer {
        flex: 1;
    }
    .action {
        border: 1px solid var(--color-gray-700);
        border-radius: 8px;
        padding: 5px 12px;
        font-size: 13px;
        color: var(--color-gray-200);
    }
    .action:hover {
        background: var(--color-gray-800);
    }
    .action:disabled {
        opacity: 0.5;
    }
    .status {
        margin-top: 10px;
        font-size: 13px;
        color: var(--color-gray-400);
    }
    .status strong {
        font-weight: 500;
        color: var(--color-amber-300);
    }
    .error {
        margin-top: 10px;
        font-size: 14px;
        color: var(--color-red-300);
    }
    h2 {
        margin: 26px 0 12px;
        font-size: 13px;
        font-weight: 500;
        color: var(--color-gray-400);
    }
    .figures {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        row-gap: 14px;
    }
    .figure {
        display: flex;
        flex-direction: column;
        padding: 0 18px;
        border-left: 1px solid var(--color-gray-700);
    }
    .figure:first-child {
        padding-left: 0;
        border-left: 0;
    }
    .figure .value {
        order: -1;
        font-family: 'Source Sans 3', sans-serif;
        font-size: 30px;
        font-weight: 600;
        line-height: 1.1;
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
    .figures.small {
        grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
        margin-bottom: 14px;
    }
    .figures.small .figure .value {
        font-size: 22px;
    }
    .figures.small .figure dt {
        font-size: 12px;
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
    .footnote {
        margin-top: 12px;
        font-size: 12px;
        color: var(--color-gray-500);
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
        width: 22%;
        min-width: 80px;
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
