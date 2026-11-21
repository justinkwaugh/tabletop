import {
    EmergencyTrainFunding,
    StationPlacement,
    TrackConstruction,
    TrainPurchase,
    crisisSales,
    currentDebt,
    evaluateCompanyStart,
    evaluateSharePurchase,
    evaluateShareSale,
    finiteCashOwnedBy,
    pendingHomeChoice,
    placeableStations,
    presidencyExchangeOptions,
    privateTrackConstruction,
    purchasableAccessRights,
    purchaseChoices,
    trainsOwnedBy,
    type Owner
} from '@tabletop/18xx'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { Autorouter } from '@tabletop/18xx-autorouter'
import { CanadaCompanyId, CgrId, ShippingId, WaterlooId } from '../src/companies.js'
import { canRepayNationalLoans, nationalDecision } from '../src/national.js'
import { owedMarketShare, presidencyShareOffers } from '../src/nationalOperation.js'
import { isPermanentTrain } from '../src/trains.js'
import { AuctionRules1856 } from '../src/opening.js'
import {
    CashCrisisRules1856,
    EarningsRules1856,
    TrainFundingRules1856,
    TrainRules1856,
    TransferRules1856
} from '../src/operating.js'
import { PrivatePowerRules1856 } from '../src/privatePowers.js'
import { AccessRightRules1856 } from '../src/rights.js'
import { RouteRules1856 } from '../src/routes.js'
import { StationRules1856 } from '../src/stations.js'
import { CompanyRules1856, StockRules1856 } from '../src/stock.js'
import { TrackRules1856 } from '../src/track.js'
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

