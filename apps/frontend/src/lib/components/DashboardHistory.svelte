<script lang="ts">
    import { m } from '$lib/paraglide/messages'
    import { onMount } from 'svelte'
    import { GameCategory, type Game } from '@tabletop/common'
    import { changesFinishedGames, listenForGameListChanges } from '$lib/services/gameListUpdates'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import DashboardGameList from './DashboardGameList.svelte'
    import { historyGames } from '$lib/utils/historyGames'

    const { api, gameService, notificationService } = getAppContext()
    let games = $state<Game[]>([])
    let cursor: string | undefined
    let exhausted = $state(false)
    let busy = $state(false)
    let failed = $state(false)
    let visibleLimit = $state(20)
    let disposed = false
    let refreshPending = false
    const finished = $derived(
        historyGames(
            games.filter((game) => game.category !== GameCategory.Exploration),
            gameService.finishedLocalGames,
            { allPagesLoaded: exhausted }
        )
    )
    const visible = $derived(finished.slice(0, visibleLimit))

    async function loadGames() {
        if (busy) return
        busy = true
        failed = false
        try {
            while (!disposed && !exhausted && finished.length < visibleLimit) {
                const page = await api.getMyGameHistory(cursor)
                if (disposed) return
                const known = new Set(games.map((game) => game.id))
                games = [...games, ...page.games.filter((game) => !known.has(game.id))]
                cursor = page.nextCursor
                exhausted = cursor === undefined
            }
        } catch {
            if (!disposed) failed = true
        } finally {
            if (!disposed) {
                busy = false
                if (refreshPending) void refresh()
            }
        }
    }
    function loadMore() {
        visibleLimit += 20
        void loadGames()
    }
    function removeGame(game: Game) {
        games = games.filter((item) => item.id !== game.id)
        void loadGames()
    }
    async function refresh() {
        if (busy) {
            refreshPending = true
            return
        }
        refreshPending = false
        games = []
        cursor = undefined
        exhausted = false
        await loadGames()
    }
    onMount(() => {
        const stopListening = listenForGameListChanges(
            notificationService,
            (change) =>
                changesFinishedGames(change) ||
                ('game' in change && games.some((item) => item.id === change.game.id)),
            refresh
        )
        void loadGames()
        return () => {
            disposed = true
            stopListening()
        }
    })
</script>

<div class="history-panel">
    <div class="history-results" aria-busy={busy}>
        {#if visible.length}<DashboardGameList games={visible} ondelete={removeGame} />{/if}
        {#if failed}
            <p class="message" role="alert">
                {m.dashboard_history_load_failed()}
                <button onclick={loadGames}>{m.try_again()}</button>
            </p>
        {:else if busy}
            <p class="message" role="status">{m.dashboard_history_loading()}</p>
        {:else if !visible.length}
            <p class="message">{m.dashboard_history_empty()}</p>
        {/if}
        {#if !failed && !busy && (!exhausted || finished.length > visibleLimit)}
            <button class="load-more" onclick={loadMore}>{m.dashboard_history_load_more()}</button>
        {/if}
        {#if exhausted && visible.length && finished.length <= visibleLimit}
            <p class="end">
                {m.dashboard_history_all_shown({ count: finished.length })}
            </p>
        {/if}
    </div>
</div>

<style>
    .history-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }
    .history-results {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
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
    .message button,
    .load-more {
        color: var(--color-blue-300);
    }
    .load-more {
        display: block;
        margin: 28px auto 0;
        padding: 10px 20px;
        border: 1px solid var(--color-gray-700);
        border-radius: 8px;
    }
    .end {
        text-align: center;
        color: var(--color-gray-500);
        font-size: 13px;
        padding-top: 28px;
    }
</style>
