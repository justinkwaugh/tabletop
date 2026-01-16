<script lang="ts">
    import type { GameSession } from '$lib/model/gameSession.svelte.js'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import HotseatPanel from './HotseatPanel.svelte'
    import ExplorationPanel from './ExplorationPanel.svelte'
    import HistoryKeyControls from './HistoryKeyControls.svelte'
    import { setGameSession } from '$lib/model/gameSessionContext.js'
    import GameUI from './GameUI.svelte'

    let { gameSession }: { gameSession: GameSession<GameState, HydratedGameState> } = $props()

    // svelte-ignore state_referenced_locally
    setGameSession(gameSession)
</script>

<HistoryKeyControls />

{#if gameSession.isExploring}
    <ExplorationPanel />
{:else if gameSession.game.hotseat}
    <HotseatPanel />
{/if}
<GameUI {gameSession} />
