<script lang="ts">
    import { assert, type GameAction } from '@tabletop/common'
    import {
        nextOperatingCompany,
        isOfferAuctionLot,
        isBidOnAuctionLot,
        isPassAuction,
        isBuyTrain,
        isBuyPrivateTrain,
        isDistributeEarnings,
        isLayTile,
        isPrivateTileLay,
        isRespondToTrackConsent,
        trainsOwnedBy
    } from '@tabletop/18xx'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import {
        companyLabels,
        historyDescription,
        joinDetails,
        type HistoryDescription,
        type TitleActionDescription
    } from './historyDescription.js'
    import { isHistoryBookkeeping } from './historyNavigation.js'
    import {
        companyActedFor,
        creditedSentence,
        lastActionCredit,
        lastActionPrice,
        lastNotableStep,
        payoutRecipients
    } from './lastAction.js'
    import { auctionLotName } from './auctionHistory.js'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import TrackLayResult from './TrackLayResult.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import GameEnding from '../ending/GameEnding.svelte'
    import ShareCardStrip from './ShareCardStrip.svelte'
    import TurnHeading from './TurnHeading.svelte'
    import { historyPhaseChange } from './historyPhaseChange.js'
    import { contrastingTextColor } from '../colors/contrastingTextColor.js'
    import TrainCardStrip from '../trains/TrainCardStrip.svelte'
    import { shareSign } from './shareCards.js'

    let {
        session,
        trainColors,
        describeAction
    }: {
        session: EighteenXXSessionView
        trainColors: Readonly<Record<string, string>>
        describeAction?: TitleActionDescription
    } = $props()
    const money = $derived(session.presentation.money)
    // While the session swaps in a new visible state, its action list already reflects the new
    // position but its game state does not; hold the last settled pair so the heading and the
    // summary never describe different positions.
    let settled: { gameState: typeof session.gameState; actions: readonly GameAction[] } | undefined
    const position = $derived.by(() => {
        const state = session.gameState
        // The visible context's action count leads the exposed state's while a step is applied.
        const transitioning =
            session.updatingVisibleState || session.currentActionIndex + 1 !== state.actionCount
        if (transitioning && settled) return settled
        settled = { gameState: state, actions: session.actions.slice(0, state.actionCount) }
        return settled
    })
    const gameState = $derived(position.gameState)
    const actions = $derived(position.actions)
    const company = $derived(
        gameState.companies.find((company) => company.id === nextOperatingCompany(gameState))
    )
    const statusLabels: Readonly<Record<string, string>> = {
        OfferingLot: 'Auction offerings',
        OfferBidding: 'Auction bidding',
        WaterfallAuction: 'Private auction',
        AuctionBidding: 'Auction bidding',
        SelectionAuction: 'Private auction',
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
        gameState.trackConsent
            ? 'Track permission pending'
            : gameState.purchaseOffer
              ? 'Purchase offer pending'
              : gameState.privateTrackLay
                ? 'Private tile placement'
                : [
                        'StockRound',
                        'OperatingSet',
                        'LayingTrack',
                        'PlacingStation',
                        'RunningTrains',
                        'DistributingEarnings',
                        'BuyingTrains'
                    ].includes(gameState.machineState)
                  ? undefined
                  : gameState.trainFunding &&
                      trainsOwnedBy(gameState, {
                          kind: 'company',
                          companyId: gameState.trainFunding.purchase.companyId
                      }).length
                    ? // A president's optional help is an ordinary purchase, not an emergency.
                      statusLabels.BuyingTrains
                    : statusLabels[gameState.machineState]
    )
    function companyName(id: string) {
        return session.companyName(id)
    }
    function describe(action: GameAction): HistoryDescription {
        if (isOfferAuctionLot(action) || isBidOnAuctionLot(action)) {
            const lot = session.auctionLotsFor(gameState).find((lot) => lot.id === action.lotId)
            assert(lot, 'Recorded auction requires its lot')
            return isOfferAuctionLot(action)
                ? { text: `Offered ${session.lotName(lot)} for auction at ${money(lot.price)}` }
                : { text: `Bid ${money(action.amount)} for ${session.lotName(lot)}` }
        }
        if (isPassAuction(action)) return { text: 'Passed' }
        const shared = () =>
            historyDescription(
                action,
                gameState,
                session.stockMarketChart,
                companyName,
                (id) => session.getPlayerName(id),
                undefined,
                session.presentation.money,
                (id) =>
                    auctionLotName(id, gameState, session.auctionLotsFor(gameState), companyName),
                (id) => session.names.routeBonus(id)
            )
        return describeAction?.(action, companyName, shared) ?? shared()
    }
    const labels = $derived(
        companyLabels(gameState.companies, (id) => session.companyInitials(id), companyName)
    )
    const step = $derived(lastNotableStep(actions, (action) => !!describe(action).routine))
    function trainCardsFor(action: GameAction, description: HistoryDescription) {
        return (description.trainDefinitionIds ?? []).flatMap((id) => {
            const imageUrl = session.publishedTrainImage(id)
            if (!imageUrl) return []
            const definition = session.trainDepot.trainDefinition(id)
            const paid =
                isBuyTrain(action) || isBuyPrivateTrain(action) ? action.expectedPrice : undefined
            return [
                {
                    id,
                    name: definition.name,
                    imageUrl,
                    price: paid !== undefined && paid !== definition.price ? paid : undefined
                }
            ]
        })
    }
    function auctionLotPassedOn(action: GameAction) {
        if (!isPassAuction(action)) return undefined
        // A pass belongs to the bidding opened by the most recent offer or bid before it.
        const lotAction = actions
            .slice(0, actions.indexOf(action))
            .findLast((item) => !isPassAuction(item) && !isHistoryBookkeeping(item))
        return lotAction && (isOfferAuctionLot(lotAction) || isBidOnAuctionLot(lotAction))
            ? session.auctionLotsFor(gameState).find((lot) => lot.id === lotAction.lotId)
            : undefined
    }
    const latest = $derived.by(() => {
        const [action, ...consequences] = step
        if (!action) return
        const description = describe(action)
        const credit = lastActionCredit(actions, action, description)
        const trainCards = trainCardsFor(action, description)
        const lot = auctionLotPassedOn(action)
        const text = lot
            ? `Passed on ${session.lotName(lot)}`
            : trainCards.length
              ? `${description.text} ${trainCards.map((card) => card.name).join(', ')}`
              : (description.afterActorText ?? description.text)
        const actor =
            credit?.kind === 'company'
                ? companyName(credit.companyId)
                : credit
                  ? session.getPlayerName(credit.playerId)
                  : undefined
        const creditedCompanyId = credit?.kind === 'company' ? credit.companyId : undefined
        return {
            credit,
            sentence: creditedSentence(text, actor, labels),
            price: lastActionPrice(action, description),
            payments: isDistributeEarnings(action)
                ? payoutRecipients(action, (owner) => session.ownerName(owner), money)
                : undefined,
            detail: joinDetails(
                historyPhaseChange(action, session.phaseChangePalette)?.label,
                description.detail
            ),
            trainDefinitionIds: trainCards.length ? [] : (description.trainDefinitionIds ?? []),
            track:
                isLayTile(action) || isPrivateTileLay(action)
                    ? action.metadata
                    : isRespondToTrackConsent(action) && action.metadata?.accepted
                      ? action.metadata.request.details
                      : undefined,
            shareCards: session.shareCards(action),
            shareSign: shareSign(action),
            trainCards,
            consequences: consequences.map((consequence) => {
                const consequenceDescription = describe(consequence)
                const phase = historyPhaseChange(consequence, session.phaseChangePalette)
                const companyId = companyActedFor(consequence)
                return {
                    id: consequence.id,
                    description: consequenceDescription,
                    phase,
                    detail: joinDetails(phase?.label, consequenceDescription.detail),
                    companyId: companyId === creditedCompanyId ? undefined : companyId
                }
            })
        }
    })
    const turnPlayerId = $derived(session.turnPlayerId(gameState))
    const decision = $derived(
        session.isViewingHistory || !gameState.activePlayerIds.length
            ? undefined
            : session.awaitedDecision(gameState)
    )
    const interrupted = $derived(
        !session.isViewingHistory &&
            gameState.activePlayerIds.length > 0 &&
            (!!decision || gameState.activePlayerIds.some((id) => id !== turnPlayerId))
    )
