import {
    EmergencyTrainFunding,
    ReserveBidAuction,
    StationPlacement,
    TrackConstruction,
    TrainPurchase,
    evaluateCompanyStart,
    evaluateSharePurchase,
    evaluateShareSale,
    finiteCashOwnedBy,
    placeableStations,
    presidencyExchangeOptions,
    privateTrackConstruction,
    purchaseChoices,
    trainsOwnedBy,
    trainsOverLimit,
    type Owner
} from '@tabletop/18xx'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { Autorouter } from '@tabletop/18xx-autorouter'
import { KcmoId } from '../src/companies.js'
import { floatedMergeCandidates, unfloatedMergeCandidates } from '../src/merger.js'
import { AuctionRulesMex } from '../src/opening.js'
import {
    PrivatePowerRulesMex,
    TrainFundingRulesMex,
    TrainRulesMex,
    TransferRulesMex
} from '../src/operating.js'
import { RouteRulesMex } from '../src/routes.js'
import { StationRulesMex } from '../src/stations.js'
import { CompanyRulesMex, StockRulesMex } from '../src/stock.js'
import { TrackRulesMex } from '../src/track.js'
import type { Table } from './kit.js'

export const autorouter = await Autorouter.create(
    new Uint8Array(
        await readFile(
            createRequire(import.meta.url).resolve('@tabletop/18xx-autorouter/solver.wasm')
        )
    ).buffer
)

type Move = { type: string; fields: object; playerId: string }

/** A small seeded generator, so a game's moves repeat. */
export class Random {
    constructor(private seed: number) {}
    randInt(limit: number): number {
        this.seed = (this.seed * 1103515245 + 12345) % 2147483648
        return Math.floor((this.seed / 2147483648) * limit)
    }
}

