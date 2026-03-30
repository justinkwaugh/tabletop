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
    const { isExploring, gameHotseat } = data.gameSession.bridge
    let bannerShell: HTMLDivElement | undefined = $state()

    // svelte-ignore state_referenced_locally
    setGameSession(data.gameSession)

    let { gameService, notificationService, authorizationService, chatService } = getAppContext()

    onMount(() => {
        const gameSession = data.gameSession
        const rootStyle = document.documentElement.style
        const updateBannerHeight = () => {
            const height = bannerShell?.getBoundingClientRect().height ?? 0
            rootStyle.setProperty('--app-banner-height', `${height}px`)
        }
        const observer = new ResizeObserver(updateBannerHeight)
        if (bannerShell) {
            observer.observe(bannerShell)
        }
        updateBannerHeight()

        gameService.currentGameSession = gameSession

        if (!gameSession.game.hotseat) {
            setTimeout(() => {
                notificationService.showPrompt()
            }, 2000)

            gameSession.listenToGame()
        }
        return () => {
            observer.disconnect()
            rootStyle.removeProperty('--app-banner-height')
            gameSession.stopListeningToGame()
            gameSession.dispose()
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
    <div bind:this={bannerShell}>
        {#if $isExploring}
            <ExplorationPanel />
        {:else if $gameHotseat}
            <HotseatPanel />
        {/if}
    </div>
    <GameUI gameSession={data.gameSession} />
</div>
