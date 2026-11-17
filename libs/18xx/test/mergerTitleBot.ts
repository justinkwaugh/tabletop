import {
    CompanyAuctionModel,
    StationPlacement,
    corporateFinanceChoices,
    TrackConstruction,
    TrainPurchase,
    evaluateCompanyStart,
    evaluateSharePurchase,
    evaluateShareSale,
    finiteCashOwnedBy,
    getCompany,
    purchaseChoices,
    trainsOwnedBy,
    type Owner
} from '@tabletop/18xx'
import type {
    CompanyRules,
    CorporateFinanceRules,
    EighteenXXState,
    HydratedEighteenXXState,
    MergerRounds,
    RouteRules,
    StationRules,
    StockRules,
    TrackRules,
    TrainRules,
    TransferRules
} from '@tabletop/18xx'
import type { Table as TitleTable } from './titleTestKit.js'

/** What the bot plays with: a title of minors merging into majors and a national company. */
export type MergerTitleBotRules = {
    stockRules: StockRules
    companyRules: CompanyRules
    trackRules: TrackRules
    stationRules: StationRules
    corporateFinanceRules: CorporateFinanceRules
    routeRules: RouteRules
    trainRules: TrainRules
    transferRules: TransferRules
    mergerRounds: MergerRounds
    majorIds: readonly string[]
    privateMinimumBid(privateId: string): number
    /** The best routes for the company, as the autorouter finds them. */
    solveRoutes(state: HydratedEighteenXXState, rules: RouteRules, companyId: string): object[]
}

type Table = TitleTable<EighteenXXState, HydratedEighteenXXState>

type Move = { type: string; fields: object; playerId: string }

/** A small seeded generator, so a game's moves repeat. */
export class Random {
    constructor(private seed: number) {}
    randInt(limit: number): number {
        this.seed = (this.seed * 1103515245 + 12345) % 2147483648
        return Math.floor((this.seed / 2147483648) * limit)
    }
}

function subsets<T>(items: readonly T[]): T[][] {
    return items.reduce<T[][]>((all, item) => [...all, ...all.map((set) => [...set, item])], [[]])
}

/**
 * A simple seeded player for whole-game tests: it buys privates, auctions minors, starts and
 * trades public companies, builds, runs the best routes, buys trains, converts and merges minors,
 * and answers every decision.
 */
