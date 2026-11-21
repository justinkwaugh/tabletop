import {
    EmergencyTrainFunding,
    StationPlacement,
    TrackConstruction,
    TrainPurchase,
    evaluateCompanyStart,
    evaluateSharePurchase,
    evaluateShareSale,
    finiteCashOwnedBy,
    pendingHomeChoice,
    placeableStations,
    presidencyExchangeOptions,
    purchaseChoices,
    privateTrackConstruction,
    trainsOwnedBy,
    type Owner
} from '@tabletop/18xx'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { Autorouter } from '@tabletop/18xx-autorouter'
import { centralHomePositions, centralParSpaces } from '../src/central.js'
import { NwrId } from '../src/companies.js'
import { movableStations, rebellionDestinations, rebellionMover } from '../src/nwr.js'
import { AuctionRules1882 } from '../src/opening.js'
import { TrainFundingRules1882, TransferRules1882 } from '../src/operating.js'
import { PrivatePowerRules1882 } from '../src/privatePowers.js'
import { RouteRules1882 } from '../src/routes.js'
import { StationRules1882 } from '../src/stations.js'
import { CompanyRules1882, StockRules1882 } from '../src/stock.js'
import { TrackRules1882 } from '../src/track.js'
import { TrainRules1882 } from '../src/trains.js'
import { ReserveBidAuction } from '@tabletop/18xx'
import type { Table } from './kit.js'

const autorouter = await Autorouter.create(
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

/**
 * A simple seeded player for whole-game tests: it buys the privates, converts the Saskatchewan
 * Central, starts and trades companies, builds, places stations and neutral stations, moves a
 * station with the North-West Rebellion Company, runs the best routes and buys trains.
 */
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
    if (valid.includes('ParCompany') && state.pendingPar)
        return move('ParCompany', {
            companyId: state.pendingPar.companyId,
            marketSpaceId: pick(
                CompanyRules1882.startMarketSpaces(state, state.pendingPar.companyId)
            )
        })
    if (valid.includes('DiscardTrain')) {
        const companyId = state.phaseChange?.discardCompanyIds[0] ?? ''
        const [train] = trainsOwnedBy(state, { kind: 'company', companyId })
        return move('DiscardTrain', { companyId, trainId: train?.id })
    }
    if (valid.includes('ChooseHomeStation')) {
        const choice = pendingHomeChoice(state, StationRules1882)
        if (!choice) throw new Error('A home choice is offered')
        return move('ChooseHomeStation', { companyId: choice.companyId, ...pick(choice.positions) })
    }
    if (state.privateTrackLay?.privateCompanyId === NwrId && valid.includes('LayPrivateTile')) {
        const terms = PrivatePowerRules1882.trackTerms(state, NwrId, playerId)
        const choices = terms
            ? privateTrackConstruction(state, terms, TrackRules1882).choices(terms.locationIds[0])
            : []
        if (choices.length && random.randInt(4) > 0) {
            const choice = pick(choices)
            return move('LayPrivateTile', {
                privateCompanyId: NwrId,
                companyId: choice.companyId,
                locationId: choice.locationId,
                definitionId: choice.definitionId,
                rotation: choice.rotation,
                nodeMapping: choice.nodeMapping,
                expectedCost: choice.cost
            })
        }
        return move('DeclinePrivateTile', { privateCompanyId: NwrId })
    }
    if (valid.includes('MoveRebellionStation') && random.randInt(3) === 0) {
        const companyId = rebellionMover(state, playerId) ?? ''
        return move('MoveRebellionStation', {
            stationId: pick(movableStations(state, companyId)).id,
            position: pick(rebellionDestinations(state, companyId))
        })
    }

    switch (state.machineState) {
        case 'WaterfallAuction':
        case 'AuctionBidding': {
            const auction = new ReserveBidAuction(state, AuctionRules1882)
            const lotId = state.openingAuction?.remainingLotIds[0]
            if (valid.includes('BuyAuctionLot') && lotId) {
                const price = auction.price(lotId)
                if (price <= cash && random.randInt(4) > 0)
                    return move('BuyAuctionLot', { lotId, expectedPrice: price })
            }
            return move('PassAuction')
        }
        case 'StockRound': {
            const mustSell = !valid.includes('FinishStockTurn')
            if (valid.includes('SellShares') && (mustSell || random.randInt(12) === 0)) {
                for (const company of state.companies) {
                    const sales = [{ companyId: company.id, shares: 1 }]
                    const sale = evaluateShareSale(
                        state,
                        { playerId, seller: me, sales },
                        StockRules1882
                    )
                    if (sale.details)
                        return move('SellShares', {
                            seller: me,
                            sales,
                            expectedProceeds: sale.details.proceeds
                        })
                }
            }
            if (valid.includes('ConvertCentral') && random.randInt(2) === 0) {
                const spaces = centralParSpaces(state)
                const homes = centralHomePositions(state)
                return move('ConvertCentral', {
                    marketSpaceId: spaces.at(-1),
                    home: pick(homes)
                })
            }
            if (valid.includes('StartCompany') && random.randInt(2) === 0) {
                for (const company of state.companies) {
                    const spaces = CompanyRules1882.startMarketSpaces(state, company.id)
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
                        StockRules1882,
                        CompanyRules1882
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
                        StockRules1882
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
                const construction = new TrackConstruction(state, TrackRules1882)
                const locations = TrackRules1882.map.definition.locations.filter(
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
            const stations = placeableStations(state, StationRules1882.map, companyId)
            if (valid.includes('PlaceStation') && stations.length) {
                const placement = new StationPlacement(state, StationRules1882)
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
            const { result } = autorouter.solve(state, RouteRules1882, companyId, {
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
        case 'BuyingTrains': {
            const companyId = state.trainPurchaseStep?.companyId ?? ''
            const owned = trainsOwnedBy(state, { kind: 'company', companyId })
            if (valid.includes('FundTrain') && !owned.length) {
                const funding = new EmergencyTrainFunding(
                    state,
                    TrainFundingRules1882,
                    StockRules1882,
                    TrainRules1882
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
                ? purchaseChoices(state, playerId, TransferRules1882, TrainRules1882).filter(
                      (choice) => choice.request.asset.kind === 'private'
                  )
                : []
            const treasury = finiteCashOwnedBy(state, { kind: 'company', companyId })
            if (privates.length && random.randInt(3) === 0) {
                const choice = pick(privates)
                if (treasury >= choice.minimum)
                    return move('OfferPurchase', { ...choice.request, price: choice.minimum })
            }
            const purchase = new TrainPurchase(state, TrainRules1882)
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
                TrainFundingRules1882,
                StockRules1882,
                TrainRules1882
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
export function playOut(game: Table, seed: number, limit = 6000): number {
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
