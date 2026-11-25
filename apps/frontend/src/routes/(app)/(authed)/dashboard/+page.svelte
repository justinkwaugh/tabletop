<script lang="ts">
    import { nextTabIndex } from '$lib/utils/tabNavigation'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import DashboardGameList from '$lib/components/DashboardGameList.svelte'
    import { BookmarkOutline } from 'flowbite-svelte-icons'
    import DashboardHistory from '$lib/components/DashboardHistory.svelte'
    import DashboardStats from '$lib/components/DashboardStats.svelte'
    import { currentDashboardGames } from '$lib/utils/dashboardGames'
    import type { Game } from '@tabletop/common'
    import { followFailureMessage } from '$lib/services/followedGames.svelte'
    import { toast } from 'svelte-sonner'

    const { gameService, followedGames, authorizationService } = getAppContext()
    const TABS = [
        { id: 'current', label: 'Current' },
        { id: 'following', label: 'Following' },
        { id: 'history', label: 'History' },
        { id: 'stats', label: 'Stats' }
    ] as const
    type Tab = (typeof TABS)[number]['id']

    let tab = $state<Tab>('current')
    let historyOpened = $state(false)
    const userId = $derived(authorizationService.getSessionUser()?.id)
    const games = $derived(
        currentDashboardGames(gameService.activeGames, gameService.waitingGames, userId)
    )

    function unfollow(game: Game) {
        followedGames.unfollow(game.id).catch((error) => toast.error(followFailureMessage(error)))
    }
    function selectTab(selected: Tab) {
        tab = selected
        if (selected === 'history') historyOpened = true
    }
    function moveTab(event: KeyboardEvent) {
        const current = TABS.findIndex((choice) => choice.id === tab)
        const target = nextTabIndex(event.key, current, TABS.length)
        if (target === undefined) return
        event.preventDefault()
        selectTab(TABS[target].id)
        document.getElementById(`dashboard-tab-${tab}`)?.focus()
    }
</script>

<svelte:head><title>My games — Board Together</title></svelte:head>
<main class="dashboard collection-page">
    <header class="page-heading collection-header">
        <h1 class="collection-heading">Your games.</h1>
        <a href="/library" class="find-game">Go to the library <span aria-hidden="true">→</span></a>
    </header>
    <div class="navigation">
        <div class="collection-tabs" role="tablist" aria-label="My games">
            {#each TABS as choice (choice.id)}
                <button
                    class="collection-tab"
                    id={`dashboard-tab-${choice.id}`}
                    role="tab"
                    aria-selected={tab === choice.id}
                    aria-controls={`dashboard-panel-${choice.id}`}
                    tabindex={tab === choice.id ? 0 : -1}
                    onclick={() => selectTab(choice.id)}
                    onkeydown={moveTab}
                >
                    {choice.label}
                    {#if choice.id === 'current'}<span class="count">{games.length}</span
                        >{:else if choice.id === 'following' && followedGames.loaded}<span
                            class="count">{followedGames.games.length}</span
                        >{/if}
                </button>
            {/each}
        </div>
    </div>
    <div
        class="panel"
        role="tabpanel"
        id="dashboard-panel-current"
        aria-labelledby="dashboard-tab-current"
        hidden={tab !== 'current'}
    >
        <div class="current-results" aria-busy={gameService.loading}>
            {#if games.length}
                <DashboardGameList {games} />
            {:else if gameService.loading}
                <p class="empty" role="status">Loading your games…</p>
            {:else}
                <div class="empty">
                    <p>Ready for a game?</p>
                    <a href="/library">Explore the library →</a>
                </div>
            {/if}
        </div>
    </div>
    <div
        class="panel"
        role="tabpanel"
        id="dashboard-panel-following"
        aria-labelledby="dashboard-tab-following"
        hidden={tab !== 'following'}
    >
        <div class="following-results" aria-busy={followedGames.loading}>
            {#if followedGames.games.length}
                <DashboardGameList games={followedGames.games} onunfollow={unfollow} />
            {:else if followedGames.loading}
                <p class="empty" role="status">Loading the games you follow…</p>
            {:else if !followedGames.loaded}
                <p class="empty" role="status">Couldn’t load the games you follow.</p>
            {:else}
                <div class="empty">
                    <p>Follow games you aren’t playing in to keep them here.</p>
                    <p class="hint">
                        Open a game you’re watching and press
                        <BookmarkOutline class="inline-icon" aria-hidden="true" /><span
                            class="sr-only">the bookmark</span
                        >
                        in the top bar.
                    </p>
                </div>
            {/if}
        </div>
    </div>
    <div
        class="panel"
        role="tabpanel"
        id="dashboard-panel-history"
        aria-labelledby="dashboard-tab-history"
        hidden={tab !== 'history'}
    >
        {#if historyOpened}<DashboardHistory />{/if}
    </div>
    <div
        class="panel"
        role="tabpanel"
        id="dashboard-panel-stats"
        aria-labelledby="dashboard-tab-stats"
        hidden={tab !== 'stats'}
    >
        {#if tab === 'stats'}<DashboardStats />{/if}
    </div>
</main>

<style>
    .dashboard {
        height: calc(100dvh - var(--app-navbar-height, 0px) - var(--app-banner-height, 0px));
        display: flex;
        flex-direction: column;
        color: var(--color-gray-200);
    }
    .page-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        flex-shrink: 0;
    }
    .find-game {
        color: var(--color-blue-300);
        font-size: 14px;
        white-space: nowrap;
    }
    .find-game:hover {
        text-decoration: underline;
    }
    .navigation {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        border-bottom: 1px solid var(--color-gray-700);
        flex-shrink: 0;
    }
    .collection-tab {
        color: var(--color-gray-400);
        border-color: transparent;
    }
    .collection-tab:hover {
        color: var(--color-gray-100);
    }
    [role='tab'][aria-selected='true'] {
        color: var(--color-gray-100);
        border-color: var(--color-blue-400);
    }
    .count {
        margin-left: 6px;
        font-size: 12px;
        color: var(--color-gray-400);
    }
    @media (width < 640px) {
        .count {
            display: none;
        }
    }
    .panel {
        padding-top: 24px;
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
    }
    .panel[hidden] {
        display: none;
    }
    .current-results,
    .following-results {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 2px 4px 48px;
        margin: -2px -4px 0;
    }
    .empty {
        border: 1px solid var(--color-gray-800);
        border-radius: 12px;
        padding: 28px;
        color: var(--color-gray-400);
        font-size: 14px;
    }
    .empty .hint {
        margin-top: 8px;
    }
    .empty :global(.inline-icon) {
        display: inline-block;
        width: 16px;
        height: 16px;
        vertical-align: -3px;
        color: var(--color-gray-300);
    }
    .empty a {
        display: inline-block;
        margin-top: 12px;
        color: var(--color-blue-300);
    }
    button:not([role='tab']):focus-visible,
    a:focus-visible {
        outline: 2px solid var(--color-blue-400);
        outline-offset: 4px;
    }
    @media (max-width: 700px) {
        .page-heading {
            flex-wrap: wrap;
            gap: 10px;
        }
        .navigation {
            gap: 10px;
        }
    }
</style>
