<script lang="ts">
    import type { GameSession } from '@tabletop/frontend-components'
    import { requireFinanceExampleState } from '@tabletop/18xx'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import {
        WaterfallAuctionPanel,
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

{#if session.auction && !session.auction.auction.completed}
    <WaterfallAuctionPanel
        model={session.auction}
        playerId={session.myPlayer?.id}
        playerName={(id) => session.getPlayerName(id)}
        disabled={!session.canAuction}
        draft={session.auctionSelection}
        onChoose={(kind, lotId) => session.selectAuctionLot(kind, lotId)}
        onBidChange={(amount) => session.setAuctionBid(amount)}
        onConfirm={() => session.confirmAuction()}
        onBack={() => session.backAuction()}
        onPass={() => session.passAuction()}
        onUndo={() => session.undo()}
        canUndo={!session.busy &&
            !session.isViewingHistory &&
            Boolean(session.auctionSelection || session.undoableAction)}
    />
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
