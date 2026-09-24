<script lang="ts">
    import { Shikoku1889TrainColors } from './trainPresentation.js'
    import OpeningAuction from './OpeningAuction.svelte'
    import type { GameSession } from '@tabletop/frontend-components'
    import { requireEighteenXXState } from '@tabletop/18xx'
    import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'
    import {
        GameEnding,
        FinanceInspector,
        FinanceMap,
        TrainBuying,
        PrivateCompanies,
        CompanyDecisions,
        StockTrading,
        StockMarket,
        requireEighteenXXSession
    } from '@tabletop/18xx-ui'
    let { gameSession }: { gameSession: GameSession<EighteenXXState, HydratedEighteenXXState> } =
        $props()
    const session = $derived(requireEighteenXXSession(gameSession))
    const gameState = $derived(requireEighteenXXState(gameSession.gameState))
</script>

<GameEnding {session} />

{#if session.waterfall.model && !session.waterfall.model.auction.completed}
    <OpeningAuction {session} />
{:else}
    <CompanyDecisions {session} trainColors={Shikoku1889TrainColors} />
    <PrivateCompanies {session} />
    <TrainBuying {session} trainColors={Shikoku1889TrainColors} />
    <FinanceMap {session} />
    <StockTrading {session} />
    <StockMarket
        animation={session.marketAnimation}
        appearances={session.mapView.stations}
        market={gameState.stockMarket}
        companies={gameState.companies}
    />
{/if}

<FinanceInspector
    stations={gameState.stations}
    stationReservations={gameState.stationReservations}
    certificateWeight={session.certificateWeight}
    {gameState}
    players={gameSession.game.players}
    playerStates={gameState.players}
/>
