<script lang="ts">
    import { createRouteWorker } from './routeWorker.js'
    import type { GameSession } from '@tabletop/frontend-components'
    import type { HydratedState1882, State1882 } from '@tabletop/1882'
    import {
        CompanyPar,
        GameTable,
        OperatingActions,
        WaterfallAuctionLots,
        type TitleActionDescription
    } from '@tabletop/18xx-ui'
    import CentralExchange from './CentralExchange.svelte'
    import { describe1882Action } from './history.js'
    import RebellionMove from './RebellionMove.svelte'
    import { requireSession1882 } from './session.svelte.js'
    let { gameSession }: { gameSession: GameSession<State1882, HydratedState1882> } = $props()
    const session = $derived(requireSession1882(gameSession))
    const privateOperationDescription = () => undefined
    const historyDescription: TitleActionDescription = (action, names) =>
        describe1882Action(action, names, session.presentation.money)
</script>

<GameTable
    {session}
    {privateOperationDescription}
    {createRouteWorker}
    {historyDescription}
    additionalStockActions={session.stockPanels.menuOptions}
>
    {#snippet actions(_focusLocation, focusRoute)}
        {#if session.gameState.pendingPar}
            <CompanyPar {session} />
        {:else if session.waterfall.model && !session.waterfall.model.auction.completed}
            <WaterfallAuctionLots {session} />
        {:else if session.stockPanels.open === 'central'}
            <CentralExchange {session} />
        {:else}
            <OperatingActions {privateOperationDescription} onFocusRoute={focusRoute} {session}>
                {#snippet titleMode(id)}
                    {#if id === 'rebellion'}<RebellionMove {session} />{/if}
                {/snippet}
            </OperatingActions>
        {/if}
    {/snippet}
</GameTable>
