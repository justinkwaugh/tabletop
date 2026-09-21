import type { ScenarioPosition } from '../scenarios/scenarioPosition.js'
import { ActionSource, assert, type GameAction } from '@tabletop/common'
import {
    Definition as Top,
    TheOldPrinceAuctionRules,
    TheOldPrinceStockRules,
    TheOldPrinceCompanyRules,
    TheOldPrinceTrackRules,
    TheOldPrinceTrainRules,
    TheOldPrinceRouteRules,
    TheOldPrinceTrainFundingRules
} from '@tabletop/the-old-prince'
import {
    Definition as Shikoku,
    Shikoku1889AuctionRules,
    Shikoku1889StockRules,
    Shikoku1889CompanyRules,
    Shikoku1889TrackRules,
    Shikoku1889TrainRules,
    Shikoku1889RouteRules,
    Shikoku1889TrainFundingRules
} from '@tabletop/shikoku-1889'
import {
    OfferAuction,
    ReserveBidAuction,
    evaluateCompanyStart,
    evaluateSharePurchase,
    evaluateShareSale,
    exceedsStockLimits,
    TrackConstruction,
    RouteEvaluation,
    TrainPurchase,
    EmergencyTrainFunding,
    discardableTrains,
    trainsOwnedBy,
    type EighteenXXState,
    type TrainRoute
} from '@tabletop/18xx'
import { example } from './stockTestUtils.js'
import { enumerateRouteCandidates } from './routeCandidates.js'
export const FullGameTitles = [
    {
        definition: Top,
        stocks: TheOldPrinceStockRules,
        companies: TheOldPrinceCompanyRules,
        track: TheOldPrinceTrackRules,
        trains: TheOldPrinceTrainRules,
        routes: TheOldPrinceRouteRules,
        funding: TheOldPrinceTrainFundingRules
    },
    {
        definition: Shikoku,
        stocks: Shikoku1889StockRules,
        companies: Shikoku1889CompanyRules,
        track: Shikoku1889TrackRules,
        trains: Shikoku1889TrainRules,
        routes: Shikoku1889RouteRules,
        funding: Shikoku1889TrainFundingRules
    }
]
export class CompleteGameRun {
    readonly game
    readonly engine
    readonly initial
    state: EighteenXXState
    readonly history: GameAction[] = []
    constructor(
        readonly title: (typeof FullGameTitles)[number],
        count: number,
        seed = 5,
        position: ScenarioPosition = 'opening'
    ) {
        const run = example(title.definition, position, count, seed)
        this.game = run.game
        this.engine = run.engine
        this.initial = run.state
        this.state = run.state
    }
    act(type: string, fields: object = {}) {
        const action = {
            id: `full:${this.state.actionCount}`,
            gameId: this.game.id,
            source: ActionSource.User,
            type,
            playerId: this.state.activePlayerIds[0],
            ...fields
        }
        const result = this.engine.executeCanonicalAction({
            game: this.game,
            state: this.state,
            action
        })
        this.state = result.updatedState
        this.history.push(...result.processedActions)
        this.title.definition.runtime.hydrator.hydrateState(JSON.parse(JSON.stringify(this.state)))
    }
    step(): void {
        const state = this.state,
            playerId = state.activePlayerIds[0]
        const available = this.engine.getValidActionTypesForPlayer(this.game, state, playerId)
        if (available.includes('RespondToTrackConsent')) {
            this.act('RespondToTrackConsent', { requestId: state.trackConsent!.id, accept: true })
            return
        }
        if (available.includes('DeclinePrivateTile')) {
            this.act('DeclinePrivateTile', {
                privateCompanyId: state.privateTrackLay!.privateCompanyId
            })
            return
        }
        if (state.machineState === 'OfferingLot') {
            const auction = new OfferAuction(state, TheOldPrinceAuctionRules)
            this.act('OfferAuctionLot', { lotId: auction.offerIds[0] })
            return
        }
        if (state.machineState === 'OfferBidding') {
            this.act('PassAuction')
            return
        }
        if (state.machineState === 'WaterfallAuction') {
            const auction = new ReserveBidAuction(state, Shikoku1889AuctionRules)
            const lotId = auction.auction.remainingLotIds[0]
            if (auction.canPurchase(playerId, lotId))
                this.act('BuyAuctionLot', { lotId, expectedPrice: auction.price(lotId) })
            else this.act('PassAuction')
            return
        }
        if (state.machineState === 'StockRound') {
            this.stockTurn()
            return
        }
        if (state.machineState === 'LayingTrack') {
            const construction = new TrackConstruction(state, this.title.track)
            const companyId = state.trackStep!.companyId
            if (!state.trackStep!.lays.length && state.stockRound.number < 5) {
                for (const location of this.title.track.map.definition.locations) {
                    const choice = construction.choices(location.id)[0]
                    if (choice) {
                        const {
                            companyId,
                            locationId,
                            definitionId,
                            rotation,
                            nodeMapping,
                            cost,
                            consentPlayerId
                        } = choice
                        this.act(
                            consentPlayerId && consentPlayerId !== playerId
                                ? 'RequestTrackConsent'
                                : 'LayTile',
                            {
                                companyId,
                                locationId,
                                definitionId,
                                rotation,
                                nodeMapping,
                                expectedCost: cost
                            }
                        )
                        return
                    }
                }
            }
            this.act('FinishTrack', { companyId })
            return
        }
        if (state.machineState === 'PlacingStation') {
            this.act('FinishStations', { companyId: state.stationStep!.companyId })
            return
        }
        if (state.machineState === 'RunningTrains') {
            const companyId = state.routeStep!.companyId
            this.act('RunTrains', { companyId, routes: this.routes(companyId) })
            return
        }
        if (state.machineState === 'DistributingEarnings') {
            this.act('DistributeEarnings', {
                companyId: state.routeStep!.companyId,
                choice:
                    this.title.definition.info.id === 'the-old-prince' &&
                    trainsOwnedBy(state, { kind: 'company', companyId: state.routeStep!.companyId })
                        .length >= this.title.trains.trainLimit(state, state.routeStep!.companyId)
                        ? 'pay'
                        : 'withhold'
            })
            return
        }
        if (state.machineState === 'BuyingTrains') {
            const companyId = state.trainPurchaseStep!.companyId
            const purchase = new TrainPurchase(state, this.title.trains)
                .offers()
                .find((offer) => offer.evaluation.details)?.evaluation.details
            if (purchase && !state.gameEnding) {
                this.act('BuyTrain', {
                    companyId,
                    trainId: purchase.trainId,
                    definitionId: purchase.definitionId,
                    expectedPrice: purchase.price
                })
                return
            }
            if (available.includes('FinishOperatingTurn')) {
                this.act('FinishOperatingTurn', { companyId })
                return
            }
            const funding = new EmergencyTrainFunding(
                state,
                this.title.funding,
                this.title.stocks,
                this.title.trains
            )
            const request = funding.purchases()[0]
            assert(request, `No purchase or completion: ${companyId}`)
            this.act('FundTrain', {
                companyId,
                trainId: request.trainId,
                definitionId: request.definitionId,
                expectedPrice: request.price
            })
            return
        }
        if (state.machineState === 'FundingTrain') {
            const funding = new EmergencyTrainFunding(
                state,
                this.title.funding,
                this.title.stocks,
                this.title.trains
            )
            const choice = funding.next()
            if (choice.kind === 'issue')
                this.act('IssueTreasuryShares', { expectedProceeds: choice.details.proceeds })
            else if (choice.kind === 'contribute')
                this.act('ContributeTrainFunds', { owner: choice.owner, amount: choice.amount })
            else if (choice.kind === 'sell') {
                const sale = choice.sales.at(-1)!
                this.act('SellFundingShares', {
                    seller: choice.owner,
                    companyId: sale.sales[0].companyId,
                    shares: sale.sales[0].shares,
                    expectedProceeds: sale.proceeds
                })
            } else if (choice.kind === 'buy')
                this.act('BuyTrain', {
                    companyId: choice.purchase.companyId,
                    trainId: choice.purchase.trainId,
                    definitionId: choice.purchase.definitionId,
                    expectedPrice: choice.purchase.price
                })
            else throw Error(`Unexpected funding: ${choice.kind}`)
            return
        }
        if (state.machineState === 'DiscardingTrains') {
            const companyId = state.phaseChange!.discardCompanyIds[0]
            this.act('DiscardTrain', {
                companyId,
                trainId: discardableTrains(state, companyId, this.title.trains)[0].id
            })
            return
        }
        if (available.includes('ContinueOperatingRound')) {
            this.act('ContinueOperatingRound', { companyId: state.privatePowerWindow!.companyId })
            return
        }
        throw Error(`Unhandled ${state.machineState}: ${available.join(',')}`)
    }
    private stockTurn(): void {
        const state = this.state,
            playerId = state.activePlayerIds[0]
        const buyer = { kind: 'player', playerId } as const
        if (exceedsStockLimits(state, buyer, this.title.stocks)) {
            for (const company of state.companies) {
                const sales = [{ companyId: company.id, shares: 1 }]
                const sale = evaluateShareSale(
                    state,
                    { playerId, seller: buyer, sales },
                    this.title.stocks
                ).details
                if (sale) {
                    this.act('SellShares', {
                        seller: buyer,
                        sales,
                        expectedProceeds: sale.proceeds
                    })
                    return
                }
            }
        }
        if (!state.stockRound.turn.bought) {
            for (const certificate of state.certificates) {
                const company = state.companies.find(
                    (company) => company.id === certificate.companyId
                )!
                if (!company.started || company.floated) continue
                const purchase = evaluateSharePurchase(
                    state,
                    { playerId, buyer, certificateId: certificate.id },
                    this.title.stocks
                ).details
                if (purchase) {
                    this.act('BuyShares', {
                        buyer,
                        certificateId: certificate.id,
                        expectedPrice: purchase.price
                    })
                    return
                }
            }
            if (
                state.companies.filter((company) => company.floated).length <
                (this.title.definition.info.id === 'the-old-prince' ? state.companies.length : 2)
            ) {
                for (const company of state.companies) {
                    if (company.started) continue
                    for (const marketSpaceId of this.title.companies.startMarketSpaces(
                        state,
                        company.id
                    )) {
                        const start = evaluateCompanyStart(
                            state,
                            { playerId, buyer, companyId: company.id, marketSpaceId },
                            this.title.stocks,
                            this.title.companies
                        ).details
                        if (start) {
                            this.act('StartCompany', {
                                buyer,
                                companyId: company.id,
                                marketSpaceId,
                                expectedPrice: start.price
                            })
                            return
                        }
                    }
                }
            }
        }
        this.act('FinishStockTurn')
    }
    private routes(companyId: string): TrainRoute[] {
        const running = new RouteEvaluation(this.state, this.title.routes)
        const routes: TrainRoute[] = []
        for (const train of trainsOwnedBy(this.state, { kind: 'company', companyId })) {
            let best: TrainRoute | undefined,
                revenue = -1,
                count = 0
            for (const route of enumerateRouteCandidates(running, companyId, train.id, 100)) {
                const result = running.evaluate(companyId, [...routes, route]).result
                if (result && result.revenue > revenue) {
                    best = route
                    revenue = result.revenue
                }
                if (++count === 500) break
            }
            if (best) routes.push(best)
        }
        return routes
    }
}
