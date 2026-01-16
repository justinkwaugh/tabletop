<script lang="ts">
    import {
        ExplorationPanel,
        GameSession,
        HotseatPanel,
        setGameSession,
        HistoryKeyControls,
        getAppContext,
        AdminPanel,
        GameUI
    } from '@tabletop/frontend-components'

    import { onMount } from 'svelte'
    import type { GameState, HydratedGameState } from '@tabletop/common'

    let { data }: { data: { gameSession: GameSession<GameState, HydratedGameState> } } = $props()

    // svelte-ignore state_referenced_locally
    setGameSession(data.gameSession)

    let { gameService, notificationService, authorizationService, chatService } = getAppContext()

    onMount(() => {
        const gameSession = data.gameSession
        gameService.currentGameSession = gameSession

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
    <GameUI definition={data.gameSession.definition} gameSession={data.gameSession} />
</div>
