<script lang="ts">
    import type { GameSession } from '@tabletop/frontend-components'
    import { requireFinanceExampleState } from '@tabletop/18xx'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import {
        FinanceInspector,
        StockTrading,
        StockMarket,
        requireFinanceExampleSession
    } from '@tabletop/18xx-ui'
    let { gameSession }: { gameSession: GameSession<GameState, HydratedGameState> } = $props()
    const session = $derived(requireFinanceExampleSession(gameSession))
    const state = $derived(requireFinanceExampleState(gameSession.gameState))
</script>

<StockTrading {session} />
<StockMarket market={state.stockMarket} companies={state.companies} />

<FinanceInspector
    certificateWeight={session.certificateWeight}
    {state}
    players={gameSession.game.players}
    playerStates={state.players}
/>
