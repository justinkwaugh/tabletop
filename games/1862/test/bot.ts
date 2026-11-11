import {
    StationPlacement,
    TrackConstruction,
    TrainPurchase,
    evaluateSharePurchase,
    evaluateShareSale,
    finiteCashOwnedBy,
    trainsOwnedBy,
    type Owner,
    type OperatingResult
} from '@tabletop/18xx'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { Autorouter } from '@tabletop/18xx-autorouter'
import {
    canBid,
    canOpen,
    charterPars,
    charterShareChoices,
    charterableCompanies,
    parliamentDecision
} from '../src/parliament.js'
import { mergerDecision, mergerKind, mergerPartners } from '../src/mergers.js'
import { fineSales } from '../src/obligations.js'
import { StationRules1862, TrainRules1862 } from '../src/operating.js'
import { RouteRules1862 } from '../src/routeRules.js'
import type { HydratedState1862 } from '../src/state.js'
import { stationCounts } from '../src/stationPurchase.js'
import { marketSpaceIdAt, NonCharteredStartPrices } from '../src/stockMarket.js'
import { StockRules1862 } from '../src/stockRules.js'
import { TrackRules1862 } from '../src/trackRules.js'
import { canRefinance, mustRaiseCash, redeemableShare, treasurySale } from '../src/trainFunding.js'
import { trainFace } from '../src/trains.js'
import { CompanyRules1862 } from '../src/companyRules.js'
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
type Prng = Random

/**
 * A simple seeded player for whole-game tests: it charters and starts companies, buys shares,
 * builds, runs the best routes, pays out and buys trains, and answers every decision, so long
 * games reach the title's endings.
 */
