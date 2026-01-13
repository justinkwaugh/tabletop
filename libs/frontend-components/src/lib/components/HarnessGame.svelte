<script lang="ts">
    import type { GameSession } from '$lib/model/gameSession.svelte.js'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import HotseatPanel from './HotseatPanel.svelte'
    import ExplorationPanel from './ExplorationPanel.svelte'

    import { setContext } from 'svelte'
    import type { GameTable } from '$lib/definition/gameUiDefinition.js'

    let {
        Table,
        gameSession
    }: {
        Table: GameTable<GameState, HydratedGameState>
        gameSession: GameSession<GameState, HydratedGameState>
    } = $props()

    setContext('gameSession', gameSession)
</script>

{#if gameSession.isExploring}
    <ExplorationPanel />
{:else if gameSession.game.hotseat}
    <HotseatPanel />
{/if}
<Table {gameSession} />
