<script lang="ts">
    import { assert } from '@tabletop/common'
    import type { GameSession } from '@tabletop/frontend-components'
    import type { EighteenThirtyTwoState, HydratedEighteenThirtyTwoState } from '@tabletop/1832'
    import {
        CompanyPar,
        GameTable,
        OperatingActions,
        type TitleActionDescription,
        WaterfallAuctionBidding,
        WaterfallAuctionLots
    } from '@tabletop/18xx-ui'
    import { EighteenThirtyTwoSession } from './session.svelte.js'
    import { describe1832Action } from './history.js'
    import TitleActions from './TitleActions.svelte'
    import CompanyShareActions from './CompanyShareActions.svelte'
    import MergerPhase from './MergerPhase.svelte'
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
    const historyDescription: TitleActionDescription = (action, companyName) =>
        describe1832Action(
            action,
            {
                companyName,
                playerName: (id) => session.getPlayerName(id),
                bankName: session.gameState.bank.name
            },
            session.presentation.money
        )
    const privateOperationDescription = (privateCompanyId: string) =>
        session.privateOperationDescription(privateCompanyId)
</script>

<GameTable
    {session}
    {privateOperationDescription}
    {historyDescription}
    additionalStockActions={session.stockPanels.menuOptions}
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
        {:else if session.mergerDecision}
            <MergerPhase {session} />
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
