<script lang="ts">
    import { onMount } from 'svelte'
    import {
        GameCategory,
        GameStatus,
        GameUpdateNotification,
        GameDeleteNotification,
        GameCreateNotification,
        type Game
    } from '@tabletop/common'
    import * as Value from 'typebox/value'
    import {
        isDataEvent,
        isDiscontinuityEvent,
        NotificationChannel,
        type NotificationListener
    } from '@tabletop/frontend-components'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import DashboardGameList from './DashboardGameList.svelte'

    const { api, notificationService } = getAppContext()
    let games = $state<Game[]>([])
    let cursor: string | undefined
    let exhausted = $state(false)
    let busy = $state(false)
    let failed = $state(false)
    let visibleLimit = $state(20)
    let disposed = false
    let refreshPending = false
    const finished = $derived(games.filter((game) => game.category !== GameCategory.Exploration))
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
        const listener: NotificationListener = async (event) => {
            if (isDiscontinuityEvent(event) && event.channel === NotificationChannel.User) {
                await refresh()
            } else if (isDataEvent(event)) {
                const notification = event.notification
                if (
                    Value.Check(GameUpdateNotification, notification) ||
                    Value.Check(GameDeleteNotification, notification) ||
                    Value.Check(GameCreateNotification, notification)
                ) {
                    const game = notification.data.game
                    if (
                        game.status === GameStatus.Finished ||
                        games.some((item) => item.id === game.id)
                    )
                        await refresh()
                }
            }
        }
        notificationService.addListener(listener)
        void loadGames()
        return () => {
            disposed = true
            notificationService.removeListener(listener)
        }
    })
</script>

<div class="history-panel">
    <div class="history-results" aria-busy={busy}>
        {#if visible.length}<DashboardGameList games={visible} ondelete={removeGame} />{/if}
        {#if failed}
            <p class="message" role="alert">
                History couldn’t load. <button onclick={loadGames}>Try again</button>
            </p>
        {:else if busy}
            <p class="message" role="status">Loading history…</p>
        {:else if !visible.length}
            <p class="message">Your finished games will appear here.</p>
        {/if}
        {#if !failed && !busy && (!exhausted || finished.length > visibleLimit)}
            <button class="load-more" onclick={loadMore}>Load more games</button>
        {/if}
        {#if exhausted && visible.length && finished.length <= visibleLimit}
            <p class="end">
                All {finished.length}
                {finished.length === 1 ? 'game' : 'games'} shown
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
