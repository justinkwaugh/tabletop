<script lang="ts">
    import { goto } from '$app/navigation'
    import { page } from '$app/state'
    import BackLink from '$lib/components/BackLink.svelte'
    import LibraryShelf from '$lib/components/LibraryShelf.svelte'
    import SeriesGames from '$lib/components/series/SeriesGames.svelte'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import {
        availableSeriesEntries,
        gameCount,
        libraryUrl,
        titleShelfItems
    } from '$lib/utils/libraryTitles'
    import {
        parseSeriesFilter,
        seriesFilterSearch,
        type SeriesFilter,
        type SeriesView
    } from '$lib/utils/seriesLobby'
    import { nextTabIndex } from '$lib/utils/tabNavigation'

    let { data } = $props()
    const { authorizationService, catalogService } = getAppContext()
    const user = $derived(authorizationService.getSessionUser())
    const titles = $derived(availableSeriesEntries(catalogService.entries, data.series, user))
    const filter = $derived(
        parseSeriesFilter(
            page.url.searchParams,
            titles.map((title) => title.id)
        )
    )
    const view = $derived<SeriesView>(user ? filter.view : 'titles')
    const tabsId = $props.id()
    const TABS: { view: SeriesView; label: string }[] = [
        { view: 'titles', label: 'Titles' },
        { view: 'lobby', label: 'Lobby' },
        { view: 'finished', label: 'Finished' }
    ]

    function setFilter(next: SeriesFilter) {
        void goto(seriesFilterSearch(next), {
            replaceState: next.view === filter.view,
            noScroll: true,
            keepFocus: true
        })
    }

    function moveTab(event: KeyboardEvent, index: number) {
        const next = nextTabIndex(event.key, index, TABS.length)
        if (next === undefined) return
        event.preventDefault()
        setFilter({ ...filter, view: TABS[next].view })
        document.getElementById(`${tabsId}-${TABS[next].view}`)?.focus()
    }
</script>

<svelte:head>
    <title>{data.series.name} games — Board Together</title>
</svelte:head>

<main class="series-page collection-page">
    <BackLink href={libraryUrl(user)} label="All games" />
    <div class="series-heading">
        <h1 class="collection-heading">{data.series.name}</h1>
        {#if titles.length > 0 && view === 'titles'}
            <span class="series-count">{gameCount(titles.length)}</span>
        {/if}
    </div>
    <p class="series-description">{data.series.description}</p>
    {#if titles.length === 0}
        <p role="status" class="series-status">
            The game shelf couldn’t load. Please refresh to try again.
        </p>
    {:else}
        {#if user}
            <div class="collection-tabs series-tabs" role="tablist" aria-label={data.series.name}>
                {#each TABS as tab, index (tab.view)}
                    <button
                        class="collection-tab"
                        id={`${tabsId}-${tab.view}`}
                        role="tab"
                        aria-selected={view === tab.view}
                        aria-controls={`${tabsId}-panel`}
                        tabindex={view === tab.view ? 0 : -1}
                        onclick={() => setFilter({ ...filter, view: tab.view })}
                        onkeydown={(event) => moveTab(event, index)}
                    >
                        {tab.label}
                        {#if tab.view === 'titles'}<span class="tab-count">{titles.length}</span
                            >{/if}
                    </button>
                {/each}
            </div>
        {/if}
        <div
            id={`${tabsId}-panel`}
            role={user ? 'tabpanel' : undefined}
            aria-labelledby={user ? `${tabsId}-${view}` : undefined}
        >
            {#if view === 'titles'}
                <LibraryShelf items={titleShelfItems(titles)} signedIn={user !== undefined} />
            {:else}
                <SeriesGames series={data.series} {titles} {filter} onfilter={setFilter} />
            {/if}
        </div>
    {/if}
</main>

<style>
    .series-page {
        padding-bottom: 48px;
        color: var(--color-gray-200);
    }
    .series-heading {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 16px;
        margin-top: 16px;
    }
    .series-count {
        flex-shrink: 0;
        padding-bottom: 4px;
        color: var(--color-gray-400);
        font-size: 13px;
    }
    .series-status {
        padding: 48px 0;
        color: var(--color-gray-400);
    }
    .series-description {
        max-width: 640px;
        margin: 8px 0 28px;
        color: var(--color-gray-400);
        font-size: 15px;
        line-height: 1.5;
    }
    .series-tabs {
        margin: -8px 0 24px;
        border-bottom: 1px solid var(--color-gray-700);
    }
    .collection-tab {
        color: var(--color-gray-400);
        border-color: transparent;
    }
    .collection-tab:hover {
        color: var(--color-gray-100);
    }
    .collection-tab[aria-selected='true'] {
        color: var(--color-gray-100);
        border-color: var(--color-blue-400);
    }
    .tab-count {
        margin-left: 6px;
        font-size: 12px;
        color: var(--color-gray-400);
    }
    @media (max-width: 640px) {
        .series-description {
            margin-bottom: 20px;
            font-size: 14px;
        }
        .series-tabs {
            margin-bottom: 16px;
        }
    }
</style>
