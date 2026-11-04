<script lang="ts">
    import type { GameSession } from '@tabletop/frontend-components'
    import {
        EighteenNinetyFourPrivateCatalog,
        type EighteenNinetyFourState,
        type HydratedEighteenNinetyFourState
    } from '@tabletop/1894'
    import { describe1894Action } from './history.js'
    import { createRouteWorker } from './routeWorker.js'
    import {
        CompanyPar,
        GameTable,
        OperatingActions,
        WaterfallAuctionLots,
        requireEighteenXXSession
    } from '@tabletop/18xx-ui'
    let {
        gameSession
    }: { gameSession: GameSession<EighteenNinetyFourState, HydratedEighteenNinetyFourState> } =
        $props()
    const session = $derived(requireEighteenXXSession(gameSession))
    // A private's power, shown while a company owns it.
    const privateOperationDescription = (id: string) =>
        EighteenNinetyFourPrivateCatalog.definition(id).description
</script>

<GameTable
    {session}
    {privateOperationDescription}
    {createRouteWorker}
    historyDescription={describe1894Action}
>
    {#snippet actions(_focusLocation, focusRoute)}
        {#if session.gameState.pendingPar}
            <CompanyPar {session} />
        {:else if session.waterfall.model && !session.waterfall.model.auction.completed}
            <WaterfallAuctionLots {session} />
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
