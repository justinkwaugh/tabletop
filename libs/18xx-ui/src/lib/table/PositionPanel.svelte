<script lang="ts">
    import { assert, type GameAction } from '@tabletop/common'
    import {
        nextOperatingCompany,
        isOfferAuctionLot,
        isBidOnAuctionLot,
        isPassAuction,
        isRunTrains,
        isPlaceStation,
        isDistributeEarnings,
        isLayTile,
        isLayPrivateTile,
        isRespondToTrackConsent
    } from '@tabletop/18xx'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    import { historyDescription, type HistoryDescription } from './historyDescription.js'
    import { isHistoryBookkeeping, purchaseWithFlotation } from './historyNavigation.js'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import TrainRunTable from '../routes/TrainRunTable.svelte'
    import EarningsCard from '../earnings/EarningsCard.svelte'
    import TrackLayResult from './TrackLayResult.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import GameEnding from '../ending/GameEnding.svelte'
    import AuctionLotCard from '../auctions/AuctionLotCard.svelte'
    import ShareCardStrip from './ShareCardStrip.svelte'

    let {
        session,
        trainColors,
        describeAction
    }: {
        session: EighteenXXSession
        trainColors: Readonly<Record<string, string>>
        describeAction?: (
            action: GameAction,
            companyName: (id: string) => string
        ) => HistoryDescription | undefined
    } = $props()
    const money = $derived(session.presentation.money)
    const state = $derived(session.gameState)
    const actions = $derived(session.actions.slice(0, state.actionCount))
    const company = $derived(
        state.companies.find((company) => company.id === nextOperatingCompany(state))
    )
    const statusLabels: Readonly<Record<string, string>> = {
        OfferingLot: 'Auction offerings',
        OfferBidding: 'Auction bidding',
        WaterfallAuction: 'Private auction',
        AuctionBidding: 'Auction bidding',
        LayingTrack: 'Track construction',
        PlacingStation: 'Station placement',
        RunningTrains: 'Train operations',
        DistributingEarnings: 'Revenue distribution',
        BuyingTrains: 'Train purchases',
        FundingTrain: 'Emergency train funding',
        DiscardingTrains: 'Excess trains',
        AdvancingPhase: 'Phase change',
        Bankrupt: 'Bankruptcy'
    }
    const status = $derived(
        state.trackConsent
            ? 'Track permission pending'
            : state.purchaseOffer
              ? 'Purchase offer pending'
              : state.privateTrackLay
                ? 'Private tile placement'
                : [
                        'StockRound',
                        'OperatingSet',
                        'LayingTrack',
                        'PlacingStation',
                        'RunningTrains',
                        'DistributingEarnings',
                        'BuyingTrains'
                    ].includes(state.machineState)
                  ? undefined
                  : statusLabels[state.machineState]
    )
    function companyName(id: string) {
        return state.companies.find((company) => company.id === id)?.name ?? id
    }
    function describe(action: GameAction): HistoryDescription {
        if (isOfferAuctionLot(action) || isBidOnAuctionLot(action)) {
            const lot = session.auctionLotsFor(state).find((lot) => lot.id === action.lotId)
            assert(lot, 'Recorded auction requires its lot')
            return isOfferAuctionLot(action)
                ? { text: `offered ${lot.name} for auction at ${money(lot.price)}` }
                : { text: `bid ${money(action.amount)} for ${lot.name}` }
        }
        if (isPassAuction(action)) return { text: 'passed' }
        return (
            describeAction?.(action, companyName) ??
            historyDescription(
                action,
                state,
                companyName,
                (id) => session.getPlayerName(id),
                undefined,
                session.presentation.money
            )
        )
    }
    const latest = $derived.by(() => {
        const paired = purchaseWithFlotation(actions)
        const action = paired?.flotation ?? actions.findLast((item) => !isHistoryBookkeeping(item))
        if (!action) return
        const description = describe(action)
        if (description.routine) return
        const purchase = paired?.purchase
        const actor = description.omitActor
            ? undefined
            : 'companyId' in action && typeof action.companyId === 'string'
              ? action.companyId === company?.id
                  ? undefined
                  : companyName(action.companyId)
              : action.playerId
                ? session.getPlayerName(action.playerId)
                : undefined
        const track =
            isLayTile(action) || isLayPrivateTile(action)
                ? action.metadata
                : isRespondToTrackConsent(action) && action.metadata?.accepted
                  ? action.metadata.request.details
                  : undefined
        // A pass belongs to the bidding opened by the most recent offer or bid before it.
        const lotAction = isPassAuction(action)
            ? actions
                  .slice(0, actions.indexOf(action))
                  .findLast((item) => !isPassAuction(item) && !isHistoryBookkeeping(item))
            : action
        const lot =
            lotAction && (isOfferAuctionLot(lotAction) || isBidOnAuctionLot(lotAction))
                ? session.auctionLotsFor(state).find((lot) => lot.id === lotAction.lotId)
                : undefined
        const share = lot
            ? state.certificates.find((item) => item.id === lot.id && item.kind === 'share')
            : undefined
        return {
            station: isPlaceStation(action) ? action : undefined,
            track,
            description,
            actor,
            shareCards: session.shareCards(action),
            lot: lot
                ? {
                      ...lot,
                      company: session.privates.companies.find((item) => item.id === lot.id),
                      token:
                          session.privateCompanyTokens[lot.id] ??
                          (share ? session.mapView.stations[share.companyId] : undefined)
                  }
                : undefined,
            purchase: purchase
                ? {
                      description: describe(purchase),
                      actor: purchase.playerId
                          ? session.getPlayerName(purchase.playerId)
                          : undefined
                  }
                : undefined,
            isRun: isRunTrains(action),
            payout: isDistributeEarnings(action) ? action : undefined
        }
    })
    const result = $derived(state.routeStep?.result)
    const turnPlayerId = $derived(state.turnManager.currentTurn()?.playerId)