/** A seeded player for whole-game tests, using the title's powers and decisions now and then. */
export function botMove(game: Table, random: Random): Move {
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
            accept: random.randInt(2) === 0
        })
    const exchange = state.presidencyExchanges?.[0]
    if (valid.includes('ChoosePresidencyExchange') && exchange)
        return move('ChoosePresidencyExchange', {
            companyId: exchange.companyId,
            certificateIds: pick(presidencyExchangeOptions(exchange))
        })
    if (valid.includes('ParCompany') && state.pendingPar) {
        const spaces = CompanyRulesMex.awardParSpaces?.(state, state.pendingPar.companyId) ?? []
        return move('ParCompany', {
            companyId: state.pendingPar.companyId,
            marketSpaceId: pick(spaces)
        })
    }
    if (valid.includes('LayPrivateTile') && random.randInt(2) === 0) {
        const terms = PrivatePowerRulesMex.trackTerms(state, KcmoId, playerId)
        if (terms) {
            const construction = privateTrackConstruction(state, terms, TrackRulesMex)
            const choices = terms.locationIds.flatMap((id) => construction.choices(id))
            if (choices.length) {
                const choice = pick(choices)
                return move('LayPrivateTile', {
                    privateCompanyId: KcmoId,
                    companyId: choice.companyId,
                    locationId: choice.locationId,
                    definitionId: choice.definitionId,
                    rotation: choice.rotation,
                    nodeMapping: choice.nodeMapping,
                    expectedCost: choice.cost
                })
            }
        }
    }

    switch (state.machineState) {
        case 'WaterfallAuction':
        case 'AuctionBidding': {
            const auction = new ReserveBidAuction(state, AuctionRulesMex)
            if (valid.includes('RaiseAuctionBid') && auction.auction.bidding) {
                const lotId = auction.auction.bidding.lotId
                const amount = auction.minimumBid(lotId)
                if (random.randInt(3) === 0 && auction.canBid(playerId, lotId, amount))
                    return move('RaiseAuctionBid', { lotId, amount })
                return move('PassAuction')
            }
            const buyable = auction
                .buyOnlyLotIds()
                .filter((lotId) => auction.canPurchase(playerId, lotId))
            if (valid.includes('BuyAuctionLot') && buyable.length && random.randInt(4) > 0) {
                const lotId = pick(buyable)
                return move('BuyAuctionLot', { lotId, expectedPrice: auction.price(lotId) })
            }
            if (valid.includes('ReserveBid') && random.randInt(3) === 0) {
                const lots = auction.auction.remainingLotIds.filter((lotId) =>
                    auction.canBid(playerId, lotId, auction.minimumBid(lotId))
                )
                if (lots.length) {
                    const lotId = pick(lots)
                    return move('ReserveBid', { lotId, amount: auction.minimumBid(lotId) })
                }
            }
            if (cash < 0) throw new Error('Negative cash')
            return move('PassAuction')
        }
        case 'MergingIntoNdM': {
            const stage = state.ndmMerger?.stage
            if (stage === 'offering') {
                const candidates = floatedMergeCandidates(state, playerId)
                if (candidates.length && random.randInt(3) === 0)
                    return move('MergeIntoNdM', { companyId: pick(candidates) })
                return move('DeclineNdMMerger')
            }
            if (stage === 'choosing-company')
                return move('MergeIntoNdM', { companyId: pick(unfloatedMergeCandidates(state)) })
            const choices = state.ndmMerger?.stationChoices ?? []
            return move('ChooseExchangeStation', { locationId: pick(choices).locationId })
        }
        case 'StockRound': {
            const mustSell = !valid.includes('FinishStockTurn')
            if (valid.includes('SellShares') && (mustSell || random.randInt(12) === 0)) {
                for (const company of state.companies) {
                    const sales = [{ companyId: company.id, shares: 1 }]
                    const sale = evaluateShareSale(
                        state,
                        { playerId, seller: me, sales },
                        StockRulesMex
                    )
                    if (sale.details)
                        return move('SellShares', {
                            seller: me,
                            sales,
                            expectedProceeds: sale.details.proceeds
                        })
                }
            }
            if (valid.includes('StartCompany') && random.randInt(2) === 0) {
                for (const company of state.companies) {
                    const spaces = CompanyRulesMex.startMarketSpaces(state, company.id)
                    if (!spaces.length) continue
                    const request = {
                        playerId,
                        buyer: me,
                        companyId: company.id,
                        marketSpaceId: pick(spaces)
                    }
                    const result = evaluateCompanyStart(
                        state,
                        request,
                        StockRulesMex,
                        CompanyRulesMex
                    )
                    if (result.details) {
                        const { playerId: _, ...fields } = request
                        return move('StartCompany', {
                            ...fields,
                            expectedPrice: result.details.price
                        })
                    }
                }
            }
            if (valid.includes('BuyShares') && random.randInt(4) > 0) {
                const offers = state.certificates.flatMap((certificate) => {
                    const result = evaluateSharePurchase(
                        state,
                        { playerId, buyer: me, certificateId: certificate.id },
                        StockRulesMex
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
            if (valid.includes('LayTile') && random.randInt(5) > 0) {
                const construction = new TrackConstruction(state, TrackRulesMex)
                const locations = TrackRulesMex.map.definition.locations.filter(
                    (location) => location.buildable !== false
                )
                for (let tries = 0; tries < 16; tries++) {
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
            const stations = placeableStations(state, StationRulesMex.map, companyId)
            if (valid.includes('PlaceStation') && stations.length) {
                const placement = new StationPlacement(state, StationRulesMex)
                const choices = placement.choices(pick(stations).id)
                if (choices.length) {
                    const { cost, ...request } = pick(choices)
                    return move('PlaceStation', { ...request, expectedCost: cost })
                }
            }
            return move('FinishStations', { companyId })
        }
        case 'RunningTrains': {
            const companyId = state.routeStep?.companyId ?? ''
            const { result } = autorouter.solve(state, RouteRulesMex, companyId, {
                timeLimitMs: 150
            })
            return move('RunTrains', {
                companyId,
                routes: result.routes.map(({ trainId, start, paths }) => ({
                    trainId,
                    start,
                    paths
                }))
            })
        }
        case 'DistributingEarnings': {
            const companyId = state.routeStep?.companyId ?? ''
            return move('DistributeEarnings', {
                companyId,
                choice: valid.length ? pick(['pay', 'pay', 'withhold']) : 'pay'
            })
        }
        case 'DiscardingTrains': {
            const companyId = state.phaseChange?.discardCompanyIds[0] ?? ''
            const trains = trainsOverLimit(state, TrainRulesMex, companyId)
            return move('DiscardTrain', { companyId, trainId: pick(trains).id })
        }
        case 'BuyingTrains': {
            const companyId = state.trainPurchaseStep?.companyId ?? ''
            const owned = trainsOwnedBy(state, { kind: 'company', companyId })
            if (valid.includes('FundTrain') && !owned.length) {
                const funding = new EmergencyTrainFunding(
                    state,
                    TrainFundingRulesMex,
                    StockRulesMex,
                    TrainRulesMex
                )
                const [purchase] = funding.purchases()
                if (purchase)
                    return move('FundTrain', {
                        companyId,
                        trainId: purchase.trainId,
                        definitionId: purchase.definitionId,
                        expectedPrice: purchase.price
                    })
            }
            const choices = valid.includes('OfferPurchase')
                ? purchaseChoices(state, playerId, TransferRulesMex, TrainRulesMex)
                : []
            const treasury = finiteCashOwnedBy(state, { kind: 'company', companyId })
            if (choices.length && random.randInt(3) === 0) {
                const choice = pick(choices)
                if (treasury >= choice.minimum)
                    return move('OfferPurchase', { ...choice.request, price: choice.minimum })
            }
            const purchase = new TrainPurchase(state, TrainRulesMex)
            const offers = [
                ...purchase.offers().map((offer) => offer.evaluation),
                ...purchase.marketOffers()
            ].flatMap((evaluation) => (evaluation.details ? [evaluation.details] : []))
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
        case 'FundingTrain': {
            const funding = new EmergencyTrainFunding(
                state,
                TrainFundingRulesMex,
                StockRulesMex,
                TrainRulesMex
            )
            const next = funding.next()
            if (next.kind === 'sell')
                return move('SellFundingShares', {
                    seller: next.sales[0].seller,
                    companyId: next.sales[0].sales[0].companyId,
                    shares: next.sales[0].sales[0].shares,
                    expectedProceeds: next.sales[0].proceeds
                })
            return move('DeclareBankruptcy')
        }
        default:
            throw new Error(`The bot has no move in ${state.machineState}: ${valid.join()}`)
    }
}

/** Plays the table to its end, or to the action limit, returning the moves made. */
export function playOut(game: Table, seed: number, limit = 8000): number {
    const random = new Random(seed)
    let count = 0
    while (game.state.machineState !== 'GameOver' && count < limit) {
        if (!game.state.activePlayerIds.length)
            throw new Error(
                `No one acts in ${game.state.machineState} after move ${count}: ${JSON.stringify(
                    game.actions.slice(-4).map((action) => action.type)
                )}`
            )
        const next = botMove(game, random)
        try {
            game.act(next.type, next.fields, next.playerId)
        } catch (error) {
            throw new Error(
                `Move ${count} ${next.type} ${JSON.stringify(next.fields)} by ${next.playerId} in ${game.state.machineState} failed: ${String(error)}`,
                { cause: error }
            )
        }
        count++
    }
    return count
}