</script>

{#if gameState.result}
    <GameEnding {session} position={gameState} />
{:else}
    <section class="position centered-panel" aria-label="Position summary">
        {#if interrupted}
            <TurnHeading {session} playerIds={gameState.activePlayerIds} waiting />
        {:else if !session.isViewingHistory && turnPlayerId}
            <TurnHeading {session} playerIds={[turnPlayerId]} />
        {/if}
        {#if decision}
            <header class="section-heading"><strong>{decision.title}</strong></header>
            <div class="entry decision" aria-label="Awaited decision">
                <div class="lines">
                    <span class="mark"
                        >{#if decision.companyId && session.mapView.stations[decision.companyId]}<CompanyToken
                                appearance={session.mapView.stations[decision.companyId]}
                                size={18}
                            />{/if}</span
                    >
                    <p class="headline">{decision.text}</p>
                </div>
            </div>
        {/if}
        {#if !session.isViewingHistory && latest}
            <header class="section-heading"><strong>Last action</strong></header>
        {:else if session.isViewingHistory && status}<header>
                <strong>{status}</strong>
            </header>{/if}
        {#if latest}
            <div class="entry" aria-label="Recorded action">
                <div class="lines">
                    <span class="mark"
                        >{#if latest.credit?.kind === 'company' && session.mapView.stations[latest.credit.companyId]}<CompanyToken
                                appearance={session.mapView.stations[latest.credit.companyId]}
                                size={18}
                            />{:else if latest.credit?.kind === 'player'}<span
                                class="player-dot"
                                style:background={session.colors.getPlayerBgColorValue(
                                    latest.credit.playerId
                                )}
                            ></span>{/if}</span
                    >
                    <p class="headline">
                        {#if latest.sentence.actor}<strong>{latest.sentence.actor}</strong
                            >{' '}{/if}{latest.sentence
                            .text}{#if latest.trainDefinitionIds.length}{' '}<span class="trains"
                                >{#each latest.trainDefinitionIds as id, i (i)}<TrainBadge
                                        name={session.trainDepot.trainDefinition(id).name}
                                        color={trainColors[id]}
                                    />{/each}</span
                            >{/if}{#if latest.price}{latest.price.connective === '·'
                                ? ' · '
                                : ' '}<span class="price"
                                >{latest.price.connective === 'for' ? 'for ' : ''}<strong
                                    >{latest.price.amount}</strong
                                ></span
                            >{/if}
                    </p>
                    {#if latest.payments}<p class="detail">{latest.payments}</p>{/if}
                    {#if latest.detail}<p class="detail">{latest.detail}</p>{/if}
                    {#each latest.consequences as consequence (consequence.id)}
                        {@const appearance = consequence.companyId
                            ? session.mapView.stations[consequence.companyId]
                            : undefined}
                        <span class="mark"
                            >{#if appearance}<CompanyToken {appearance} size={16} />{/if}</span
                        >
                        <p
                            class="consequence"
                            class:phase-change={!!consequence.phase}
                            style:--phase-color={consequence.phase?.color}
                            style:--phase-ink={consequence.phase
                                ? contrastingTextColor(consequence.phase.color)
                                : undefined}
                        >
                            <strong>{consequence.description.text}</strong
                            >{#if consequence.description.trainDefinitionIds?.length}{' '}<span
                                    class="trains"
                                    >{#each consequence.description.trainDefinitionIds as id, i (i)}<TrainBadge
                                            name={session.trainDepot.trainDefinition(id).name}
                                            color={trainColors[id]}
                                        />{/each}</span
                                >{/if}{#if consequence.description.value}{` ${consequence.description.value}`}{/if}{#if consequence.detail}{` · ${consequence.detail}`}{/if}
                        </p>
                    {/each}
                </div>
                {#if latest.track || latest.shareCards.length || latest.trainCards.length}
                    <div class="thumb">
                        {#if latest.track}
                            <TrackLayResult
                                details={latest.track}
                                map={session.mapView.map}
                                tileSet={session.mapView.tileSet}
                                layouts={session.mapView.layouts}
                                appearance={session.tileAppearance}
                                size={40}
                            />
                        {/if}
                        {#if latest.shareCards.length}
                            <ShareCardStrip
                                cards={latest.shareCards}
                                stacked
                                sign={latest.shareSign}
                            />
                        {/if}
                        {#if latest.trainCards.length}
                            <TrainCardStrip cards={latest.trainCards} {money} />
                        {/if}
                    </div>
                {/if}
            </div>
        {/if}
    </section>
{/if}

<style>
    .position {
        padding: 6px 0;
        color: var(--rail-text, #514536);
        font-size: 13px;
    }
    header {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 8px;
    }
    .section-heading {
        margin-bottom: 4px;
    }
    .entry.decision {
        margin-bottom: 20px;
    }
    header strong {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 500;
    }
    .entry {
        display: flex;
        align-items: center;
        gap: 12px;
        width: fit-content;
        max-width: min(360px, 100%);
        margin: 0 auto;
        font-variant-numeric: tabular-nums;
    }
    .lines {
        display: grid;
        grid-template-columns: 18px auto;
        column-gap: 6px;
        row-gap: 1px;
        min-width: 0;
    }
    .lines > p:not(.headline):not(.consequence) {
        grid-column: 2;
    }
    .mark {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 18px;
    }
    .mark :global(svg) {
        display: block;
    }
    .thumb {
        flex-shrink: 0;
        --share-card-height: 64px;
        --train-card-width: 72px;
    }
    .thumb :global(.share-cards) {
        position: relative;
    }
    p {
        margin: 0;
    }
    .headline {
        line-height: 18px;
    }
    .headline strong {
        font-weight: 600;
    }
    .price {
        white-space: nowrap;
    }
    .player-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
    }
    .trains {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        vertical-align: middle;
    }
    .detail,
    .consequence {
        font-size: 12px;
        line-height: 16px;
        color: var(--rail-muted, #786550);
    }
    .consequence {
        margin-top: 1px;
    }
    .consequence strong {
        font-weight: 600;
        color: var(--rail-text, #514536);
    }
    .phase-change {
        --rail-text: light-dark(#302c27, var(--phase-ink));
        --rail-muted: light-dark(#817565, var(--phase-ink));
        padding: 1px 6px;
        border-left: 3px solid var(--phase-color);
        border-radius: 2px;
        background: color-mix(
            in srgb,
            var(--phase-color) var(--rail-phase-tint, 32%),
            var(--rail-surface, #f7f5f0)
        );
    }
</style>
