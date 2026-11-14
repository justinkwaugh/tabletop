import {
    EmergencyTrainFunding,
    StationPlacement,
    TrackConstruction,
    TrainPurchase,
    corporateFinanceChoices,
    evaluateBids,
    evaluateCompanyStart,
    evaluateSharePurchase,
    evaluateShareSale,
    lowestBid,
    privateTrackConstruction,
    trainsCountingForLimit,
    trainsOwnedBy,
    type Owner
} from '@tabletop/18xx'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { Autorouter } from '@tabletop/18xx-autorouter'
import { minorAcquisitions1822 } from '../src/acquisition.js'
import { firstTrainOffer1822 } from '../src/housekeeping.js'
import { repayableLoan1822 } from '../src/loans.js'
import {
    CorporateFinanceRules1822,
    TrainFundingRules1822,
    TrainRules1822
} from '../src/operating.js'
import { acquirablePrivates1822, acquisitionChoices1822 } from '../src/privateAcquisition.js'
import {
    PrivatePowerRules1822,
    movableStackCards1822,
    stationSwaps1822,
    usableDiscountTokens1822
} from '../src/privatePowers.js'
import { RouteRules1822 } from '../src/routes.js'
import { StationRules1822 } from '../src/stations.js'
import { BidBoxRules1822, CompanyRules1822, StockRules1822 } from '../src/stock.js'
import { TrackRules1822 } from '../src/track.js'
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
 * A simple seeded player for whole-game tests: it bids, converts concessions, trades shares,
 * builds, runs the best routes, buys trains and answers every decision.
 */
