<script lang="ts">
    import { onMount } from 'svelte'
    import type { GameSession } from '$lib/model/gameSession.svelte.js'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import HotseatPanel from './HotseatPanel.svelte'
    import ExplorationPanel from './ExplorationPanel.svelte'
    import HistoryKeyControls from './HistoryKeyControls.svelte'
    import { setGameSession } from '$lib/model/gameSessionContext.js'
    import GameUI from './GameUI.svelte'

    let { gameSession }: { gameSession: GameSession<GameState, HydratedGameState> } = $props()
    let bannerShell: HTMLDivElement | undefined = $state()

    // svelte-ignore state_referenced_locally
    setGameSession(gameSession)

    onMount(() => {
        if (typeof document === 'undefined') {
            return
        }

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

        return () => {
            observer.disconnect()
            rootStyle.removeProperty('--app-banner-height')
        }
    })
</script>

<HistoryKeyControls />

<div bind:this={bannerShell}>
    {#if gameSession.isExploring}
        <ExplorationPanel />
    {:else if gameSession.game.hotseat}
        <HotseatPanel />
    {/if}
</div>
<GameUI {gameSession} />
