<script lang="ts">
    import type { GameSession } from '@tabletop/frontend-components'
    import type { EighteenThirtyTwoState, HydratedEighteenThirtyTwoState } from '@tabletop/1832'
    import {
        CompanyPar,
        GameTable,
        OperatingActions,
        WaterfallAuctionBidding,
        WaterfallAuctionLots,
        requireEighteenXXSession
    } from '@tabletop/18xx-ui'
    function createRouteWorker() {
        return new Worker(new URL('./autorouter.worker.js', import.meta.url), { type: 'module' })
    }
    let {
        gameSession
    }: { gameSession: GameSession<EighteenThirtyTwoState, HydratedEighteenThirtyTwoState> } =
        $props()
    const session = $derived(requireEighteenXXSession(gameSession))
    const privateOperationDescription = (_privateId: string): string | undefined => undefined
</script>

<GameTable {session} {privateOperationDescription}>
    {#snippet actions(_focusLocation, focusRoute)}
        {#if session.gameState.pendingPar}
            <CompanyPar {session} />
        {:else if session.waterfall.model && !session.waterfall.model.auction.completed}
            {#if session.waterfall.model.auction.bidding}
                <WaterfallAuctionBidding {session} />
            {:else}
                <WaterfallAuctionLots {session} />
            {/if}
        {:else}
            <OperatingActions
                {privateOperationDescription}
                onFocusRoute={focusRoute}
                {session}
                {createRouteWorker}
            />
        {/if}
    {/snippet}
</GameTable>