/** A private's tile lay, now and then, when one is open. */
function privateTileMove(
    game: Table,
    random: Random,
    playerId: string,
    valid: readonly string[]
): object | undefined {
    const state = game.hydrated
    if (!valid.includes('LayPrivateTile')) return undefined
    for (const privateCompanyId of [WaterlooId, CanadaCompanyId]) {
        if (random.randInt(3) > 0) continue
        const terms = PrivatePowerRules1856.trackTerms(state, privateCompanyId, playerId)
        if (!terms) continue
        const construction = privateTrackConstruction(state, terms, TrackRules1856)
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
 * companies, builds, uses the privates' powers, places stations, runs the best routes, borrows,
 * repays and buys trains.
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
    if (valid.includes('DiscardTrain')) {
        const companyId = state.phaseChange?.discardCompanyIds[0] ?? ''
        const [train] = trainsOwnedBy(state, { kind: 'company', companyId })
        return move('DiscardTrain', { companyId, trainId: train?.id })
    }
    if (valid.includes('ChooseHomeStation')) {
        const choice = pendingHomeChoice(state, StationRules1856)
        if (!choice) throw new Error('A home choice is offered')
        return move('ChooseHomeStation', { companyId: choice.companyId, ...pick(choice.positions) })
    }
    if (valid.includes('PlacePrivateToken') && random.randInt(3) === 0) {
        const terms = PrivatePowerRules1856.tokenTerms?.(state, WaterlooId, playerId)
        if (terms?.positions.length)
            return move('PlacePrivateToken', {
                privateCompanyId: WaterlooId,
                position: pick(terms.positions)
            })
    }
    if (valid.includes('PlacePrivateMarker') && random.randInt(3) === 0) {
        const terms = PrivatePowerRules1856.markerTerms?.(state, ShippingId, playerId)
        if (terms?.stops?.length)
            return move('PlacePrivateMarker', {
                privateCompanyId: ShippingId,
                ...pick(terms.stops)
            })
    }
    if (valid.includes('BuyAccessRight') && random.randInt(3) === 0) {
        const rights = purchasableAccessRights(state, AccessRightRules1856, playerId)
        const companyId = rights[0]?.companyId
        const right = rights.length ? pick(rights) : undefined
        if (
            right &&
            companyId &&
            finiteCashOwnedBy(state, { kind: 'company', companyId }) >= right.price
        )
            return move('BuyAccessRight', {
                companyId: right.companyId,
                rightId: right.rightId,
                expectedPrice: right.price
            })
    }
    if (valid.includes('TakeLoan') && random.randInt(6) === 0) {
        const companyId =
            state.trackStep?.companyId ??
            state.stationStep?.companyId ??
            state.routeStep?.companyId ??
            state.trainPurchaseStep?.companyId
        if (companyId) return move('TakeLoan', { companyId })
    }
    const privateLay = privateTileMove(game, random, playerId, valid)
    if (privateLay) return move('LayPrivateTile', privateLay)

    switch (state.machineState) {
        case 'WaterfallAuction':
        case 'AuctionBidding': {
            const auction = new ReserveBidAuction(state, AuctionRules1856)
            const lotId = state.openingAuction?.remainingLotIds[0]
            if (valid.includes('BuyAuctionLot') && lotId) {
                const price = auction.price(lotId)
                if (price <= cash && random.randInt(4) > 0)
                    return move('BuyAuctionLot', { lotId, expectedPrice: price })
            }
            return move('PassAuction')
        }
        case 'StockRound': {
            if (valid.includes('CompleteNationalPresidency')) {
                const offers = presidencyShareOffers(state)
                const affordable = offers.filter((offer) => offer.price <= cash)
                const offer = pick(affordable.length ? affordable : offers)
                if (offer && (affordable.length || !valid.includes('SellShares')))
                    return move('CompleteNationalPresidency', {
                        poolId: offer.poolId,
                        expectedPrice: offer.price
                    })
            }
            if (valid.includes('BuyNationalMarketShare')) {
                const owed = owedMarketShare(state, playerId)
                if (owed && (owed.price <= cash || random.randInt(2) === 0))
                    return move('BuyNationalMarketShare', { expectedPrice: owed.price })
            }
            const mustSell = !valid.includes('FinishStockTurn')
            if (valid.includes('SellShares') && (mustSell || random.randInt(12) === 0)) {
                for (const company of state.companies) {
                    const sales = [{ companyId: company.id, shares: 1 }]
                    const sale = evaluateShareSale(
                        state,
                        { playerId, seller: me, sales },
                        StockRules1856
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
                    const spaces = CompanyRules1856.startMarketSpaces(state, company.id)
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
                        StockRules1856,
                        CompanyRules1856
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
            if (
                valid.includes('BuyShares') &&
                !owedMarketShare(state, playerId) &&
                random.randInt(4) > 0
            ) {
                const offers = state.certificates.flatMap((certificate) => {
                    const result = evaluateSharePurchase(
                        state,
                        { playerId, buyer: me, certificateId: certificate.id },
                        StockRules1856
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
            const owed = owedMarketShare(state, playerId)
            if (owed) return move('BuyNationalMarketShare', { expectedPrice: owed.price })
            return move('FinishStockTurn')
        }
        case 'LayingTrack': {
            const companyId = state.trackStep?.companyId ?? ''
            if (valid.includes('LayTile')) {
                const construction = new TrackConstruction(state, TrackRules1856)
                const locations = TrackRules1856.map.definition.locations.filter(
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
            const stations = placeableStations(state, StationRules1856.map, companyId)
            if (valid.includes('PlaceStation') && stations.length) {
                const placement = new StationPlacement(state, StationRules1856)
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
            const { result } = autorouter.solve(state, RouteRules1856, companyId, {
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
                choice: pick(
                    EarningsRules1856.choices(state, companyId).flatMap((choice) =>
                        choice === 'pay' ? [choice, choice] : [choice]
                    )
                )
            })
        }
        case 'BuyingTrains': {
            const companyId = state.trainPurchaseStep?.companyId ?? ''
            const owned = trainsOwnedBy(state, { kind: 'company', companyId })
            if (valid.includes('FundTrain') && !owned.length) {
                const funding = new EmergencyTrainFunding(
                    state,
                    TrainFundingRules1856,
                    StockRules1856,
                    TrainRules1856
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
                ? purchaseChoices(state, playerId, TransferRules1856, TrainRules1856).filter(
                      (choice) => choice.request.asset.kind === 'private'
                  )
                : []
            const treasury = finiteCashOwnedBy(state, { kind: 'company', companyId })
            if (privates.length && random.randInt(3) === 0) {
                const choice = pick(privates)
                if (treasury >= choice.minimum)
                    return move('OfferPurchase', { ...choice.request, price: choice.minimum })
            }
            const purchase = new TrainPurchase(state, TrainRules1856)
            const offers = [
                ...purchase.offers().map((offer) => offer.evaluation),
                ...purchase.marketOffers()
            ].flatMap((evaluation) => (evaluation.details ? [evaluation.details] : []))
            if (
                offers.length &&
                valid.includes('BuyTrain') &&
                (!owned.length || !valid.includes('FinishTrains') || random.randInt(3) === 0)
            ) {
                const offer = pick(offers)
                return move('BuyTrain', {
                    companyId,
                    trainId: offer.trainId,
                    definitionId: offer.definitionId,
                    expectedPrice: offer.price
                })
            }
            return move(
                valid.includes('FinishTrains')
                    ? 'FinishTrains'
                    : valid.includes('FinishOperatingTurn')
                      ? 'FinishOperatingTurn'
                      : 'FinishTrains',
                { companyId }
            )
        }
        case 'FormingNational': {
            const formation = state.nationalFormation
            if (!formation) throw new Error('Forming without a formation')
            if (valid.includes('SettleNationalLoans')) {
                const decision = nationalDecision(state)
                if (!decision) throw new Error('No national decision')
                const companyId = pick(decision.companyIds)
                return move('SettleNationalLoans', {
                    companyId,
                    repay: canRepayNationalLoans(state, companyId) && random.randInt(2) === 0
                })
            }
            if (valid.includes('ChooseNationalStations') && formation.stationChoice) {
                const seen = new Set<string>()
                const stationIds: string[] = []
                for (const station of formation.stationChoice.stations) {
                    if (seen.has(station.position.locationId)) continue
                    if (stationIds.length >= formation.stationChoice.keep) break
                    seen.add(station.position.locationId)
                    stationIds.push(station.stationId)
                }
                return move('ChooseNationalStations', { stationIds })
            }
            const trains = trainsOwnedBy(state, { kind: 'company', companyId: CgrId })
            const permanent = trains.filter((train) => isPermanentTrain(train.definitionId))
            const others = trains.filter((train) => !isPermanentTrain(train.definitionId))
            const kept = [...permanent, ...others.filter(() => random.randInt(2) === 0)].slice(0, 3)
            return move('ChooseNationalTrains', { trainIds: kept.map((train) => train.id) })
        }
        case 'RepayingLoans': {
            const companyId = state.loanStep?.companyId ?? ''
            if (valid.includes('RepayLoan') && random.randInt(3) > 0)
                return move('RepayLoan', { companyId })
            return move('FinishOperatingTurn', { companyId })
        }
        case 'RaisingCash': {
            const debt = currentDebt(state)
            if (!debt) throw new Error('Raising cash without a debt')
            const [sale] = crisisSales(state, CashCrisisRules1856, debt.playerId)
            if (sale)
                return move('SellSharesToPay', { sale: sale.sale, expectedProceeds: sale.proceeds })
            return move('GoBankrupt')
        }
        case 'FundingTrain': {
            const funding = new EmergencyTrainFunding(
                state,
                TrainFundingRules1856,
                StockRules1856,
                TrainRules1856
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
                `Move ${count} ${next.type} ${JSON.stringify(next.fields)} by ${next.playerId} in ${game.state.machineState} failed (valid ${game.valid(next.playerId).join()}): ${String(error)}`,
                { cause: error }
            )
        }
        count++
    }
    return count
}
