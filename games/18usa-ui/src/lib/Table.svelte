<script lang="ts">
    import type { GameSession } from '@tabletop/frontend-components'
    import type { EighteenUSAState, HydratedEighteenUSAState } from '@tabletop/18usa'
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
    import Boneyard from './Boneyard.svelte'
    import OperatingTitleMode from './OperatingTitleMode.svelte'
    import { eighteenUSAHistoryDescription } from './history.js'
    import { createRouteWorker } from './routeWorker.js'
    import { requireEighteenUSASession } from './session.svelte.js'
    let { gameSession }: { gameSession: GameSession<EighteenUSAState, HydratedEighteenUSAState> } =
        $props()
    const session = $derived(requireEighteenUSASession(gameSession))
    const privateOperationDescription = () => undefined
    const historyDescription: TitleActionDescription = (action, { companyName }, shared) =>
        eighteenUSAHistoryDescription(
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
            <CorporateActionsPanel {session} titleActions={session.pullmanScrapActions} />
        {:else if session.stockPanels.open === 'short'}
            <ShortSellingPanel {session} />
        {:else if session.excess.current}
            <CompanyExcessPanel {session} excess={session.excess.current} />
        {:else if session.conversions.companyId}
            <ConversionRoundPanel
                {session}
                companyId={session.conversions.companyId}
                titleActions={session.pullmanScrapActions}
            />
        {:else if session.boneyard}
            <Boneyard {session} />
        {:else if session.acquisitions.companyId}
            <AcquisitionRoundPanel
                {session}
                companyId={session.acquisitions.companyId}
                titleActions={session.pullmanScrapActions}
            />
        {:else}
            <OperatingActions {privateOperationDescription} onFocusRoute={focusRoute} {session}>
                {#snippet titleMode(id)}<OperatingTitleMode {session} {id} />{/snippet}
            </OperatingActions>
        {/if}
    {/snippet}
</GameTable>