</script>

{#if state.result}
    <GameEnding {session} position={state} />
{:else}
    <section class="position centered-panel" aria-label="Position summary">
        {#if !session.isViewingHistory && turnPlayerId}
            <div class="turn" role="status" aria-label="Active player">
                <span
                    class="player-color"
                    style:background={session.colors.getPlayerBgColorValue(turnPlayerId)}
                    aria-hidden="true"
                ></span><span
                    ><span class="possessive"
                        ><strong>{session.getPlayerName(turnPlayerId)}</strong>’s</span
                    > turn</span
                >
            </div>
        {/if}
        {#if !session.isViewingHistory && latest}
            <header class="last-action"><strong>Last action</strong></header>
        {:else if session.isViewingHistory && status}<header>
                <strong>{status}</strong>
            </header>{/if}
        {#if latest?.isRun && result && result.routes.length}
            <div class="run-table">
                <TrainRunTable
                    {money}
                    {result}
                    {trainColors}
                    label="Recorded train runs"
                    trains={state.trainInventory.trains.filter((train) =>
                        result.routes.some((route) => route.trainId === train.id)
                    )}
                    trainName={(id) => session.trainDepot.trainDefinition(id).name}
                />
            </div>
        {/if}
        {#if latest?.station}
            <div class="station-result">
                <span>Placed</span>
                <CompanyToken
                    appearance={session.mapView.stations[latest.station.companyId]}
                    size={28}
                />
                <span>for {money(latest.station.expectedCost)}</span>
            </div>
        {/if}
        {#if latest?.track}
            <TrackLayResult
                {money}
                details={latest.track}
                map={session.mapView.map}
                tileSet={session.mapView.tileSet}
            />
        {/if}
        {#if latest?.payout}
            <div class="payout-card">
                <EarningsCard
                    {money}
                    choice={latest.payout.choice}
                    details={latest.payout.metadata}
                    label={latest.description.text}
                    companyId={latest.payout.companyId}
                    stockMarket={state.stockMarket}
                    ownerName={(owner) =>
                        owner.kind === 'player'
                            ? session.getPlayerName(owner.playerId)
                            : owner.kind === 'bank'
                              ? state.bank.name
                              : companyName(owner.companyId)}
                />
            </div>
        {/if}
        {#if latest && !latest.station && !latest.track && !latest.payout && !(latest.isRun && result?.routes.length)}
            <div class="event">
                {#if latest.purchase}
                    <p>
                        {#if latest.purchase.actor}<strong class="actor"
                                >{latest.purchase.actor}</strong
                            >
                        {/if}{latest.purchase.description.text}
                    </p>
                    {#if latest.purchase.description.detail}<p class="detail">
                            {latest.purchase.description.detail}
                        </p>{/if}
                {/if}
                <p>
                    {#if latest.actor && !latest.purchase}<strong class="actor"
                            >{latest.actor}</strong
                        >
                    {/if}{latest.description
                        .text}{#if !latest.isRun && latest.description.trainDefinitionIds?.length}
                        <span class="trains"
                            >{#each latest.description.trainDefinitionIds as id}<TrainBadge
                                    name={session.trainDepot.trainDefinition(id).name}
                                    color={trainColors[id]}
                                />{/each}</span
                        >
                    {/if}{#if latest.description.value}
                        · {latest.description.value}{/if}
                </p>
                {#if latest.description.detail}<p class="detail">
                        {latest.description.detail}
                    </p>{/if}
            </div>
            {#if latest.shareCards.length}
                <div class="share-strip"><ShareCardStrip cards={latest.shareCards} stacked /></div>
            {/if}
            {#if latest.lot}
                <div class="lot-card">
                    <AuctionLotCard
                        {session}
                        id={latest.lot.id}
                        name={latest.lot.name}
                        price={latest.lot.price}
                        income={latest.lot.company?.privateRevenue}
                        description={latest.lot.company?.description ?? ''}
                        token={latest.lot.token}
                    />
                </div>
            {/if}
        {/if}
    </section>
{/if}

<style>
    .position {
        padding: 6px 0;
        color: var(--rail-text, #514536);
        font-size: 13px;
    }
    .turn {
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 6px 0 28px;
        font-size: 26px;
        line-height: 32px;
        color: var(--rail-muted, #7f8e9e);
    }
    .possessive {
        white-space: nowrap;
    }
    .turn strong {
        font-weight: 700;
        color: var(--rail-text, #e3e9ef);
    }
    .player-color {
        width: 20px;
        height: 20px;
        margin-right: 10px;
        flex-shrink: 0;
        border-radius: 50%;
    }
    header {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 8px;
    }
    .last-action {
        margin-bottom: 2px;
    }
    .last-action + .event,
    .last-action + .run-table {
        margin-top: 0;
    }
    header strong {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 500;
    }
    .trains {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-left: 4px;
        vertical-align: middle;
    }
    .event {
        text-align: center;
        margin-top: 8px;
    }
    .share-strip {
        display: flex;
        justify-content: center;
        margin-top: 6px;
        --share-card-height: 150px;
    }
    .share-strip :global(.share-cards) {
        justify-content: center;
    }
    .lot-card {
        display: flex;
        justify-content: center;
        margin-top: 12px;
        width: 300px;
        max-width: 100%;
        margin-inline: auto;
        text-align: left;
    }
    .lot-card :global(.private-card:not(.image)) {
        width: 100%;
    }
    p {
        margin: 2px 0;
    }
    .actor {
        margin-right: 4px;
    }
    .detail {
        font-size: 12px;
        color: var(--rail-text, #786550);
    }
    .station-result {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
    }
    .payout-card {
        display: flex;
        justify-content: center;
        padding: 4px 0;
        font-size: 12px;
    }
    .run-table {
        display: flex;
        justify-content: center;
        margin-top: 8px;
        color: var(--rail-text, #463e35);
    }
</style>
