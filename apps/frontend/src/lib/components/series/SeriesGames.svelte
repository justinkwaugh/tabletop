<script lang="ts">
    import { onMount } from 'svelte'
    import { CheckOutline, PlusOutline } from 'flowbite-svelte-icons'
    import { isListedOpenGame, type Game, type GameCatalogEntry } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import TitleSection from '$lib/components/TitleSection.svelte'
    import SeriesGameTable from './SeriesGameTable.svelte'
    import SeriesTitlePicker from './SeriesTitlePicker.svelte'
    import CreateGameModal from '$lib/components/CreateGameModal.svelte'
    import type { LibrarySeries } from '$lib/utils/libraryTitles'
    import { activityLoadFailure } from '$lib/utils/activityLoad'
    import {
        filterSeriesGames,
        gameMatchesFilter,
        seatChoices,
        titleGameCounts,
        widenFilterToShow,
        type SeriesFilter
    } from '$lib/utils/seriesLobby'

    const PAGE_SIZE = 25

    type LoadState = 'loading' | 'ready' | 'error' | 'unavailable'

    let {
        series,
        titles,
        filter,
        onfilter
    }: {
        series: LibrarySeries
        titles: GameCatalogEntry[]
        filter: SeriesFilter
        onfilter: (filter: SeriesFilter) => void
    } = $props()
    const { gameService, libraryService } = getAppContext()

    let loadState = $state<LoadState>('loading')
    let creating = $state(false)
    let createdGame = $state<Game>()
    let inProgress = $state<Game[]>([])
    let finished = $state<Game[]>([])

    const titleIds = $derived(titles.map((title) => title.id))
    const titlesById = $derived(new Map(titles.map((title) => [title.id, title])))
    const open = $derived(
        titleIds
            .flatMap((titleId) => gameService.openGamesByTitleId.get(titleId) ?? [])
            .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    )
    const counts = $derived(titleGameCounts(open, inProgress))
    const listKey = $derived(`${filter.view}|${filter.titleIds.join(',')}|${filter.seats ?? ''}`)
    let shown = $derived.by(() => {
        void listKey
        return PAGE_SIZE
    })
    const seatOptions = $derived(
        seatChoices(filter.view === 'lobby' ? [...open, ...inProgress] : finished)
    )
    const visibleOpen = $derived(filterSeriesGames(open, filter))
    const visibleInProgress = $derived(filterSeriesGames(inProgress, filter))
    const visibleFinished = $derived(filterSeriesGames(finished, filter))
    const creatableTitles = $derived(
        titles
            .map((entry) => libraryService.getTitle(entry.id))
            .filter((title) => title !== undefined)
    )
    const createdNote = $derived.by(() => {
        if (!createdGame) return undefined
        if (!isListedOpenGame(createdGame)) return 'unlisted'
        return visibleOpen.some((game) => game.id === createdGame?.id) ? 'listed' : undefined
    })
    const paged = $derived(
        (filter.view === 'lobby' ? visibleInProgress : visibleFinished).slice(0, shown)
    )
    const pagedTotal = $derived(
        filter.view === 'lobby' ? visibleInProgress.length : visibleFinished.length
    )

    async function load() {
        loadState = 'loading'
        try {
            const activity = await gameService.loadSeriesActivity(series.id, titleIds)
            inProgress = activity.inProgress
            finished = activity.recentlyFinished
            loadState = 'ready'
        } catch (error) {
            loadState = activityLoadFailure(error)
        }
    }

    function changeFilter(next: Partial<SeriesFilter>) {
        onfilter({ ...filter, ...next })
    }

    function startGame() {
        void libraryService.whenReady()
        creating = true
    }

    function onCreated(game: Game) {
        createdGame = game
        if (isListedOpenGame(game) && !gameMatchesFilter(game, filter)) {
            onfilter(widenFilterToShow(filter, game))
        }
    }

    onMount(() => {
        void load()
    })
</script>

