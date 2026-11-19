<script lang="ts">
    import { createRouteWorker } from './routeWorker.js'
    import type { GameSession } from '@tabletop/frontend-components'
    import {
        SulphurSpringsId,
        SulphurSpringsLocationId,
        type HydratedStateRoyalGorge,
        type StateRoyalGorge
    } from '@tabletop/18royalgorge'
    import {
        GameTable,
        OperatingActions,
        SelectionAuctionBidding,
        SelectionAuctionLots,
        type TitleActionDescription
    } from '@tabletop/18xx-ui'
    import DiscountPurchases from './DiscountPurchases.svelte'
    import { describeRoyalGorgeAction } from './history.js'
    import MetalBoard from './MetalBoard.svelte'
    import TitleActions from './TitleActions.svelte'
    import { requireSessionRoyalGorge } from './session.svelte.js'
    let { gameSession }: { gameSession: GameSession<StateRoyalGorge, HydratedStateRoyalGorge> } =
        $props()
    const session = $derived(requireSessionRoyalGorge(gameSession))

    // Only Sulphur Springs is used from the family's private controls (B2, OQ-14).
    const privateOperationDescription = (id: string) =>
        id === SulphurSpringsId
            ? `May close to replace ${session.placeName(SulphurSpringsLocationId)}’s tile with the city of its colour, free and beside its lays.`
            : undefined
    const historyDescription: TitleActionDescription = (action, { companyName, place }) =>
        describeRoyalGorgeAction(
            action,
            {
                companyName,
                place,
                playerName: (id) => session.getPlayerName(id),
                bankName: 'Bank'
            },
            session.presentation.money
        )
</script>

{#snippet metalBoard()}<MetalBoard {session} />{/snippet}

<GameTable
    {session}
    {privateOperationDescription}
    {createRouteWorker}
    {historyDescription}
    additionalStockActions={session.stockPanels.menuOptions}
    boardPanel={{ label: 'CF&I and VGC', content: metalBoard }}
>
    {#snippet actions(_focusLocation, focusRoute)}
        {#if session.selectionAuction.active}
            {#if session.selectionAuction.model?.auction.bidding}
                <SelectionAuctionBidding {session} />
            {:else}
                <SelectionAuctionLots {session} />
            {/if}
        {:else if session.stockPanels.open === 'discount'}
            <DiscountPurchases {session} />
        {:else}
            <TitleActions {session} />
            <OperatingActions {privateOperationDescription} onFocusRoute={focusRoute} {session} />
        {/if}
    {/snippet}
</GameTable>
