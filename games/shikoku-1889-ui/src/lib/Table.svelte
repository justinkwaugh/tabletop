<script lang="ts">
    import type { GameSession } from '@tabletop/frontend-components'
    import { requireFinanceExampleState } from '@tabletop/18xx'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import { FinanceInspector } from '@tabletop/18xx-ui'
    let { gameSession }: { gameSession: GameSession<GameState, HydratedGameState> } = $props()
    const state = $derived(requireFinanceExampleState(gameSession.gameState))
</script>

<FinanceInspector {state} players={gameSession.game.players} playerStates={state.players} />
