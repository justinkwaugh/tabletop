<script lang="ts">
    import {
        ExplorationPanel,
        GameSession,
        HotseatPanel,
        setGameSession,
        HistoryKeyControls,
        getAppContext,
        AdminPanel,
        GameUI,
        attachGlobalCssVarFromRect
    } from '@tabletop/frontend-components'

    import { onMount, untrack } from 'svelte'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import { getAppContext as getSiteContext } from '$lib/stores/appContext.svelte'
    import PlayerVoteStrip from './PlayerVoteStrip.svelte'

    let props: { gameSession: GameSession<GameState, HydratedGameState> } = $props()
    const gameSession = untrack(() => props.gameSession)
    const { isExploring, gameHotseat } = gameSession.bridge

    setGameSession(gameSession)

    let { gameService, notificationService, authorizationService, chatService } = getAppContext()

    onMount(() => {
        gameService.currentGameSession = gameSession

        if (!gameSession.game.hotseat) {
            getSiteContext().gameService.rememberGame(gameSession.game)
            setTimeout(() => {
                notificationService.showPrompt()
            }, 2000)

            gameSession.listenToGame()
        }
        return () => {
            gameSession.stopListeningToGame()
            gameSession.dispose()
            gameService.currentGameSession = undefined
            chatService.clear()
        }
    })
</script>

<HistoryKeyControls />

<div class="flex flex-col w-screen overflow-auto">
    <div {@attach attachGlobalCssVarFromRect('--app-banner-height')}>
        {#if $isExploring}
            <ExplorationPanel />
        {:else if $gameHotseat}
            <HotseatPanel />
        {:else}
            {#if authorizationService.actAsAdmin}
                <AdminPanel />
            {/if}
            <PlayerVoteStrip {gameSession} />
        {/if}
    </div>
    <GameUI {gameSession} />
</div>
