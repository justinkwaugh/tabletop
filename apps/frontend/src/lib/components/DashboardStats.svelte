<script lang="ts">
    import { onMount } from 'svelte'
    import type { UserGameStats } from '@tabletop/common'
    import { changesFinishedGames, listenForGameListChanges } from '$lib/services/gameListUpdates'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import {
        countOf,
        formatRate,
        formatRecord,
        localMonth,
        monthlyGames,
        monthName,
        monthsThrough,
        type GameStatsScope
    } from '$lib/utils/gameStats'
    import GameStatsSheet from './stats/GameStatsSheet.svelte'

    const ALL_GAMES_VALUE = ''
    const { api, notificationService, libraryService } = getAppContext()
    let stats = $state<UserGameStats>()
    let failed = $state(false)
    let selectedTitleId = $state<string>()
    let latestRequest = 0
    let disposed = false

    const scopes = $derived.by((): GameStatsScope[] => {
        if (!stats?.total) return []
        const { total, titles, countedGames } = stats
        return [
            {
                kind: 'all',
                name: 'All games',
                gamesNote: countOf(titles.length, 'different game'),
                summary: total,
                monthlyGames: monthlyGames(countedGames, localMonth)
            },
            ...titles.map(({ titleId, summary, bestScore }): GameStatsScope => ({
                kind: 'title',
                titleId,
                name: libraryService.getNameForTitle(titleId),
                thumbnailUrl: libraryService.getThumbnailForTitle(titleId),
                gamesNote: `since ${monthName(localMonth(summary.firstFinishedAt), 'short')}`,
                summary,
                bestScore,
                monthlyGames: monthlyGames(
                    countedGames.filter((game) => game.titleId === titleId),
                    localMonth
                )
            }))
        ]
    })
    const selected = $derived(
        scopes.find((scope) => scope.kind === 'title' && scope.titleId === selectedTitleId) ??
            scopes[0]
    )

    function selectValue(scope: GameStatsScope): string {
        return scope.kind === 'title' ? scope.titleId : ALL_GAMES_VALUE
    }
    function select(value: string) {
        selectedTitleId = value === ALL_GAMES_VALUE ? undefined : value
    }

    const months = $derived(
        stats?.total
            ? monthsThrough(localMonth(stats.total.firstFinishedAt), localMonth(Date.now()))
            : []
    )

    async function load() {
        const request = ++latestRequest
        try {
            const loaded = await api.getMyGameStats()
            if (disposed || request !== latestRequest) return
            stats = loaded
            failed = false
        } catch {
            if (!disposed && request === latestRequest) failed = true
        }
    }

    onMount(() => {
        const stopListening = listenForGameListChanges(
            notificationService,
            changesFinishedGames,
            load
        )
        void load()
        return () => {
            disposed = true
            stopListening()
        }
    })
</script>

<div class="stats">
    {#if failed && !stats}
        <p class="message" role="alert">
            Stats couldn’t load. <button onclick={load}>Try again</button>
        </p>
    {:else if !stats}
        <p class="message" role="status">Loading stats…</p>
    {:else if !selected}
        <p class="message">Your stats will appear here once you finish a game.</p>
    {:else}
        <div class="split">
            <nav class="rail" aria-label="Stats by game">
                <select
                    aria-label="Show stats for"
                    value={selectValue(selected)}
                    onchange={(event) => select(event.currentTarget.value)}
                >
                    {#each scopes as scope (selectValue(scope))}
                        <option value={selectValue(scope)}>
                            {scope.name} — {scope.summary.games} played, {formatRate(
                                scope.summary.winRate
                            )}
                        </option>
                    {/each}
                </select>
                <ul>
                    {#each scopes as scope (selectValue(scope))}
                        <li>
                            <button
                                class:selected={scope === selected}
                                aria-current={scope === selected ? 'true' : undefined}
                                onclick={() => select(selectValue(scope))}
                            >
                                {#if scope.kind === 'all'}
                                    <span class="mark all" aria-hidden="true">All</span>
                                {:else if scope.thumbnailUrl}
                                    <img class="mark" src={scope.thumbnailUrl} alt="" />
                                {:else}
                                    <span class="mark"></span>
                                {/if}
                                <span class="name">
                                    {scope.name}
                                    <small>
                                        {scope.summary.games} played · {formatRecord(scope.summary)}
                                    </small>
                                </span>
                                <span class="rate">{formatRate(scope.summary.winRate)}</span>
                            </button>
                        </li>
                    {/each}
                </ul>
            </nav>
            <GameStatsSheet scope={selected} {months} />
        </div>
    {/if}
</div>

<style>
    .stats {
        --stats-mark: #3b8eff;
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 2px 4px 48px;
        margin: -2px -4px 0;
    }
    .message {
        padding: 28px;
        border: 1px solid var(--color-gray-800);
        border-radius: 12px;
        color: var(--color-gray-400);
        font-size: 14px;
    }
    .message button {
        color: var(--color-blue-300);
    }
    .split {
        display: grid;
        grid-template-columns: 280px minmax(0, 1fr);
        gap: 32px;
        align-items: start;
    }
    .rail {
        position: sticky;
        top: 0;
    }
    .rail select {
        display: none;
    }
    .rail button {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 8px 10px;
        border: 1px solid transparent;
        border-radius: 8px;
        text-align: left;
    }
    .rail button:hover,
    .rail button.selected {
        background: rgb(30 41 57 / 0.5);
    }
    .rail button.selected {
        border-color: rgb(54 65 83 / 0.6);
    }
    .rail button:focus-visible,
    .rail select:focus-visible,
    .message button:focus-visible {
        outline: 2px solid var(--color-blue-400);
        outline-offset: 2px;
    }
    .mark {
        width: 36px;
        height: 36px;
        flex-shrink: 0;
        object-fit: contain;
    }
    .mark.all {
        display: grid;
        place-items: center;
        border: 1px solid var(--color-gray-600);
        border-radius: 6px;
        color: var(--color-gray-300);
        font-size: 12px;
    }
    .name {
        flex: 1;
        min-width: 0;
        font-size: 14px;
        color: var(--color-gray-100);
    }
    .name small {
        display: block;
        font-size: 12px;
        color: var(--color-gray-400);
    }
    .rate {
        font-size: 14px;
        color: var(--color-gray-300);
        font-variant-numeric: tabular-nums;
    }
    @media (max-width: 850px) {
        .split {
            grid-template-columns: minmax(0, 1fr);
            gap: 20px;
        }
        .rail {
            position: static;
        }
        .rail ul {
            display: none;
        }
        .rail select {
            display: block;
            width: 100%;
            padding: 10px;
            border: 1px solid var(--color-gray-600);
            border-radius: 8px;
            background: var(--color-gray-800);
            color: var(--color-gray-100);
            font-size: 14px;
        }
    }
</style>