export function botMove(game: Table, random: Prng): Move {
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
        case 'ParliamentRound': {
            const decision = parliamentDecision(state)
            if (decision?.kind === 'charter') {
                const pars = charterPars(state, playerId, decision.bid)
                const par =
                    pars
                        .filter((price) =>
                            charterShareChoices(state, playerId, decision.bid, price).includes(2)
                        )
                        .at(-1) ?? pars[0]
                const extras = charterShareChoices(state, playerId, decision.bid, par)
                return move('ObtainCharter', {
                    companyId: decision.companyId,
                    parPrice: par,
                    extraShares: Math.max(...extras)
                })
            }
            if (decision?.kind === 'bid')
                return valid.includes('RaiseCharterBid') &&
                    random.randInt(4) === 0 &&
                    canBid(state, playerId, decision.bid + 5)
                    ? move('RaiseCharterBid', { bid: decision.bid + 5 })
                    : move('PassCharterBid')
            if (canOpen(state, playerId) && cash > 500 && random.randInt(2) === 0)
                return move('OpenCharterAuction', {
                    companyId: pick(charterableCompanies(state)),
                    bid: 0
                })
            return move('DeclineCharter')
        }
        case 'StockRound': {
            const mustSell = !valid.includes('FinishStockTurn')
            if (valid.includes('SellShares') && (mustSell || random.randInt(10) === 0)) {
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
                        StockRules1862
                    )
                    if (sale.details)
                        return move('SellShares', {
                            seller: me,
                            sales,
                            expectedProceeds: sale.details.proceeds
                        })
                }
            }
            if (valid.includes('StartCompany') && random.randInt(3) === 0) {
                const companyId = state.companies.find(
                    (company) => CompanyRules1862.startMarketSpaces(state, company.id).length
                )?.id
                const price = NonCharteredStartPrices.filter((value) => value * 5 <= cash).at(-1)
                if (companyId && price)
                    return move('StartCompany', {
                        buyer: me,
                        companyId,
                        marketSpaceId: marketSpaceIdAt(price),
                        expectedPrice: price * 3
                    })
            }
            if (valid.includes('BuyShares')) {
                const offers = state.certificates.flatMap((certificate) => {
                    const result = evaluateSharePurchase(
                        state,
                        { playerId, buyer: me, certificateId: certificate.id },
                        StockRules1862
                    )
                    return result.details
                        ? [{ certificateId: certificate.id, price: result.details.price }]
                        : []
                })
                if (offers.length && random.randInt(3) > 0) {
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
        case 'BuyingStations': {
            const companyId = state.stationPurchase ?? ''
            return move('BuyStations', {
                companyId,
                count: Math.max(...stationCounts(state, companyId))
            })
        }
        case 'PayingFine': {
            const [sale] = fineSales(state, playerId)
            return move('SellForFine', { companyId: sale.companyId, shares: sale.shares })
        }
        case 'MergingShares': {
            const decision = mergerDecision(state)
            if (decision?.kind === 'answer')
                return move('AnswerMerger', { accept: random.randInt(2) === 0 })
            return move('DecideOption', {
                redeem: valid.includes('DecideOption') && random.randInt(2) === 0
            })
        }
        case 'LayingTrack': {
            const companyId = state.trackStep?.companyId ?? ''
            if (valid.includes('ProposeMerger') && random.randInt(8) === 0) {
                const partnerId = pick(mergerPartners(state, companyId))
                if (mergerKind(state, playerId, companyId))
                    return move('ProposeMerger', {
                        companyId,
                        partnerId,
                        survivorId: pick([companyId, partnerId])
                    })
            }
            if (valid.includes('LayTile')) {
                const construction = new TrackConstruction(state, TrackRules1862)
                const locations = TrackRules1862.map.definition.locations.filter(
                    (location) => location.buildable
                )
                for (let tries = 0; tries < 12; tries++) {
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
                for (const location of locations) {
                    const [choice] = construction.choices(location.id)
                    if (choice)
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
                const choices = new StationPlacement(state, StationRules1862).choices(station.id)
                if (choices.length) {
                    const { cost, ...request } = pick(choices)
                    return move('PlaceStation', { ...request, expectedCost: cost })
                }
            }
            return move('FinishStations', { companyId })
        }
        case 'RunningTrains': {
            const companyId = state.routeStep?.companyId ?? ''
            const { result } = autorouter.solve(state, RouteRules1862, companyId, {
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
            const choice = valid.length ? pick(['pay', 'pay', 'withhold']) : 'pay'
            return move('DistributeEarnings', { companyId, choice })
        }
        case 'BuyingTrains': {
            const companyId = state.trainPurchaseStep?.companyId ?? ''
            if (mustRaiseCash(state, companyId)) {
                const shares = treasurySale(state, companyId)
                if (shares) return move('SellTreasuryShares', { companyId, shares })
                if (canRefinance(state, companyId)) return move('Refinance', { companyId })
                return move('GoBankrupt', { companyId })
            }
            const owned = trainsOwnedBy(state, { kind: 'company', companyId })
            const permits = state.permits[companyId] ?? []
            const offers = new TrainPurchase(state, TrainRules1862)
                .offers()
                .flatMap((offer) => (offer.evaluation.details ? [offer.evaluation.details] : []))
                .filter((offer) => permits.includes(trainFace(offer.definitionId).kind))
            const runnable = owned.filter((train) =>
                permits.includes(trainFace(train.definitionId).kind)
            )
            if (
                offers.length &&
                (runnable.length < 2 || random.randInt(3) === 0) &&
                valid.includes('BuyTrain')
            ) {
                const offer = pick(offers)
                return move('BuyTrain', {
                    companyId,
                    trainId: offer.trainId,
                    definitionId: offer.definitionId,
                    expectedPrice: offer.price
                })
            }
            if (!owned.length && valid.includes('BuyTrain')) {
                const [offer] = new TrainPurchase(state, TrainRules1862)
                    .offers()
                    .flatMap((entry) =>
                        entry.evaluation.details ? [entry.evaluation.details] : []
                    )
                if (offer)
                    return move('BuyTrain', {
                        companyId,
                        trainId: offer.trainId,
                        definitionId: offer.definitionId,
                        expectedPrice: offer.price
                    })
            }
            const redeem = redeemableShare(state, playerId, companyId)
            if (redeem && random.randInt(4) === 0)
                return move('RedeemShare', { companyId, certificateId: redeem.certificateId })
            if (valid.includes('ProposeMerger') && random.randInt(10) === 0) {
                const partnerId = pick(mergerPartners(state, companyId))
                return move('ProposeMerger', {
                    companyId,
                    partnerId,
                    survivorId: pick([companyId, partnerId])
                })
            }
            return move('FinishOperatingTurn', { companyId })
        }
        default:
            throw new Error(`The bot has no move in ${state.machineState}: ${valid.join()}`)
    }
}

/** Plays the table to its end, or to the action limit, returning the moves made. */
export function playOut(
    game: Table,
    seed: number,
    limit = 4000,
    inspectRun?: (state: HydratedState1862, result: OperatingResult) => void
): number {
    const random = new Random(seed)
    let count = 0
    while (game.state.machineState !== 'GameOver' && count < limit) {
        if (!game.state.activePlayerIds.length)
            throw new Error(
                `No one acts in ${game.state.machineState} after move ${count}: ${JSON.stringify({
                    trackStep: game.state.trackStep,
                    stationStep: game.state.stationStep,
                    routeStep: game.state.routeStep,
                    purchase: game.state.trainPurchaseStep,
                    set: game.state.operatingSet,
                    last: game.actions.slice(-4).map((action) => action.type)
                })}`
            )
        const next = botMove(game, random)
        const beforeRun = next.type === 'RunTrains' && inspectRun ? game.hydrated : undefined
        try {
            game.act(next.type, next.fields, next.playerId)
            const result = game.state.routeStep?.result
            if (beforeRun && result) inspectRun?.(beforeRun, result)
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

export type BotState = HydratedState1862
