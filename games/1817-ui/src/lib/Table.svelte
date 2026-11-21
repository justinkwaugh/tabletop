<script lang="ts">
    import { createRouteWorker } from './routeWorker.js'
    import type { GameSession } from '@tabletop/frontend-components'
    import type { EighteenSeventeenState, HydratedEighteenSeventeenState } from '@tabletop/1817'
    import {
        AcquisitionRoundPanel,
        CompanyExcessPanel,
        ConversionRoundPanel,
        CorporateActionsPanel,
        GameTable,
        OperatingActions,
        SelectionAuctionBidding,
        SelectionAuctionLots,
        ShortSellingPanel,
        type TitleActionDescription
    } from '@tabletop/18xx-ui'
    import { eighteenSeventeenHistoryDescription } from './history.js'
    import { requireEighteenSeventeenSession } from './session.svelte.js'
    let {
        gameSession
    }: { gameSession: GameSession<EighteenSeventeenState, HydratedEighteenSeventeenState> } =
        $props()
    const session = $derived(requireEighteenSeventeenSession(gameSession))
    const privateOperationDescription = () => undefined
    const historyDescription: TitleActionDescription = (action, { companyName }, shared) => {
        return eighteenSeventeenHistoryDescription(
            action,
            {
                companyName,
                playerName: (id) => session.getPlayerName(id),
                poolName: (id) => session.poolName(id),
                bankName: 'Bank'
            },
            session.presentation.money,
            shared
        )
    }
</script>

<GameTable
    {session}
    {privateOperationDescription}
    {createRouteWorker}
    {historyDescription}
    additionalStockActions={session.stockPanels.menuOptions}
>
    {#snippet actions(_focusLocation, focusRoute)}
        {#if session.selectionAuction.active}
            {#if session.selectionAuction.model?.auction.bidding}
                <SelectionAuctionBidding {session} />
            {:else}
                <SelectionAuctionLots {session} />
            {/if}
        {:else if session.stockPanels.open === 'company'}
            <CorporateActionsPanel {session} />
        {:else if session.stockPanels.open === 'short'}
            <ShortSellingPanel {session} />
        {:else if session.excess.current}
            <CompanyExcessPanel {session} excess={session.excess.current} />
        {:else if session.conversions.companyId}
            <ConversionRoundPanel {session} companyId={session.conversions.companyId} />
        {:else if session.acquisitions.companyId}
            <AcquisitionRoundPanel {session} companyId={session.acquisitions.companyId} />
        {:else}
            <OperatingActions {privateOperationDescription} onFocusRoute={focusRoute} {session} />
        {/if}
    {/snippet}
</GameTable>
