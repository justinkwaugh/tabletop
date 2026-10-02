<script lang="ts">
    import type { GameSession } from '@tabletop/frontend-components'
    import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'
    import {
        GameTable,
        OperatingActions,
        SelectionAuctionBidding,
        SelectionAuctionLots,
        type HistoryDescription
    } from '@tabletop/18xx-ui'
    import type { GameAction } from '@tabletop/common'
    import {
        isBuyBackShares,
        isBuyOwedStations,
        isCloseMarketShorts,
        isLiquidateCompany,
        isShortShare
    } from '@tabletop/1817'
    import CorporateActions from './CorporateActions.svelte'
    import ShortSelling from './ShortSelling.svelte'
    import { requireEighteenSeventeenSession } from './session.svelte.js'
    function createRouteWorker() {
        return new Worker(new URL('./autorouter.worker.js', import.meta.url), { type: 'module' })
    }
    let { gameSession }: { gameSession: GameSession<EighteenXXState, HydratedEighteenXXState> } =
        $props()
    const session = $derived(requireEighteenSeventeenSession(gameSession))
    const privateOperationDescription = () => undefined
    const reasons = {
        'no-train': 'it has no train',
        'unpaid-stations': 'it did not pay for its stations'
    }
    function historyDescription(
        action: GameAction,
        companyName: (id: string) => string
    ): HistoryDescription | undefined {
        const money = session.presentation.money
        if (isLiquidateCompany(action))
            return {
                text: `${companyName(action.companyId)} liquidated: ${reasons[action.reason]}`,
                omitActor: true,
                important: true
            }
        if (isBuyOwedStations(action) && action.metadata)
            return {
                text: `${companyName(action.companyId)} bought ${action.metadata.stations} ${action.metadata.stations === 1 ? 'station' : 'stations'}`,
                omitActor: true,
                value: money(action.metadata.payment.amount)
            }
        if (isBuyBackShares(action))
            return {
                text: `Bought back ${action.certificateIds.length} ${companyName(action.companyId)} ${action.certificateIds.length === 1 ? 'share' : 'shares'}`,
                value: action.metadata ? money(action.metadata.payment.amount) : undefined
            }
        if (isShortShare(action))
            return {
                text: `Shorted ${companyName(action.companyId)}`,
                value: money(action.expectedPrice)
            }
        if (isCloseMarketShorts(action) && action.metadata)
            return {
                text: `Market closed ${action.metadata.closed} ${companyName(action.companyId)} ${action.metadata.closed === 1 ? 'short' : 'shorts'}`,
                omitActor: true,
                detail: action.metadata.payments.length
                    ? `The bank bought ${action.metadata.payments.length} from the treasury`
                    : undefined
            }
        return undefined
    }
</script>

<GameTable {session} {privateOperationDescription} {historyDescription}>
    {#snippet actions(_focusLocation, focusRoute)}
        {#if session.selectionAuction.active}
            {#if session.selectionAuction.model?.auction.bidding}
                <SelectionAuctionBidding {session} />
            {:else}
                <SelectionAuctionLots {session} />
            {/if}
        {:else}
            {#if session.gameState.machineState === 'StockRound'}<CorporateActions
                    {session}
                /><ShortSelling {session} />{/if}
            <OperatingActions
                {privateOperationDescription}
                onFocusRoute={focusRoute}
                {session}
                {createRouteWorker}
            />
        {/if}
    {/snippet}
</GameTable>