<div class="filters">
    <SeriesTitlePicker
        {titles}
        {counts}
        selected={filter.titleIds}
        onchange={(titleIds) => changeFilter({ titleIds })}
    />
    <div class="filter-end">
        {#if seatOptions.length > 1 || filter.seats !== undefined}
            <div class="players" role="group" aria-label="Players">
                <span class="players-label" aria-hidden="true">Players</span>
                <div class="segments">
                    <button
                        aria-pressed={filter.seats === undefined}
                        onclick={() => changeFilter({ seats: undefined })}>Any</button
                    >
                    {#each seatOptions as seats (seats)}
                        <button
                            aria-pressed={filter.seats === seats}
                            aria-label={`${seats} players`}
                            onclick={() => changeFilter({ seats })}>{seats}</button
                        >
                    {/each}
                </div>
            </div>
        {/if}
        {#if filter.view === 'lobby'}
            <button class="start" onclick={startGame}
                ><PlusOutline class="h-4 w-4" />Start a game</button
            >
        {/if}
    </div>
</div>

<CreateGameModal
    bind:open={creating}
    titles={creatableTitles}
    {counts}
    initialTitleId={filter.titleIds.length === 1 ? filter.titleIds[0] : undefined}
    oncreated={onCreated}
/>

{#snippet pager()}
    {#if pagedTotal > shown}
        <button class="more" onclick={() => (shown += PAGE_SIZE)}
            >Show more <span class="more-count">{pagedTotal - shown} left</span></button
        >
    {/if}
{/snippet}

{#if loadState === 'loading'}
    <p class="empty" role="status">Loading games…</p>
{:else if loadState !== 'ready'}
    <div class="empty" role="alert">
        <p>
            {loadState === 'unavailable'
                ? 'These games are temporarily unavailable.'
                : 'These games couldn’t load.'}
        </p>
        <button onclick={load}>Try again</button>
    </div>
{:else if filter.view === 'lobby'}
    {#if createdGame && createdNote}
        <p class="created" role="status">
            <CheckOutline class="h-4 w-4 shrink-0" />
            <span>
                {#if createdNote === 'listed'}
                    <b>{createdGame.name}</b> is open for players. It’s highlighted in Looking for players.
                {:else}
                    <b>{createdGame.name}</b> is created. You’ll find it in
                    <a href="/dashboard">My Games</a>.
                {/if}
            </span>
        </p>
    {/if}
    <div class="sections">
        <TitleSection title="Looking for players" count={visibleOpen.length}>
            {#if visibleOpen.length > 0}
                <SeriesGameTable
                    kind="open"
                    games={visibleOpen}
                    {titlesById}
                    label="Games looking for players"
                    highlightId={createdGame?.id}
                />
            {:else}
                <div class="empty compact">
                    <p>No open tables match.</p>
                    <button onclick={startGame}>Start a game →</button>
                </div>
            {/if}
        </TitleSection>
        <TitleSection title="In progress" count={visibleInProgress.length}>
            {#if visibleInProgress.length > 0}
                <SeriesGameTable
                    kind="inProgress"
                    games={paged}
                    {titlesById}
                    label="Games in progress"
                />
                {@render pager()}
            {:else}
                <p class="empty compact">No public games in progress match.</p>
            {/if}
        </TitleSection>
    </div>
{:else}
    <TitleSection title="Recently finished" count={visibleFinished.length}>
        {#if visibleFinished.length > 0}
            <SeriesGameTable
                kind="finished"
                games={paged}
                {titlesById}
                label="Recently finished games"
            />
            {@render pager()}
        {:else}
            <p class="empty compact">No recently finished public games match.</p>
        {/if}
    </TitleSection>
{/if}

<style>
    .filters {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 10px;
        margin-bottom: 24px;
    }
    .filter-end {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 10px;
        margin-left: auto;
    }
    .players {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .start {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-height: 32px;
        padding: 0 14px;
        border-radius: 8px;
        background: var(--color-blue-600);
        color: white;
        font-size: 13px;
        font-weight: 500;
    }
    .start:hover {
        background: var(--color-blue-700);
    }
    .created {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 24px;
        padding: 12px 16px;
        border: 1px solid var(--color-green-800);
        border-radius: 10px;
        background: #064e3b55;
        color: var(--color-green-200);
        font-size: 14px;
    }
    .created b {
        font-weight: 600;
    }
    .created a {
        text-decoration: underline;
    }
    .players-label {
        color: var(--color-gray-500);
        font-size: 12px;
    }
    .segments {
        display: inline-flex;
        overflow: hidden;
        border: 1px solid var(--color-gray-700);
        border-radius: 8px;
    }
    .segments button {
        min-width: 32px;
        min-height: 30px;
        padding: 0 10px;
        border-right: 1px solid var(--color-gray-700);
        color: var(--color-gray-400);
        font-size: 12px;
    }
    .segments button:last-child {
        border-right: 0;
    }
    .segments button[aria-pressed='true'] {
        background: var(--color-gray-700);
        color: var(--color-gray-100);
    }
    .start:focus-visible,
    .segments button:focus-visible,
    .more:focus-visible,
    .empty button:focus-visible {
        outline: 2px solid var(--color-blue-300);
        outline-offset: -2px;
    }
    .sections {
        display: grid;
        gap: 40px;
    }
    .empty {
        padding: 28px;
        border: 1px solid var(--color-gray-800);
        border-radius: 12px;
        background: #1e293b40;
        color: var(--color-gray-400);
        font-size: 14px;
        line-height: 1.6;
    }
    .empty.compact {
        padding: 18px 20px;
    }
    .empty button {
        margin-top: 14px;
        color: var(--color-blue-300);
        font-weight: 500;
    }
    .more {
        display: block;
        margin: 14px 0 0 auto;
        color: var(--color-blue-300);
        font-size: 14px;
        font-weight: 500;
    }
    .more:hover {
        text-decoration: underline;
    }
    .more-count {
        margin-left: 4px;
        color: var(--color-gray-500);
        font-size: 12px;
        font-weight: 400;
    }
    @media (max-width: 640px) {
        .filters {
            margin-bottom: 16px;
        }
        .filter-end {
            margin-left: 0;
            width: 100%;
        }
        .start {
            width: 100%;
            min-height: 40px;
            font-size: 14px;
        }
        .sections {
            gap: 28px;
        }
    }
</style>