export function botMove(game: Table, random: Random): Move {
    const state = game.hydrated
    const playerId = game.player
    if (!playerId) throw new Error(`No one acts in ${state.machineState}`)
    const valid = game.valid(playerId)
    const pick = <T>(items: readonly T[]): T => items[random.randInt(items.length)]
    const me: Owner = { kind: 'player', playerId }
    const move = (type: string, fields: object = {}): Move => ({ type, fields, playerId })

    if (valid.includes('DiscardTrain')) {
        const companyId = state.phaseChange?.discardCompanyIds[0] ?? ''
        const train = trainsOwnedBy(state, { kind: 'company', companyId }).find((entry) =>
            TrainRules1822.countsForLimit?.(state, entry)
        )
        return move('DiscardTrain', { companyId, trainId: train?.id })
    }

    if (valid.includes('DeclareCash'))
        return move('DeclareCash', { doubled: random.randInt(2) === 0 })
    if (valid.includes('AnswerAcquisition'))
        return move('AnswerAcquisition', { accept: random.randInt(3) > 0 })
    if (valid.includes('AnswerPrivateOffer'))
        return move('AnswerPrivateOffer', { accept: random.randInt(3) > 0 })
    if (valid.includes('RespondToTrackConsent') && state.trackConsent)
        return move('RespondToTrackConsent', {
            requestId: state.trackConsent.id,
            accept: random.randInt(3) > 0
        })

    switch (state.machineState) {
        case 'StockRound': {
            const mustSell = !valid.includes('FinishStockTurn')
            if (valid.includes('RepayPlayerLoan') && random.randInt(2) === 0)
                return move('RepayPlayerLoan', {
                    amount: 1 + random.randInt(repayableLoan1822(state, playerId))
                })
            if (valid.includes('SellShares') && (mustSell || random.randInt(15) === 0)) {
                for (const company of state.companies) {
                    const sales = [{ companyId: company.id, shares: 1 }]
                    const sale = evaluateShareSale(
                        state,
                        { playerId, seller: me, sales },
                        StockRules1822
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
                    const spaces = CompanyRules1822.startMarketSpaces(state, company.id)
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
                        StockRules1822,
                        CompanyRules1822
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
            if (valid.includes('PlaceBids') && random.randInt(4) > 0) {
                const bids: { lotId: string; amount: number }[] = []
                const lots = [...state.bidBoxes.boxes].sort(() => random.randInt(3) - 1)
                for (const { lotId } of lots) {
                    if (bids.length >= 1 + random.randInt(BidBoxRules1822.bidsPerTurn)) break
                    const amount =
                        lowestBid(state, BidBoxRules1822, lotId) +
                        BidBoxRules1822.increment * random.randInt(4)
                    const next = [...bids, { lotId, amount }]
                    if (evaluateBids(state, BidBoxRules1822, playerId, next).bids)
                        bids.push(next[next.length - 1])
                }
                if (bids.length) return move('PlaceBids', { bids })
            }
            if (valid.includes('BuyShares') && random.randInt(3) > 0) {
                // The player buys for themselves, or for the tax haven they own (Table 3, P16).
                const offers = StockRules1822.buyers(state, playerId).flatMap((buyer) =>
                    state.certificates.flatMap((certificate) => {
                        const result = evaluateSharePurchase(
                            state,
                            { playerId, buyer, certificateId: certificate.id },
                            StockRules1822
                        )
                        return result.details
                            ? [
                                  {
                                      buyer,
                                      certificateId: certificate.id,
                                      price: result.details.price
                                  }
                              ]
                            : []
                    })
                )
                if (offers.length) {
                    const offer = pick(offers)
                    return move('BuyShares', {
                        buyer: offer.buyer,
                        certificateId: offer.certificateId,
                        expectedPrice: offer.price
                    })
                }
            }
            return move('FinishStockTurn')
        }
        case 'LayingTrack': {
            const companyId = state.trackStep?.companyId ?? ''
            if (valid.includes('PlaceMetropolitanHome'))
                return move('PlaceMetropolitanHome', {
                    companyId,
                    nodeId: pick(['s', 'sw', 'nw', 'n', 'ne', 'se'])
                })
            const firstTrain = firstTrainOffer1822(state, playerId)
            if (valid.includes('BuyLocalTrain') && firstTrain && random.randInt(4) > 0)
                return move('BuyLocalTrain', {
                    companyId,
                    trainId: firstTrain.trainId,
                    expectedPrice: firstTrain.price
                })
            if (valid.includes('AcquirePrivate') && random.randInt(2) === 0) {
                const entry = pick(acquirablePrivates1822(state, playerId))
                const choices = acquisitionChoices1822(state, companyId, entry.id)
                const counting = trainsCountingForLimit(state, TrainRules1822, companyId)
                const full = counting.length >= TrainRules1822.trainLimit(state, companyId)
                return move('AcquirePrivate', {
                    companyId,
                    privateCompanyId: entry.id,
                    ...(choices.length ? { choice: pick(choices) } : {}),
                    ...(entry.id === 'P1' && full ? { discardTrainId: counting[0].id } : {})
                })
            }
            if (valid.includes('UseDiscountToken') && random.randInt(2) === 0)
                return move('UseDiscountToken', {
                    companyId,
                    kind: pick(usableDiscountTokens1822(state, playerId))
                })
            if (valid.includes('MoveStackCard') && random.randInt(3) === 0)
                return move('MoveStackCard', {
                    companyId,
                    lotId: pick(movableStackCards1822(state, playerId)),
                    to: pick(['top', 'bottom'])
                })
            if (valid.includes('SwapStationToken') && random.randInt(3) === 0)
                return move('SwapStationToken', {
                    companyId,
                    direction: pick(stationSwaps1822(state, playerId))
                })
            if (valid.includes('LayPrivateTile') && random.randInt(2) === 0) {
                for (const entry of state.companies.filter(
                    (company) => company.kind === 'private'
                )) {
                    const terms = PrivatePowerRules1822.trackTerms(state, entry.id, playerId)
                    if (!terms) continue
                    const construction = privateTrackConstruction(state, terms, TrackRules1822)
                    for (let tries = 0; tries < 24; tries++) {
                        const locationId = pick(terms.locationIds)
                        if (!locationId) break
                        const choices = construction.choices(locationId)
                        if (!choices.length) continue
                        const choice = pick(choices)
                        return move('LayPrivateTile', {
                            privateCompanyId: entry.id,
                            companyId,
                            locationId,
                            definitionId: choice.definitionId,
                            rotation: choice.rotation,
                            nodeMapping: choice.nodeMapping,
                            expectedCost: choice.cost
                        })
                    }
                }
            }
            if (valid.includes('LayTile')) {
                const construction = new TrackConstruction(state, TrackRules1822)
                const locations = TrackRules1822.map.definition.locations.filter(
                    (location) => location.buildable !== false
                )
                for (let tries = 0; tries < 24; tries++) {
                    const location = pick(locations)
                    const choices = construction.choices(location.id)
                    if (!choices.length) continue
                    const choice = pick(choices)
                    const asks = choice.consentPlayerId && choice.consentPlayerId !== playerId
                    return move(asks ? 'RequestTrackConsent' : 'LayTile', {
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
                const choices = new StationPlacement(state, StationRules1822).choices(station.id)
                if (choices.length) {
                    const { cost, ...request } = pick(choices)
                    return move('PlaceStation', { ...request, expectedCost: cost })
                }
            }
            return move('FinishStations', { companyId })
        }
        case 'RunningTrains': {
            const companyId = state.routeStep?.companyId ?? ''
            const { result } = autorouter.solve(state, RouteRules1822, companyId, {
                timeLimitMs: 150
            })
            return move('RunTrains', {
                companyId,
                routes: result.routes.map(({ trainId, start, paths, attachmentIds }) => ({
                    trainId,
                    start,
                    paths,
                    ...(attachmentIds ? { attachmentIds } : {})
                }))
            })
        }
        case 'DistributingEarnings': {
            const companyId = state.routeStep?.companyId ?? ''
            const choices = EarningsChoices(state, companyId)
            return move('DistributeEarnings', { companyId, choice: pick(choices) })
        }
        case 'BuyingTrains': {
            const companyId = state.trainPurchaseStep?.companyId ?? ''
            const owned = trainsOwnedBy(state, { kind: 'company', companyId }).filter((train) =>
                TrainRules1822.satisfiesRequirement?.(state, train)
            )
            const funding = new EmergencyTrainFunding(
                state,
                TrainFundingRules1822,
                StockRules1822,
                TrainRules1822
            )
            if (valid.includes('FundTrain') && !owned.length) {
                const [purchase] = funding.purchases()
                if (purchase)
                    return move('FundTrain', {
                        companyId,
                        trainId: purchase.trainId,
                        definitionId: purchase.definitionId,
                        expectedPrice: purchase.price
                    })
            }
            const purchase = new TrainPurchase(state, TrainRules1822)
            const marketOffers = state.trainInventory.trains.flatMap((train) => {
                if (train.status !== 'market') return []
                const details = purchase.evaluate({
                    companyId,
                    trainId: train.id,
                    definitionId: train.definitionId
                }).details
                return details ? [details] : []
            })
            const offers = [
                ...purchase
                    .offers()
                    .flatMap((offer) =>
                        offer.evaluation.details ? [offer.evaluation.details] : []
                    ),
                ...marketOffers,
                ...purchase.exchanges()
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
                    expectedPrice: offer.price,
                    ...(offer.exchangeTrainId ? { exchangeTrainId: offer.exchangeTrainId } : {})
                })
            }
            if (valid.includes('AcquireMinor') && random.randInt(2) === 0) {
                const offer = pick(minorAcquisitions1822(state, playerId))
                const counting = [
                    ...trainsCountingForLimit(state, TrainRules1822, offer.companyId),
                    ...trainsCountingForLimit(state, TrainRules1822, offer.minorId)
                ]
                return move('AcquireMinor', {
                    companyId: offer.companyId,
                    minorId: offer.minorId,
                    shares: pick(offer.terms).shares,
                    token: pick(offer.tokens),
                    discardTrainIds: counting.slice(0, offer.excessTrains).map((train) => train.id),
                    ...(offer.londonNodeIds ? { nodeId: pick(offer.londonNodeIds) } : {})
                })
            }
            if (valid.includes('CorporateFinance') && random.randInt(4) === 0) {
                const choices = corporateFinanceChoices(state, CorporateFinanceRules1822)
                if (choices.length) return move('CorporateFinance', pick(choices))
            }
            return move(valid.includes('FinishTrains') ? 'FinishTrains' : 'FinishOperatingTurn', {
                companyId
            })
        }
        case 'FundingTrain': {
            const funding = new EmergencyTrainFunding(
                state,
                TrainFundingRules1822,
                StockRules1822,
                TrainRules1822
            )
            const next = funding.next()
            if (next.kind === 'sell')
                return move('SellFundingShares', {
                    seller: next.sales[0].seller,
                    companyId: next.sales[0].sales[0].companyId,
                    shares: next.sales[0].sales[0].shares,
                    expectedProceeds: next.sales[0].proceeds
                })
            if (next.kind === 'contribute')
                return move('ContributeTrainFunds', { owner: next.owner, amount: next.amount })
            throw new Error(`The bot cannot fund a train by ${next.kind}`)
        }
        default:
            throw new Error(`The bot has no move in ${state.machineState}: ${valid.join()}`)
    }
}

function EarningsChoices(state: Table['hydrated'], companyId: string): string[] {
    return state.companies.find((company) => company.id === companyId)?.kind === 'minor'
        ? ['pay']
        : ['pay', 'pay', 'half-pay', 'withhold']
}

/** Plays the table to its end, or to the action limit, returning the moves made. */
export function playOut(game: Table, seed: number, limit = 20000): number {
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
