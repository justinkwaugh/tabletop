<script lang="ts">
    import OpeningAuction from './OpeningAuction.svelte'
    import type { GameSession } from '@tabletop/frontend-components'
    import { requireFinanceExampleState } from '@tabletop/18xx'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import {
        GameEnding,
        FinanceInspector,
        FinanceMap,
        TrainBuying,
        PrivateCompanies,
        CompanyDecisions,
        StockTrading,
        StockMarket,
        requireFinanceExampleSession
    } from '@tabletop/18xx-ui'
    let { gameSession }: { gameSession: GameSession<GameState, HydratedGameState> } = $props()
    const session = $derived(requireFinanceExampleSession(gameSession))
    const state = $derived(requireFinanceExampleState(gameSession.gameState))
</script>

<GameEnding {session} />

{#if session.auction && !session.auction.auction.completed}
    <OpeningAuction {session} />
{:else}
    <CompanyDecisions {session} />
    <PrivateCompanies {session} />
    <TrainBuying {session} />
    <FinanceMap {session} />
    <StockTrading {session} />
    <StockMarket market={state.stockMarket} companies={state.companies} />
{/if}

<FinanceInspector
    stations={state.stations}
    stationReservations={state.stationReservations}
    certificateWeight={session.certificateWeight}
    {state}
    players={gameSession.game.players}
    playerStates={state.players}
/>
