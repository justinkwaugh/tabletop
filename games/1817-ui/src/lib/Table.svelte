<script lang="ts">
    import type { GameSession } from '@tabletop/frontend-components'
    import type { CashPayment, EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'
    import {
        GameTable,
        OperatingActions,
        SelectionAuctionBidding,
        SelectionAuctionLots,
        departurePaymentsDetail,
        type HistoryDescription
    } from '@tabletop/18xx-ui'
    import { ActionSource, type GameAction } from '@tabletop/common'
    import {
        EighteenSeventeenLoanRules,
        isAcquireCompany,
        isBidToAcquire,
        isCloseCompanySale,
        isDeclineOffer,
        isFinishAcquisitionLoans,
        isOfferCompany,
        isOpenCompanySale,
        isPassOnCompany,
        isRepayAcquiredLoan,
        isSkipCompanySale,
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
    import AcquisitionRound from './AcquisitionRound.svelte'
    import CompanyExcess from './CompanyExcess.svelte'
    import MergerRound from './MergerRound.svelte'
    import { plural } from './plural.js'
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
        const paid = (payments: readonly CashPayment[]) =>
            departurePaymentsDetail(
                payments,
                (owner) =>
                    owner.kind === 'company'
                        ? companyName(owner.companyId)
                        : owner.kind === 'player'
                          ? session.getPlayerName(owner.playerId)
                          : 'Bank',
                money
            )
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
            return {
                text: `Discarded a ${companyName(action.companyId)} train`,
                detail: paid(action.metadata?.departurePayments ?? [])
            }
        if (isOfferCompany(action))
            return { text: `Offered ${companyName(action.companyId)} for sale` }
        if (isDeclineOffer(action)) return { text: `Kept ${companyName(action.companyId)}` }
        if (isOpenCompanySale(action) && action.metadata)
            return {
                text: `${companyName(action.companyId)} auctioned from the ${action.metadata.kind} zone`,
                omitActor: true,
                important: true
            }
        if (isSkipCompanySale(action) && action.reason === 'entered-zone')
            return {
                text: `${companyName(action.companyId)} entered a closing zone and sits out`,
                omitActor: true
            }
        if (isBidToAcquire(action))
            return {
                text: `Bid for ${companyName(action.companyId)}`,
                value: money(action.amount)
            }
        if (isPassOnCompany(action)) return { text: `Passed on ${companyName(action.companyId)}` }
        if (isCloseCompanySale(action))
            return {
                text: action.metadata
                    ? `The bank liquidated ${companyName(action.companyId)}`
                    : `${companyName(action.companyId)} was not sold`,
                omitActor: true,
                detail: paid(action.metadata?.departurePayments ?? []),
                important: !!action.metadata
            }
        if (isAcquireCompany(action) && action.metadata)
            return {
                text: `${companyName(action.buyerId)} acquired ${companyName(action.companyId)}`,
                value: money(action.metadata.price),
                important: true
            }
        if (isRepayAcquiredLoan(action))
            return {
                text: `Repaid a loan ${companyName(action.companyId)} took on`,
                value: money(EighteenSeventeenLoanRules.value)
            }
        if (isFinishAcquisitionLoans(action) && action.metadata)
            return {
                text: `${companyName(action.metadata.targetId)} holders received ${money(action.metadata.settlement.perShare)} a share`,
                omitActor: true
            }
        if (isCloseMarketShorts(action) && action.metadata)
            return {
                text: `Market closed ${plural(action.metadata.closed, `${companyName(action.companyId)} short`)}`,
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
            {#if session.companyExcess}
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
        {/if}
    {/snippet}
</GameTable>
