<script lang="ts">
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import DashboardGameList from '$lib/components/DashboardGameList.svelte'
    import DashboardHistory from '$lib/components/DashboardHistory.svelte'
    import { currentDashboardGames, isUsersGameTurn } from '$lib/utils/dashboardGames'

    const { gameService, authorizationService } = getAppContext()
    let tab = $state<'current' | 'history'>('current')
    let historyOpened = $state(false)
    let onlyMyTurn = $state(false)
    const userId = $derived(authorizationService.getSessionUser()?.id)
    const games = $derived(
        currentDashboardGames(gameService.activeGames, gameService.waitingGames, userId)
    )
    const turnCount = $derived(games.filter((game) => isUsersGameTurn(game, userId)).length)
    const visible = $derived(games.filter((game) => !onlyMyTurn || isUsersGameTurn(game, userId)))

    function selectTab(selected: 'current' | 'history') {
        tab = selected
        if (selected === 'history') historyOpened = true
    }
    function moveTab(event: KeyboardEvent) {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        selectTab(
            event.key === 'Home'
                ? 'current'
                : event.key === 'End'
                  ? 'history'
                  : tab === 'current'
                    ? 'history'
                    : 'current'
        )
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
            {#each ['current', 'history'] as choice}
                {@const selected = choice === 'current' ? 'current' : 'history'}
                <button
                    class="collection-tab"
                    id={`dashboard-tab-${selected}`}
                    role="tab"
                    aria-selected={tab === selected}
                    aria-controls={`dashboard-panel-${selected}`}
                    tabindex={tab === selected ? 0 : -1}
                    onclick={() => selectTab(selected)}
                    onkeydown={moveTab}
                >
                    {selected === 'current' ? 'Current' : 'History'}
                    {#if selected === 'current'}<span class="count">{games.length}</span>{/if}
                </button>
            {/each}
        </div>
        {#if tab === 'current'}
            <button
                class="turn-filter rounded-md px-2 py-1.5 text-xs"
                class:enabled={onlyMyTurn}
                aria-pressed={onlyMyTurn}
                onclick={() => (onlyMyTurn = !onlyMyTurn)}
            >
                Your turn <span>{turnCount}</span>
            </button>
        {/if}
    </div>
    <div
        class="panel"
        role="tabpanel"
        id="dashboard-panel-current"
        aria-labelledby="dashboard-tab-current"
        hidden={tab !== 'current'}
    >
        <div class="current-results" aria-busy={gameService.loading}>
            {#if visible.length}
                <DashboardGameList games={visible} />
            {:else if gameService.loading}
                <p class="empty" role="status">Loading your games…</p>
            {:else}
                <div class="empty">
                    <p>
                        {onlyMyTurn ? 'You’re all caught up.' : 'Ready for a game?'}
                    </p>
                    {#if !games.length}<a href="/library">Explore the library →</a>{/if}
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
    .turn-filter {
        border: 1px solid var(--color-gray-700);
        color: var(--color-gray-300);
        white-space: nowrap;
    }
    .turn-filter span {
        margin-left: 8px;
        color: var(--color-blue-300);
    }
    .turn-filter.enabled {
        background: var(--color-blue-950);
        border-color: var(--color-blue-400);
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
    .current-results {
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
