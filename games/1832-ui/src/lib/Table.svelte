<script lang="ts">
    import { assert } from '@tabletop/common'
    import type { GameSession } from '@tabletop/frontend-components'
    import type { EighteenThirtyTwoState, HydratedEighteenThirtyTwoState } from '@tabletop/1832'
    import {
        CompanyPar,
        GameTable,
        OperatingActions,
        WaterfallAuctionBidding,
        WaterfallAuctionLots
    } from '@tabletop/18xx-ui'
    import { EighteenThirtyTwoSession } from './session.svelte.js'
    import { describe1832Action } from './history.js'
    import TitleActions from './TitleActions.svelte'
    import CompanyShareActions from './CompanyShareActions.svelte'
    function createRouteWorker() {
        return new Worker(new URL('./autorouter.worker.js', import.meta.url), { type: 'module' })
    }
    let {
        gameSession
    }: { gameSession: GameSession<EighteenThirtyTwoState, HydratedEighteenThirtyTwoState> } =
        $props()
    const session = $derived.by(() => {
        assert(gameSession instanceof EighteenThirtyTwoSession, '1832 requires its title session')
        return gameSession
    })
    const privateOperationDescription = (privateCompanyId: string) =>
        session.privateOperationDescription(privateCompanyId)
</script>

<GameTable
    {session}
    {privateOperationDescription}
    historyDescription={describe1832Action((id) => session.getPlayerName(id))}
    additionalStockActions={session.companyShareActions.length
        ? [
              {
                  label: 'Act for a company',
                  selected: session.stockPanels.open === 'company',
                  onSelect: () => session.stockPanels.choose('company')
              }
          ]
        : []}
>
    {#snippet actions(_focusLocation, focusRoute)}
        {#if session.gameState.pendingPar}
            <CompanyPar {session} />
        {:else if session.waterfall.model && !session.waterfall.model.auction.completed}
            {#if session.waterfall.model.auction.bidding}
                <WaterfallAuctionBidding {session} />
            {:else}
                <WaterfallAuctionLots {session} />
            {/if}
        {:else if session.stockPanels.open === 'company'}
            <CompanyShareActions {session} />
        {:else}
            <TitleActions {session} />
            <OperatingActions
                {privateOperationDescription}
                onFocusRoute={focusRoute}
                {session}
                {createRouteWorker}
            />
        {/if}
    {/snippet}
</GameTable>
