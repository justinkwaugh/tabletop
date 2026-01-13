<script lang="ts">
    import {
        ExplorationPanel,
        GameSession,
        HotseatPanel,
        setGameSession,
        type GameTable,
        HistoryKeyControls,
        getAppContext
    } from '@tabletop/frontend-components'
    import { onMount } from 'svelte'
    import AdminPanel from '$lib/components/AdminPanel.svelte'
    import type { GameState, HydratedGameState } from '@tabletop/common'

    let { data }: { data: { gameSession: GameSession<GameState, HydratedGameState> } } = $props()

    // svelte-ignore state_referenced_locally
    setGameSession(data.gameSession)

    let { gameService, notificationService, authorizationService, chatService } = getAppContext()

    let Table: GameTable<GameState, HydratedGameState> | null = $state(null)

    onMount(() => {
        const gameSession = data.gameSession

        gameService.currentGameSession = gameSession
        gameSession.definition
            .getTableComponent()
            .then((tableComponent: GameTable<GameState, HydratedGameState>) => {
                Table = tableComponent
            })

        if (!gameSession.game.hotseat) {
            setTimeout(() => {
                notificationService.showPrompt()
            }, 2000)

            gameSession.listenToGame()
        }
        return () => {
            gameSession.stopListeningToGame()
            gameService.currentGameSession = undefined
            chatService.clear()
        }
    })
</script>

<HistoryKeyControls />

<div class="flex flex-col w-screen overflow-auto">
    {#if authorizationService.actAsAdmin}
        <AdminPanel />
    {/if}
    {#if data.gameSession.isExploring}
        <ExplorationPanel />
    {:else if data.gameSession.game.hotseat}
        <HotseatPanel />
    {/if}
    <Table gameSession={data.gameSession} />
</div>