export function botMove(rules: MergerTitleBotRules, game: Table, random: Random): Move {
    const {
        stockRules,
        companyRules,
        trackRules,
        stationRules,
        corporateFinanceRules,
        routeRules,
        trainRules,
        transferRules,
        mergerRounds
    } = rules
    const state = game.hydrated
    const playerId = game.player
    if (!playerId) throw new Error(`No one acts in ${state.machineState}`)
    const valid = game.valid(playerId)
    const pick = <T>(items: readonly T[]): T => items[random.randInt(items.length)]
    const me: Owner = { kind: 'player', playerId }
    const cash = finiteCashOwnedBy(state, me)
    const move = (type: string, fields: object = {}): Move => ({ type, fields, playerId })

    if (valid.includes('RespondToPurchaseOffer') && state.purchaseOffer)
        return move('RespondToPurchaseOffer', {
            offerId: state.purchaseOffer.id,
            accept: random.randInt(3) > 0
        })
    if (valid.includes('DiscardTrain')) {
        const companyId = state.phaseChange?.discardCompanyIds[0] ?? ''
        const [train] = trainsOwnedBy(state, { kind: 'company', companyId })
        return move('DiscardTrain', { companyId, trainId: train?.id })
    }

    switch (state.machineState) {
        case 'SelectionAuction': {
            const auction = state.selectionAuction
            const bidding = auction?.bidding
            if (bidding) {
                const minimum =
                    bidding.auction.participants.reduce(
                        (best, participant) => Math.max(best, participant.bid ?? 0),
                        0
                    ) + 5
                if (valid.includes('BidOnAuctionLot') && minimum <= cash && random.randInt(3) === 0)
                    return move('BidOnAuctionLot', { lotId: bidding.lotId, amount: minimum })
                return move('PassSelectionAuction')
            }
            const lotId = auction?.remainingLotIds[0]
            if (lotId && valid.includes('NominateLot') && random.randInt(4) > 0) {
                const amount = Math.max(
                    0,
                    rules.privateMinimumBid(lotId) - (auction?.discount ?? 0)
                )
                if (amount <= cash) return move('NominateLot', { lotId, amount })
            }
            return move('PassSelectionAuction')
        }
        case 'StockRound': {
            const auction = new CompanyAuctionModel(state, stockRules)
            if (state.companyAuction) {
                if (valid.includes('FormCompany'))
                    return move('FormCompany', {
                        companyId: state.companyAuction.companyId,
                        shareCount: 2,
                        privateIds: []
                    })
                const lowest = auction.lowestBid(playerId)
                if (
                    valid.includes('BidForCompany') &&
                    lowest !== undefined &&
                    random.randInt(3) === 0
                )
                    return move('BidForCompany', {
                        companyId: state.companyAuction.companyId,
                        amount: lowest
                    })
                return move('PassCompanyAuction', { companyId: state.companyAuction.companyId })
            }
            const mustSell = !valid.includes('FinishStockTurn')
            if (valid.includes('SellShares') && (mustSell || random.randInt(12) === 0)) {
                for (const company of state.companies) {
                    const sales = [{ companyId: company.id, shares: 1 }]
                    const sale = evaluateShareSale(
                        state,
                        { playerId, seller: me, sales },
                        stockRules
                    )
                    if (sale.details)
                        return move('SellShares', {
                            seller: me,
                            sales,
                            expectedProceeds: sale.details.proceeds
                        })
                }
            }
            if (valid.includes('AuctionCompany') && random.randInt(2) === 0) {
                const minors = state.companies.filter(
                    (company) =>
                        company.kind === 'minor' &&
                        !company.started &&
                        !company.closed &&
                        stockRules.companyAuction?.homes(state, company.id).length
                )
                const lowest = auction.lowestBid(playerId)
                if (minors.length && lowest !== undefined) {
                    const minorId = pick(minors).id
                    const homes = stockRules.companyAuction?.homes(state, minorId) ?? []
                    const home = homes.length === 1 ? homes[0] : pick(homes)
                    return move('AuctionCompany', {
                        companyId: minorId,
                        amount: Math.min(
                            lowest + 5 * random.randInt(4),
                            lowest + 5 * Math.floor((cash - lowest) / 5)
                        ),
                        home: { locationId: home.locationId, nodeId: home.nodeId }
                    })
                }
            }
            if (valid.includes('StartCompany') && random.randInt(3) === 0) {
                for (const companyId of rules.majorIds) {
                    const spaces = companyRules.startMarketSpaces(state, companyId)
                    if (!spaces.length) continue
                    const marketSpaceId = pick(spaces)
                    const homes = companyRules.startHomes?.(state, companyId, marketSpaceId)
                    const home = homes?.length ? pick(homes) : undefined
                    if (!home) continue
                    const request = {
                        playerId,
                        buyer: me,
                        companyId,
                        marketSpaceId,
                        home: { locationId: home.locationId, nodeId: home.nodeId }
                    }
                    const result = evaluateCompanyStart(state, request, stockRules, companyRules)
                    if (result.details) {
                        const { playerId: _, ...fields } = request
                        return move('StartCompany', {
                            ...fields,
                            expectedPrice: result.details.price
                        })
                    }
                }
            }
            if (valid.includes('BuyShares') && random.randInt(3) > 0) {
                const offers = state.certificates.flatMap((certificate) => {
                    const result = evaluateSharePurchase(
                        state,
                        { playerId, buyer: me, certificateId: certificate.id },
                        stockRules
                    )
                    return result.details
                        ? [{ certificateId: certificate.id, price: result.details.price }]
                        : []
                })
                if (offers.length) {
                    const offer = pick(offers)
                    return move('BuyShares', {
                        buyer: me,
                        certificateId: offer.certificateId,
                        expectedPrice: offer.price
                    })
                }
            }
            return move('FinishStockTurn')
        }
        case 'LayingTrack': {
            const companyId = state.trackStep?.companyId ?? ''
            if (valid.includes('LayTile')) {
                const construction = new TrackConstruction(state, trackRules)
                const locations = trackRules.map.definition.locations.filter(
                    (location) => location.buildable !== false && construction.canReach(location.id)
                )
                for (let tries = 0; tries < 16 && locations.length; tries++) {
                    const location = pick(locations)
                    const choices = construction.choices(location.id)
                    if (!choices.length) continue
                    const choice = pick(choices)
                    return move('LayTile', {
                        companyId,
                        locationId: location.id,
                        definitionId: choice.definitionId,
                        rotation: choice.rotation,
                        nodeMapping: choice.nodeMapping,
                        expectedCost: choice.cost
                    })
                }
            }
            return move('FinishTrack', { companyId })
        }
        case 'PlacingStation': {
            const companyId = state.stationStep?.companyId ?? ''
            const station = state.stations.find(
                (entry) => entry.companyId === companyId && entry.status === 'available'
            )
            if (valid.includes('PlaceStation') && station) {
                const choices = new StationPlacement(state, stationRules).choices(station.id)
                if (choices.length && random.randInt(2) === 0) {
                    const { cost, ...request } = pick(choices)
                    return move('PlaceStation', { ...request, expectedCost: cost })
                }
            }
            return move('FinishStations', { companyId })
        }
        case 'RunningTrains': {
            if (valid.includes('CorporateFinance') && random.randInt(3) === 0) {
                const choices = corporateFinanceChoices(state, corporateFinanceRules)
                if (choices.length) return move('CorporateFinance', pick(choices))
            }
            const companyId = state.routeStep?.companyId ?? ''
            return move('RunTrains', {
                companyId,
                routes: rules.solveRoutes(state, routeRules, companyId)
            })
        }
        case 'DistributingEarnings': {
            const companyId = state.routeStep?.companyId ?? ''
            const kind = getCompany(state, companyId).kind
            return move('DistributeEarnings', {
                companyId,
                choice: kind === 'major' ? pick(['pay', 'pay', 'half-pay', 'withhold']) : 'half-pay'
            })
        }
        case 'BuyingTrains': {
            const companyId = state.trainPurchaseStep?.companyId ?? ''
            const owned = trainsOwnedBy(state, { kind: 'company', companyId })
            const others = valid.includes('OfferPurchase')
                ? purchaseChoices(state, playerId, transferRules, trainRules)
                : []
            const treasury = finiteCashOwnedBy(state, { kind: 'company', companyId })
            if (others.length && treasury >= 1 && random.randInt(6) === 0) {
                const choice = pick(others)
                const range = transferRules.priceRange(state, companyId, choice.request.asset)
                const maximum = Math.min(treasury, range?.maximum ?? treasury)
                if (range && maximum >= range.minimum)
                    return move('OfferPurchase', {
                        ...choice.request,
                        price: range.minimum + random.randInt(maximum - range.minimum + 1)
                    })
            }
            const purchase = new TrainPurchase(state, trainRules)
            const offers = [
                ...purchase.offers().flatMap((offer) => offer.evaluation.details ?? []),
                ...purchase.marketOffers().flatMap((evaluation) => evaluation.details ?? [])
            ]
            if (
                offers.length &&
                valid.includes('BuyTrain') &&
                (!owned.length || random.randInt(3) === 0)
            ) {
                const offer = pick(offers)
                return move('BuyTrain', {
                    companyId,
                    trainId: offer.trainId,
                    definitionId: offer.definitionId,
                    expectedPrice: offer.price
                })
            }
            return move(valid.includes('FinishTrains') ? 'FinishTrains' : 'FinishOperatingTurn', {
                companyId
            })
        }
        case 'NationalisingTrainless': {
            const companyId = state.trainlessMajors?.companyIds[0] ?? ''
            return move('DecideTrainlessMajor', { companyId, nationalise: random.randInt(2) === 0 })
        }
        case 'MergerRound': {
            const round = state.mergerRound
            const proposal = round?.proposal
            if (!proposal) {
                const minorId = round?.minorIds[0] ?? ''
                if (random.randInt(3) === 0) {
                    const majors = rules.majorIds.filter(
                        (id) => !getCompany(state, id).started && !getCompany(state, id).closed
                    )
                    const majorId = majors.length ? pick(majors) : undefined
                    if (majorId) {
                        const convert = {
                            kind: 'convert' as const,
                            minorId,
                            minorIds: [minorId],
                            majorId
                        }
                        if (!mergerRounds.reason(state, playerId, convert))
                            return move('ProposeMerger', convert)
                        const others = (round?.minorIds ?? [])
                            .filter((id) => id !== minorId)
                            .slice(0, 4)
                        for (const set of subsets(others)
                            .filter((entry) => entry.length)
                            .slice(0, 8)) {
                            const merge = {
                                kind: 'merge' as const,
                                minorId,
                                minorIds: [minorId, ...set],
                                majorId
                            }
                            if (!mergerRounds.reason(state, playerId, merge))
                                return move('ProposeMerger', merge)
                        }
                    }
                }
                return move('PassMerger', { minorId })
            }
            switch (proposal.stage) {
                case 'consent':
                    return move('AnswerMerger', { accept: random.randInt(3) > 0 })
                case 'stations': {
                    const placed = proposal.minorIds.flatMap((id) =>
                        state.stations.filter(
                            (station) => station.companyId === id && station.status === 'placed'
                        )
                    )
                    for (const set of subsets(placed.map((station) => station.id)))
                        if (!mergerRounds.stationChoiceReason(state, set))
                            return move('ChooseMergerStations', { stationIds: set })
                    throw new Error('No station choice')
                }
                case 'shareholders':
                case 'open': {
                    const available = mergerRounds.sharesAvailable(state, playerId)
                    const most = proposal.stage === 'open' ? Math.min(1, available) : available
                    return move('BuyMergerShares', { shares: random.randInt(most + 1) })
                }
                case 'discard': {
                    const [train] = trainsOwnedBy(state, {
                        kind: 'company',
                        companyId: proposal.majorId
                    })
                    return move('DiscardMergerTrain', { trainId: train?.id })
                }
            }
            break
        }
    }
    throw new Error(`The bot has no move in ${state.machineState}: ${valid.join()}`)
}

/** Plays the table to its end, or to the action limit, returning the moves made. */
export function playOut(
    rules: MergerTitleBotRules,
    game: Table,
    seed: number,
    limit = 8000,
    afterMove: () => void = () => {}
): number {
    const random = new Random(seed)
    let count = 0
    while (game.state.machineState !== 'GameOver' && count < limit) {
        if (!game.state.activePlayerIds.length)
            throw new Error(
                `No one acts in ${game.state.machineState} after move ${count}: ${JSON.stringify(
                    game.actions.slice(-4).map((action) => action.type)
                )}`
            )
        const next = botMove(rules, game, random)
        try {
            game.act(next.type, next.fields, next.playerId)
        } catch (error) {
            throw new Error(
                `Move ${count} ${next.type} ${JSON.stringify(next.fields)} by ${next.playerId} in ${game.state.machineState} failed: ${String(error)}`,
                { cause: error }
            )
        }
        count++
        afterMove()
    }
    return count
}
