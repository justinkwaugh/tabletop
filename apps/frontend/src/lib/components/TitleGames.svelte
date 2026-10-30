<script lang="ts">
    import { onMount } from 'svelte'
    import { flip } from 'svelte/animate'
    import { prefersReducedMotion } from 'svelte/motion'
    import type { TitleActivity } from '@tabletop/common'
    import { currentDashboardGames } from '$lib/utils/dashboardGames'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import GameCard from '$lib/components/GameCard.svelte'
    import TitleSection from '$lib/components/TitleSection.svelte'
    import { nextTabIndex } from '$lib/utils/tabNavigation'

    const PAGE_SIZE = 4

    let { titleId, oncreate }: { titleId: string; oncreate: () => void } = $props()
    const { gameService, authorizationService, api } = getAppContext()
    type ActivityScope = keyof TitleActivity
    type Scope = 'mine' | 'open' | 'public'
    let states = $state<Record<Scope, 'loading' | 'ready' | 'error' | 'unavailable'>>({
        mine: 'loading',
        open: 'loading',
        public: 'loading'
    })
    let activity = $state<TitleActivity>({ inProgress: [], recentlyFinished: [] })
    let pages = $state<Record<ActivityScope | 'open', number>>({
        open: 0,
        inProgress: 0,
        recentlyFinished: 0
    })
    const activityTabs: { scope: ActivityScope; title: string; empty: string }[] = [
        {
            scope: 'inProgress',
            title: 'In progress',
            empty: 'No public games of this title are being played right now.'
        },
        {
            scope: 'recentlyFinished',
            title: 'Recently finished',
            empty: 'No public games of this title have finished yet.'
        }
    ]
    const tabsId = $props.id()
    let chosenTab = $state<(typeof activityTabs)[number]>()
    const selectedTab = $derived(
        chosenTab ??
            (activity.inProgress.length === 0 && activity.recentlyFinished.length > 0
                ? activityTabs[1]
                : activityTabs[0])
    )
    let myGames = $derived(
        currentDashboardGames(
            gameService.activeGames,
            gameService.waitingGames,
            authorizationService.getSessionUser()?.id
        ).filter((game) => game.typeId === titleId)
    )
    let openGames = $derived(gameService.openGamesByTitleId.get(titleId) ?? [])
    const sections: { scope: Scope; title: string; empty: string }[] = [
        { scope: 'mine', title: 'Your games', empty: 'Your games of this title will appear here.' },
        {
            scope: 'open',
            title: 'Open games',
            empty: 'No open tables right now. Start one and invite others to join.'
        }
    ]

    function gamesFor(scope: Scope) {
        if (scope === 'mine') return myGames
        if (scope === 'open') return openGames
        return activity[selectedTab.scope]
    }

    function moveActivityTab(event: KeyboardEvent, index: number) {
        const next = nextTabIndex(event.key, index, activityTabs.length)
        if (next === undefined) return
        event.preventDefault()
        chosenTab = activityTabs[next]
        document.getElementById(`${tabsId}-${chosenTab.scope}`)?.focus()
    }

    async function load(scope: Scope) {
        if (scope === 'public') return loadActivity()
        states[scope] = 'loading'
        try {
            if (scope === 'mine') await gameService.loadGames()
            else {
                await gameService.loadOpenGames(titleId)
                pages.open = 0
            }
            states[scope] = 'ready'
        } catch {
            states[scope] = 'error'
        }
    }

    async function loadActivity() {
        states.public = 'loading'
        try {
            activity = await api.getTitleActivity(titleId)
            pages.inProgress = 0
            pages.recentlyFinished = 0
            states.public = 'ready'
        } catch (error) {
            states.public =
                error instanceof Error && error.name === 'TitleActivityUnavailable'
                    ? 'unavailable'
                    : 'error'
        }
    }

    onMount(() => {
        void refresh()
        void loadActivity()
    })

    export async function refresh() {
        await Promise.all([load('mine'), load('open')])
    }
</script>

