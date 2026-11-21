import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import {
    StationPlacement,
    TrackConstruction,
    evaluatePrivateExchange,
    evaluateSharePurchase,
    evaluateShareSale,
    finiteCashOwnedBy,
    trainsOverLimit,
    trainRoutesOf,
    trainsOwnedBy,
    type Owner
} from '@tabletop/18xx'
import { Autorouter } from '@tabletop/18xx-autorouter'
import { auctionDecision, canBid, lotChoices, minimumBid } from '../src/auction.js'
import { buyablePrivates, sellablePrivates } from '../src/bankPrivates.js'
import { PrivateIds1860 } from '../src/companies.js'
import { homeTileChoices } from '../src/homeTile.js'
import { StationRules1860 } from '../src/stations.js'
import { RouteRules1860 } from '../src/routes.js'
import { CompanyRules1860, PrivateRules1860, StockRules1860, startPrices } from '../src/stock.js'
import { marketSpaceIdAt } from '../src/stockMarket.js'
import { TrackRules1860 } from '../src/track.js'
import { TrainRules1860, bankTrainOffers } from '../src/operating.js'
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
 * A simple seeded player for whole-game tests: it bids for and chooses certificates, starts and
 * buys companies, builds, runs good routes, pays out or withholds and buys trains, answering
 * every decision, so long games reach the title's endings.
 */
