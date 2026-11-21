import {
    EmergencyTrainFunding,
    SelectionAuctionModel,
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
    type Owner
} from '@tabletop/18xx'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { Autorouter } from '@tabletop/18xx-autorouter'
import { BridgeLeasePayers, bridgeLeaseOwed, bridgeLeasePayments } from '../src/bridgeLease.js'
import { SulphurSpringsId } from '../src/companies.js'
import { debtPrice } from '../src/debt.js'
import { extensionChoices } from '../src/extensions.js'
import { ghostTownSite, shippableGold } from '../src/gold.js'
import { AuctionRulesRoyalGorge } from '../src/opening.js'
import {
    TrainFundingRulesRoyalGorge,
    TrainRulesRoyalGorge,
    TransferRulesRoyalGorge
} from '../src/operating.js'
import {
    MetalPurchasePrivateIds,
    PrivatePowerRulesRoyalGorge,
    evaluateMetalPurchase,
    metalPurchaseChoices
} from '../src/privatePowers.js'
import { RouteRulesRoyalGorge } from '../src/routes.js'
import { StationRulesRoyalGorge } from '../src/stations.js'
import { steelChoices } from '../src/steel.js'
import { CompanyRulesRoyalGorge, StockRulesRoyalGorge } from '../src/stock.js'
import { TrackRulesRoyalGorge } from '../src/track.js'
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