{#snippet gameContent(scope: Scope, empty: string)}
    {@const games = gamesFor(scope)}
    {@const pageScope = scope === 'public' ? selectedTab.scope : 'open'}
    {@const lastPage = Math.max(0, Math.ceil(games.length / PAGE_SIZE) - 1)}
    {@const page = Math.min(pages[pageScope], lastPage)}
    {@const visibleGames =
        scope === 'mine' ? games : games.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)}
    {#if states[scope] === 'loading'}
        <p class="empty" role="status">Loading games…</p>
    {:else if states[scope] === 'error'}
        <div class="empty" role="alert">
            <p>These games couldn’t load.</p>
            <button onclick={() => load(scope)}>Try again</button>
        </div>
    {:else if states[scope] === 'unavailable'}
        <div class="empty" role="status">
            <p>These games are temporarily unavailable.</p>
            <button onclick={() => load(scope)}>Try again</button>
        </div>
    {:else if games.length === 0}
        <div class="empty" class:compact={scope === 'mine'}>
            <p>{empty}</p>
            {#if scope === 'open'}<button onclick={oncreate}>Start a game →</button>{/if}
        </div>
    {:else}
        <div class="game-list" class:public-list={scope === 'public'}>
            {#each visibleGames as game (game.id)}
                <div
                    class="min-w-0"
                    animate:flip={{ duration: prefersReducedMotion.current ? 0 : 250 }}
                >
                    <GameCard
                        {game}
                        class="mx-0 mb-0 p-4 min-w-0 w-full max-w-none border border-gray-700/60 dark:border-gray-700/60 bg-gray-800/50 dark:bg-gray-800/50 rounded-xl"
                    />
                </div>
            {/each}
        </div>
        {#if scope !== 'mine' && games.length > PAGE_SIZE}
            <nav
                class="game-pagination"
                aria-label={scope === 'open' ? 'Open games pages' : `${selectedTab.title} pages`}
            >
                <button
                    aria-disabled={page === 0}
                    onclick={() => {
                        if (page > 0) pages[pageScope] = page - 1
                    }}>Previous</button
                >
                <button
                    aria-disabled={page === lastPage}
                    onclick={() => {
                        if (page < lastPage) pages[pageScope] = page + 1
                    }}>Next</button
                >
            </nav>
        {/if}
    {/if}
{/snippet}

<div class="game-sections">
    {#each sections as section (section.scope)}
        <TitleSection
            title={section.title}
            count={states[section.scope] === 'ready' ? gamesFor(section.scope).length : undefined}
        >
            {@render gameContent(section.scope, section.empty)}
        </TitleSection>
    {/each}
    <div class="public-games">
        <TitleSection title="Community games">
            <div class="collection-tabs activity-tabs" role="tablist" aria-label="Community games">
                {#each activityTabs as tab, index (tab.scope)}
                    <button
                        class="collection-tab"
                        id={`${tabsId}-${tab.scope}`}
                        role="tab"
                        aria-selected={selectedTab.scope === tab.scope}
                        aria-controls={`${tabsId}-panel`}
                        tabindex={selectedTab.scope === tab.scope ? 0 : -1}
                        onclick={() => (chosenTab = tab)}
                        onkeydown={(event) => moveActivityTab(event, index)}
                    >
                        {tab.title}
                        {#if states.public === 'ready'}
                            <span class="tab-count">{activity[tab.scope].length}</span>
                        {/if}
                    </button>
                {/each}
            </div>
            <div
                id={`${tabsId}-panel`}
                role="tabpanel"
                aria-labelledby={`${tabsId}-${selectedTab.scope}`}
                tabindex="0"
            >
                {@render gameContent('public', selectedTab.empty)}
            </div>
        </TitleSection>
    </div>
</div>

<style>
    .game-sections {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 32px;
    }
    .game-list {
        display: grid;
        gap: 12px;
    }
    .public-games {
        grid-column: 1 / -1;
        min-width: 0;
    }
    .public-list {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .activity-tabs {
        flex-wrap: wrap;
        margin-bottom: 20px;
        border-bottom: 1px solid var(--color-gray-700);
    }
    .collection-tab {
        color: var(--color-gray-400);
        border-color: transparent;
    }
    .collection-tab[aria-selected='true'] {
        color: var(--color-blue-300);
        border-color: var(--color-blue-400);
    }
    .tab-count {
        margin-left: 6px;
        font-size: 12px;
    }
    [role='tabpanel']:focus-visible {
        outline: 2px solid var(--color-blue-400);
        outline-offset: 4px;
    }
    .empty {
        min-height: 150px;
        padding: 28px;
        border: 1px solid var(--color-gray-800);
        background: #1e293b40;
        border-radius: 12px;
        color: var(--color-gray-400);
        font-size: 14px;
        line-height: 1.6;
    }
    .empty button {
        margin-top: 14px;
        color: var(--color-blue-300);
        font-weight: 500;
    }
    .empty.compact {
        min-height: 0;
    }
    .empty button:hover,
    .game-pagination button:not([aria-disabled='true']):hover {
        text-decoration: underline;
    }
    .game-pagination {
        display: flex;
        justify-content: flex-end;
        gap: 20px;
        margin-top: 14px;
        color: var(--color-blue-300);
        font-size: 14px;
        font-weight: 500;
    }
    .game-pagination button[aria-disabled='true'] {
        color: var(--color-gray-500);
        cursor: default;
    }
    @media (max-width: 800px) {
        .game-sections,
        .public-list {
            grid-template-columns: 1fr;
        }
    }
</style>
