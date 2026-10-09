<script lang="ts">
    import type { GameSession } from '@tabletop/frontend-components'
    import type { EighteenSeventeenState, HydratedEighteenSeventeenState } from '@tabletop/1817'
    import {
        GameTable,
        OperatingActions,
        SelectionAuctionBidding,
        SelectionAuctionLots,
        type TitleActionDescription
    } from '@tabletop/18xx-ui'
    import { eighteenSeventeenHistoryDescription } from './history.js'
    import CorporateActions from './CorporateActions.svelte'
    import AcquisitionRound from './AcquisitionRound.svelte'
    import CompanyExcess from './CompanyExcess.svelte'
    import MergerRound from './MergerRound.svelte'
    import ShortSelling from './ShortSelling.svelte'
    import { requireEighteenSeventeenSession } from './session.svelte.js'
    function createRouteWorker() {
        return new Worker(new URL('./autorouter.worker.js', import.meta.url), { type: 'module' })
    }
    let {
        gameSession
    }: { gameSession: GameSession<EighteenSeventeenState, HydratedEighteenSeventeenState> } =
        $props()
    const session = $derived(requireEighteenSeventeenSession(gameSession))
    const privateOperationDescription = () => undefined
    const historyDescription: TitleActionDescription = (action, companyName, shared) => {
        return eighteenSeventeenHistoryDescription(
            action,
            {
                companyName,
                playerName: (id) => session.getPlayerName(id),
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
            <CorporateActions {session} />
        {:else if session.stockPanels.open === 'short'}
            <ShortSelling {session} />
        {:else if session.companyExcess}
            <CompanyExcess {session} excess={session.companyExcess} />
        {:else if session.mergerCompanyId}
            <MergerRound {session} companyId={session.mergerCompanyId} />
        {:else if session.acquisitionCompanyId}
            <AcquisitionRound {session} companyId={session.acquisitionCompanyId} />
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
