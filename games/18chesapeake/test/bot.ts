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
    privateStationPositions,
    presidencyExchangeOptions,
    purchaseChoices,
    privateTrackConstruction,
    trainsOwnedBy,
    type Owner
} from '@tabletop/18xx'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { Autorouter } from '@tabletop/18xx-autorouter'
import { BsId, CocId, CpId } from '../src/companies.js'
import { AuctionRulesChesapeake } from '../src/opening.js'
import { TrainFundingRulesChesapeake, TransferRulesChesapeake } from '../src/operating.js'
import { PrivatePowerRulesChesapeake } from '../src/privatePowers.js'
import { RouteRulesChesapeake } from '../src/routes.js'
import { StationRulesChesapeake } from '../src/stations.js'
import { CompanyRulesChesapeake, StockRulesChesapeake } from '../src/stock.js'
import { TrackRulesChesapeake } from '../src/track.js'
import { TrainRulesChesapeake } from '../src/trains.js'
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
 * A private's tile lay, when one is open: the second of a pair always, otherwise now and then.
 */
function privateTileMove(
    game: Table,
    random: Random,
    playerId: string,
    valid: readonly string[]
): object | undefined {
    const state = game.hydrated
    if (!valid.includes('LayPrivateTile')) return undefined
    const pending = state.privateTrackLay?.required
        ? state.privateTrackLay.privateCompanyId
        : undefined
    for (const privateCompanyId of pending ? [pending] : [CpId, BsId, CocId]) {
        if (!pending && random.randInt(3) > 0) continue
        const terms = PrivatePowerRulesChesapeake.trackTerms(state, privateCompanyId, playerId)
        if (!terms) continue
        const construction = privateTrackConstruction(state, terms, TrackRulesChesapeake)
        const choices = terms.locationIds.flatMap((locationId) => construction.choices(locationId))
        if (!choices.length) continue
        const choice = choices[random.randInt(choices.length)]
        return {
            privateCompanyId,
            companyId: choice.companyId,
            locationId: choice.locationId,
            definitionId: choice.definitionId,
            rotation: choice.rotation,
            nodeMapping: choice.nodeMapping,
            expectedCost: choice.cost
        }
    }
    return undefined
}

/**
 * A simple seeded player for whole-game tests: it buys the privates, starts and trades
 * companies, builds, uses the privates' lays and station, places stations, runs the best routes
 * and buys trains.
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
                CompanyRulesChesapeake.startMarketSpaces(state, state.pendingPar.companyId)
            )
        })
    if (valid.includes('DiscardTrain')) {
        const companyId = state.phaseChange?.discardCompanyIds[0] ?? ''
        const [train] = trainsOwnedBy(state, { kind: 'company', companyId })
        return move('DiscardTrain', { companyId, trainId: train?.id })
    }
    if (valid.includes('ChooseHomeStation')) {
        const choice = pendingHomeChoice(state, StationRulesChesapeake)
        if (!choice) throw new Error('A home choice is offered')
        return move('ChooseHomeStation', { companyId: choice.companyId, ...pick(choice.positions) })
    }
    if (valid.includes('PlacePrivateStation') && state.privateStation) {
        const [position] = privateStationPositions(
            state,
            StationRulesChesapeake,
            state.privateStation
        )
        return position && random.randInt(4) > 0
            ? move('PlacePrivateStation', {
                  privateCompanyId: state.privateStation.privateCompanyId,
                  position
              })
            : move('DeclinePrivateStation', {
                  privateCompanyId: state.privateStation.privateCompanyId
              })
    }
    const privateLay = privateTileMove(game, random, playerId, valid)
    if (privateLay) return move('LayPrivateTile', privateLay)

    switch (state.machineState) {
        case 'WaterfallAuction':
        case 'AuctionBidding': {
            const auction = new ReserveBidAuction(state, AuctionRulesChesapeake)
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
                        StockRulesChesapeake
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
                    const spaces = CompanyRulesChesapeake.startMarketSpaces(state, company.id)
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
                        StockRulesChesapeake,
                        CompanyRulesChesapeake
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
                        StockRulesChesapeake
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
                const construction = new TrackConstruction(state, TrackRulesChesapeake)
                const locations = TrackRulesChesapeake.map.definition.locations.filter(
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
            const stations = placeableStations(state, StationRulesChesapeake.map, companyId)
            if (valid.includes('PlaceStation') && stations.length) {
                const placement = new StationPlacement(state, StationRulesChesapeake)
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
            const { result } = autorouter.solve(state, RouteRulesChesapeake, companyId, {
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
                    TrainFundingRulesChesapeake,
                    StockRulesChesapeake,
                    TrainRulesChesapeake
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
                      TransferRulesChesapeake,
                      TrainRulesChesapeake
                  ).filter((choice) => choice.request.asset.kind === 'private')
                : []
            const treasury = finiteCashOwnedBy(state, { kind: 'company', companyId })
            if (privates.length && random.randInt(3) === 0) {
                const choice = pick(privates)
                if (treasury >= choice.minimum)
                    return move('OfferPurchase', { ...choice.request, price: choice.minimum })
            }
            const purchase = new TrainPurchase(state, TrainRulesChesapeake)
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
                TrainFundingRulesChesapeake,
                StockRulesChesapeake,
                TrainRulesChesapeake
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