/** A seeded player for whole-game tests, using every power the title adds now and then. */
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
    if (valid.includes('LayPrivateTile') && random.randInt(2) === 0) {
        const terms = PrivatePowerRulesRoyalGorge.trackTerms(state, SulphurSpringsId, playerId)
        if (terms) {
            const construction = privateTrackConstruction(state, terms, TrackRulesRoyalGorge)
            const choices = terms.locationIds.flatMap((id) => construction.choices(id))
            if (choices.length) {
                const choice = pick(choices)
                return move('LayPrivateTile', {
                    privateCompanyId: SulphurSpringsId,
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
        case 'SelectionAuction': {
            const model = new SelectionAuctionModel(state, AuctionRulesRoyalGorge)
            const bidding = model.auction.bidding
            if (bidding) {
                const amount = model.minimumBid(bidding.lotId)
                if (valid.includes('BidForLot') && random.randInt(3) === 0)
                    return move('BidForLot', { lotId: bidding.lotId, amount })
                return move('PassSelectionAuction')
            }
            const [lotId] = model.nominationLotIds
            if (lotId && valid.includes('NominateLot') && random.randInt(5) > 0) {
                const amount = model.minimumBid(lotId)
                if (amount <= cash) return move('NominateLot', { lotId, amount })
            }
            return move('PassSelectionAuction')
        }
        case 'StockRound': {
            const mustSell = !valid.includes('FinishStockTurn')
            if (valid.includes('SellShares') && (mustSell || random.randInt(12) === 0)) {
                for (const company of state.companies) {
                    const sales = [{ companyId: company.id, shares: 1 }]
                    const sale = evaluateShareSale(
                        state,
                        { playerId, seller: me, sales },
                        StockRulesRoyalGorge
                    )
                    if (sale.details)
                        return move('SellShares', {
                            seller: me,
                            sales,
                            expectedProceeds: sale.details.proceeds
                        })
                }
            }
            if (valid.includes('BuyMetalShares') && random.randInt(3) === 0)
                for (const privateId of MetalPurchasePrivateIds)
                    for (const choice of metalPurchaseChoices(state, playerId, privateId)) {
                        const result = evaluateMetalPurchase(
                            state,
                            playerId,
                            privateId,
                            choice.companyId,
                            1
                        )
                        if (result.purchases)
                            return move('BuyMetalShares', {
                                privateId,
                                companyId: choice.companyId,
                                shares: 1,
                                expectedPrice: result.purchases[0].price
                            })
                    }
            if (valid.includes('StartCompany') && random.randInt(2) === 0) {
                for (const company of state.companies) {
                    const spaces = CompanyRulesRoyalGorge.startMarketSpaces(state, company.id)
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
                        StockRulesRoyalGorge,
                        CompanyRulesRoyalGorge
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
                        StockRulesRoyalGorge
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
            if (valid.includes('ChooseSteel') && random.randInt(6) === 0) {
                const choices = Object.entries(
                    steelChoices(state, companyId, ['yellow', 'green', 'brown'])
                ).filter(([, columns]) => columns.length > 1)
                if (choices.length) {
                    const [color, columns] = pick(choices)
                    const column = pick(columns)
                    const turn =
                        state.steelTurn?.companyId === companyId ? state.steelTurn : undefined
                    if ((turn?.choices?.[color] ?? turn?.columns[color]) !== column)
                        return move('ChooseSteel', { companyId, color, column })
                }
            }
            if (valid.includes('LayTile') && random.randInt(5) > 0) {
                const construction = new TrackConstruction(state, TrackRulesRoyalGorge)
                const locations = TrackRulesRoyalGorge.map.definition.locations.filter(
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
            const stations = placeableStations(state, StationRulesRoyalGorge.map, companyId)
            if (valid.includes('PlaceStation') && stations.length) {
                const placement = new StationPlacement(state, StationRulesRoyalGorge)
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
            if (valid.includes('UseBridgeLease') && random.randInt(2) === 0)
                return move('UseBridgeLease', { companyId })
            if (valid.includes('ExtendTrain') && random.randInt(2) === 0) {
                const options = trainsOwnedBy(state, { kind: 'company', companyId }).flatMap(
                    (train) =>
                        extensionChoices(state, companyId, train.id).map((choice) => ({
                            trainId: train.id,
                            ...choice
                        }))
                )
                if (options.length) return move('ExtendTrain', { companyId, ...pick(options) })
            }
            const { result } = autorouter.solve(state, RouteRulesRoyalGorge, companyId, {
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
            const gold = shippableGold(state, companyId)
            if (valid.includes('ShipGold') && gold.length)
                return move('ShipGold', { companyId, locationId: pick(gold) })
            const ghost = ghostTownSite(state, companyId)
            if (valid.includes('PlaceGhostTown') && ghost)
                return move('PlaceGhostTown', { companyId, locationId: ghost })
            return move('DistributeEarnings', {
                companyId,
                choice: valid.length ? pick(['pay', 'pay', 'withhold']) : 'pay'
            })
        }
        case 'BuyingTrains': {
            const companyId = state.trainPurchaseStep?.companyId ?? ''
            const owned = trainsOwnedBy(state, { kind: 'company', companyId })
            if (valid.includes('PayBridgeLease')) {
                const payers = BridgeLeasePayers.filter((payer) =>
                    bridgeLeasePayments(state, companyId, payer)
                )
                return move('PayBridgeLease', {
                    companyId,
                    payer: pick(payers),
                    expectedAmount: bridgeLeaseOwed(state, companyId)
                })
            }
            if (valid.includes('PayDebt') && random.randInt(2) === 0)
                return move('PayDebt', { companyId, expectedPrice: debtPrice(state) })
            if (valid.includes('FundTrain') && !owned.length) {
                const funding = new EmergencyTrainFunding(
                    state,
                    TrainFundingRulesRoyalGorge,
                    StockRulesRoyalGorge,
                    TrainRulesRoyalGorge
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
            const privates = valid.includes('OfferPurchase')
                ? purchaseChoices(
                      state,
                      playerId,
                      TransferRulesRoyalGorge,
                      TrainRulesRoyalGorge
                  ).filter((choice) => choice.request.asset.kind === 'private')
                : []
            const treasury = finiteCashOwnedBy(state, { kind: 'company', companyId })
            if (privates.length && random.randInt(3) === 0) {
                const choice = pick(privates)
                if (treasury >= choice.minimum)
                    return move('OfferPurchase', { ...choice.request, price: choice.minimum })
            }
            const purchase = new TrainPurchase(state, TrainRulesRoyalGorge)
            const offers = purchase
                .offers()
                .flatMap((offer) => (offer.evaluation.details ? [offer.evaluation.details] : []))
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
                TrainFundingRulesRoyalGorge,
                StockRulesRoyalGorge,
                TrainRulesRoyalGorge
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
