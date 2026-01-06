<script lang="ts">
    import type { AppContext } from '$lib/model/appContext.js'
    import type { GameSession } from '$lib/model/gameSession.svelte.js'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import HotseatPanel from './HotseatPanel.svelte'
    import ExplorationPanel from './ExplorationPanel.svelte'

    import { getContext, setContext, type Component } from 'svelte'

    let {
        Table,
        gameSession
    }: {
        Table: Component
        gameSession: GameSession<GameState, HydratedGameState>
    } = $props()

    let { authorizationService } = getContext('appContext') as AppContext
    console.log('HarnessGame received gameSession with game:', gameSession.game)
    setContext('gameSession', gameSession)
</script>

{#if gameSession.isExploring}
    <ExplorationPanel />
{:else if gameSession.game.hotseat}
    <HotseatPanel />
{/if}
<Table />