export function botMove(game: Table, random: Random): Move {
    const state = game.hydrated
    const playerId = game.player
    if (!playerId)
        throw new Error(
            `No one acts in ${state.machineState}: ${JSON.stringify(game.actions.slice(-6).map((action) => action.type))}`
        )
    const valid = game.valid(playerId)
    const pick = <T>(items: readonly T[]): T => items[random.randInt(items.length)]
    const me: Owner = { kind: 'player', playerId }
    const cash = finiteCashOwnedBy(state, me)
    const move = (type: string, fields: object = {}): Move => ({ type, fields, playerId })

    switch (state.machineState) {
        case 'ChoiceAuction': {
            const decision = auctionDecision(state)
            if (decision?.kind === 'choose') {
                const choice = pick(lotChoices(state, playerId))
                return move('ChooseCertificate', {
                    lotId: choice.lotId,
                    ...(choice.parPrices.length ? { parPrice: choice.parPrices.at(-1) } : {})
                })
            }
            const auction = state.choiceAuction
            const bid = auction ? minimumBid(auction) : 0
            return random.randInt(3) === 0 && canBid(state, playerId, bid)
                ? move('BidForChoice', { amount: bid })
                : move('PassForChoice')
        }
        case 'LayingHomeTile': {
            const choice = pick(homeTileChoices(state))
            return move('LayHomeTile', {
                companyId: choice.companyId,
                locationId: choice.locationId,
                definitionId: choice.definitionId,
                rotation: choice.rotation,
                nodeMapping: choice.nodeMapping
            })
        }
        case 'StockRound': {
            if (valid.includes('ExchangePrivate'))
                for (const privateCompanyId of PrivateIds1860) {
                    const terms = PrivateRules1860.exchangeTerms(state, privateCompanyId)
                    const certificateId = terms?.certificateIds[0]
                    if (!certificateId) continue
                    const result = evaluatePrivateExchange(
                        state,
                        { playerId, privateCompanyId, certificateId },
                        PrivateRules1860,
                        StockRules1860
                    )
                    if (result.details && random.randInt(2) === 0)
                        return move('ExchangePrivate', { privateCompanyId, certificateId })
                }
            const mustSell = !valid.includes('FinishStockTurn')
            if (valid.includes('SellShares') && (mustSell || random.randInt(12) === 0)) {
                const companyIds = [
                    ...new Set(
                        state.certificates
                            .filter(
                                (certificate) =>
                                    certificate.kind === 'share' &&
                                    certificate.owner.kind === 'player' &&
                                    certificate.owner.playerId === playerId
                            )
                            .map((certificate) => certificate.companyId)
                    )
                ]
                for (const companyId of companyIds) {
                    const sales = [{ companyId, shares: 1 }]
                    const sale = evaluateShareSale(
                        state,
                        { playerId, seller: me, sales },
                        StockRules1860
                    )
                    if (sale.details)
                        return move('SellShares', {
                            seller: me,
                            sales,
                            expectedProceeds: sale.details.proceeds
                        })
                }
            }
            const sellable = sellablePrivates(state, playerId)
            if (sellable.length && random.randInt(20) === 0)
                return move('SellPrivateToBank', { privateCompanyId: pick(sellable) })
            const buyable = buyablePrivates(state, playerId)
            if (buyable.length && random.randInt(3) === 0)
                return move('BuyPrivateFromBank', { privateCompanyId: pick(buyable) })
            if (valid.includes('StartCompany') && random.randInt(3) === 0) {
                const companyId = state.companies.find(
                    (company) => CompanyRules1860.startMarketSpaces(state, company.id).length
                )?.id
                const price =
                    companyId &&
                    startPrices(state, companyId)
                        .filter((value) => value * 6 <= cash)
                        .at(-1)
                if (companyId && price)
                    return move('StartCompany', {
                        buyer: me,
                        companyId,
                        marketSpaceId: marketSpaceIdAt(price),
                        expectedPrice: price * 2
                    })
            }
            if (valid.includes('BuyShares')) {
                const offers = state.certificates.flatMap((certificate) => {
                    const result = evaluateSharePurchase(
                        state,
                        { playerId, buyer: me, certificateId: certificate.id },
                        StockRules1860
                    )
                    return result.details
                        ? [{ certificateId: certificate.id, price: result.details.price }]
                        : []
                })
                if (offers.length && random.randInt(4) > 0) {
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
                const construction = new TrackConstruction(state, TrackRules1860)
                const locations = TrackRules1860.map.definition.locations.filter(
                    (location) => location.buildable
                )
                for (let tries = 0; tries < 10; tries++) {
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
            if (valid.includes('PlaceStation') && station && random.randInt(2) === 0) {
                const choices = new StationPlacement(state, StationRules1860).choices(station.id)
                if (choices.length) {
                    const { cost, ...request } = pick(choices)
                    return move('PlaceStation', { ...request, expectedCost: cost })
                }
            }
            return move('FinishStations', { companyId })
        }
        case 'RunningTrains': {
            const companyId = state.routeStep?.companyId ?? ''
            const { result } = autorouter.solve(state, RouteRules1860, companyId, {
                timeLimitMs: 150
            })
            return move('RunTrains', { companyId, routes: trainRoutesOf(result) })
        }
        case 'DistributingEarnings': {
            const companyId = state.routeStep?.companyId ?? ''
            const choice = valid.length ? pick(['pay', 'pay', 'pay', 'withhold']) : 'pay'
            return move('DistributeEarnings', { companyId, choice })
        }
        case 'ReturningTrains': {
            const companyId = state.operatingSet
                ? (game.hydrated.operatingSet?.companyOrder.find(
                      (id) => trainsOverLimit(state, TrainRules1860, id).length
                  ) ?? '')
                : ''
            const [train] = trainsOverLimit(state, TrainRules1860, companyId)
            return move('ReturnTrain', { companyId, trainId: train?.id ?? '' })
        }
        case 'DiscardingTrains': {
            const companyId = state.phaseChange?.discardCompanyIds[0] ?? ''
            const [train] = trainsOverLimit(state, TrainRules1860, companyId)
            return move('DiscardTrain', { companyId, trainId: train?.id ?? '' })
        }
        case 'BuyingTrains': {
            const companyId = state.trainPurchaseStep?.companyId ?? ''
            const owned = trainsOwnedBy(state, { kind: 'company', companyId })
            const offers = bankTrainOffers(state, TrainRules1860)
            if (
                offers.length &&
                valid.includes('BuyTrain') &&
                (owned.length === 0 || random.randInt(3) === 0)
            ) {
                const offer = offers[0]
                return move('BuyTrain', {
                    companyId,
                    trainId: offer.trainId,
                    definitionId: offer.definitionId,
                    expectedPrice: offer.price
                })
            }
            return move('FinishOperatingTurn', { companyId })
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
                `No one acts in ${game.state.machineState} after move ${count}: ${JSON.stringify({
                    set: game.state.operatingSet,
                    last: game.actions.slice(-4).map((action) => action.type)
                })}`
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
