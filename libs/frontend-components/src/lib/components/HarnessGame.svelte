<script lang="ts">
    import type { GameSession } from '$lib/model/gameSession.svelte.js'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import HotseatPanel from './HotseatPanel.svelte'
    import ExplorationPanel from './ExplorationPanel.svelte'
    import type { GameTable } from '$lib/definition/gameUiDefinition.js'
    import HistoryKeyControls from './HistoryKeyControls.svelte'
    import { setGameSession } from '$lib/model/gameSessionContext.js'

    let {
        Table,
        gameSession
    }: {
        Table: GameTable<GameState, HydratedGameState>
        gameSession: GameSession<GameState, HydratedGameState>
    } = $props()

    setGameSession(gameSession)
</script>

<HistoryKeyControls />

{#if gameSession.isExploring}
    <ExplorationPanel />
{:else if gameSession.game.hotseat}
    <HotseatPanel />
{/if}
<Table {gameSession} />
