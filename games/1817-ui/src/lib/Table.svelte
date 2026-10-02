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
    import { ActionSource, type GameAction } from '@tabletop/common'
    import {
        isBuyBackShares,
        isBuyConvertedShare,
        isBuyOwedStations,
        isCloseMarketShorts,
        isConvertCompany,
        isDiscardMergedTrain,
        isFinishConversionLoans,
        isLiquidateCompany,
        isMergeCompanies,
        isPassConvertedShares,
        isPassMerger,
        isRemoveStation,
        isShortShare
    } from '@tabletop/1817'
    import CorporateActions from './CorporateActions.svelte'
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
    const reasons = {
        'no-train': 'it has no train',
        'unpaid-stations': 'it did not pay for its stations'
    }
    const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`
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
                text: `${companyName(action.companyId)} bought ${plural(action.metadata.stations, 'station')}`,
                omitActor: true,
                value: money(action.metadata.payment.amount)
            }
        if (isBuyBackShares(action))
            return {
                text: `Bought back ${plural(action.certificateIds.length, `${companyName(action.companyId)} share`)}`,
                value: action.metadata ? money(action.metadata.payment.amount) : undefined
            }
        if (isShortShare(action))
            return {
                text: `Shorted ${companyName(action.companyId)}`,
                value: money(action.expectedPrice)
            }
        if (isConvertCompany(action) && action.metadata)
            return {
                text: `Converted ${companyName(action.companyId)} to ${action.metadata.shareCount} shares`,
                important: true
            }
        if (isMergeCompanies(action) && action.metadata)
            return {
                text: `Merged ${companyName(action.targetId)} into ${companyName(action.companyId)}`,
                value: money(action.metadata.price),
                important: true
            }
        if (isPassMerger(action) && action.source === ActionSource.User)
            return { text: `Passed with ${companyName(action.companyId)}` }
        if (isBuyConvertedShare(action))
            return {
                text: `Bought a ${companyName(action.companyId)} share`,
                value: money(action.expectedPrice)
            }
        if (isPassConvertedShares(action) && action.source === ActionSource.User)
            return { text: `Bought no more ${companyName(action.companyId)} shares` }
        if (isFinishConversionLoans(action) && action.metadata?.liquidation)
            return {
                text: `${companyName(action.companyId)} liquidated: it could not pay for its stations`,
                omitActor: true,
                important: true
            }
        if (isFinishConversionLoans(action) && action.metadata?.payment)
            return {
                text: `${companyName(action.companyId)} bought ${plural(action.metadata.stations, 'station')}`,
                omitActor: true,
                value: money(action.metadata.payment.amount)
            }
        if (isRemoveStation(action))
            return { text: `Removed a ${companyName(action.companyId)} station` }
        if (isDiscardMergedTrain(action))
            return { text: `Discarded a ${companyName(action.companyId)} train` }
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
            {#if session.mergerRound}
                <MergerRound {session} />
            {:else}
                <OperatingActions
                    {privateOperationDescription}
                    onFocusRoute={focusRoute}
                    {session}
                    {createRouteWorker}
                />
            {/if}
        {/if}
    {/snippet}
</GameTable>
