<script lang="ts">
    import type { GameSession } from '@tabletop/frontend-components'
    import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'
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
    let { gameSession }: { gameSession: GameSession<EighteenXXState, HydratedEighteenXXState> } =
        $props()
    const session = $derived(requireEighteenSeventeenSession(gameSession))
    const privateOperationDescription = () => undefined
    const historyDescription: TitleActionDescription = (action, companyName, shared) => {
        return eighteenSeventeenHistoryDescription(
            action,
            {
                companyName,
                playerName: (id) => session.getPlayerName(id),
                bankName: session.gameState.bank.name
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
    additionalStockActions={[
        ...(session.corporateActions.length
            ? [
                  {
                      label: 'Act for a company',
                      selected: session.stockPanel === 'company',
                      onSelect: () => session.chooseStockPanel('company')
                  }
              ]
            : []),
        ...(session.shorts.length
            ? [
                  {
                      label: 'Short',
                      selected: session.stockPanel === 'short',
                      onSelect: () => session.chooseStockPanel('short')
                  }
              ]
            : [])
    ]}
>
    {#snippet actions(_focusLocation, focusRoute)}
        {#if session.selectionAuction.active}
            {#if session.selectionAuction.model?.auction.bidding}
                <SelectionAuctionBidding {session} />
            {:else}
                <SelectionAuctionLots {session} />
            {/if}
        {:else if session.stockPanel === 'company'}
            <CorporateActions {session} />
        {:else if session.stockPanel === 'short'}
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
