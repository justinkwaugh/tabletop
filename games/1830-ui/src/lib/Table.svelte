<script lang="ts">
    import type { GameSession } from '@tabletop/frontend-components'
    import type { EighteenThirtyState, HydratedEighteenThirtyState } from '@tabletop/1830'
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
    }: { gameSession: GameSession<EighteenThirtyState, HydratedEighteenThirtyState> } = $props()
    const session = $derived(requireEighteenXXSession(gameSession))
    // A company-owned C&StL or D&H power lasts until used or until its hex has a tile.
    const PrivatePowers: Readonly<Record<string, { locationId: string; description: string }>> = {
        CS: {
            locationId: 'B20',
            description:
                'May lay tile 3, 4 or 58 in Burlington (B20) without a connection, besides its own lay.'
        },
        DH: {
            locationId: 'F16',
            description:
                'May lay #57 in Scranton (F16) as its lay for $120, then place a free station there.'
        }
    }
    const privateOperationDescription = (id: string) => {
        const power = PrivatePowers[id]
        const { usedPrivatePowerIds, tileInventory } = session.gameState
        return power &&
            !usedPrivatePowerIds.includes(id) &&
            !tileInventory.placements[power.locationId]
            ? power.description
            : undefined
    }
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
