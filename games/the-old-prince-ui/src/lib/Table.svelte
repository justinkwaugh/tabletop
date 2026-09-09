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
    import { peirShares, peirPresident } from '@tabletop/the-old-prince'
    let { gameSession }: { gameSession: GameSession<GameState, HydratedGameState> } = $props()
    const session = $derived(requireFinanceExampleSession(gameSession))
    const state = $derived(requireFinanceExampleState(gameSession.gameState))
</script>

<StockTrading {session} />
<StockMarket market={state.stockMarket} companies={state.companies} />

<p class="peir-summary">
    PEIR: {peirShares(state).length} outstanding shares. President: {gameSession.game.players.find(
        (player) => player.id === peirPresident(state)
    )?.name}. Largest shareholding wins; ties go to the lowest numbered share.
</p>
<FinanceInspector
    certificateWeight={session.certificateWeight}
    {state}
    players={gameSession.game.players}
    playerStates={state.players}
>
    {#snippet certificateDetail(certificate)}
        {#if certificate.kind === 'share' && certificate.companyId === 'PEIR'}
            <p class="share-income">
                1/{peirShares(state).length} of PEIR’s distributed earnings
            </p>
        {/if}
    {/snippet}
</FinanceInspector>

<style>
    .peir-summary {
        margin: 0 0 20px;
        color: #3e5c50;
        font:
            13px/1.5 ui-sans-serif,
            system-ui,
            sans-serif;
    }
    .share-income {
        margin: 6px 0 0;
        color: #46674f;
        font-size: 12px;
    }
</style>
