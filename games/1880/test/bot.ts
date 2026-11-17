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
    pendingHomeChoice,
    placeableStations,
    playerLoan,
    presidencyExchangeOptions,
    purchaseChoices,
    trainsOwnedBy,
    type Owner
} from '@tabletop/18xx'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { Autorouter } from '@tabletop/18xx-autorouter'
import {
    engineerCompany,
    forcedRocketCompanies,
    rocketCompany,
    woosongPayment
} from '../src/privatePowers.js'
import { mergerReplaces, ownerDirectsMerger, unchosenInvestors } from '../src/investors.js'
import { AuctionRules1880 } from '../src/opening.js'
import { EarningsRules1880, TrainFundingRules1880, TransferRules1880 } from '../src/operating.js'
import { RouteRules1880 } from '../src/routes.js'
import { StationRules1880 } from '../src/stations.js'
import { CompanyRules1880, StockRules1880 } from '../src/stock.js'
import { TrackRules1880 } from '../src/track.js'
import { TrainRules1880 } from '../src/trainRules.js'
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
 * A simple seeded player for whole-game tests: it bids for the privates, chooses investors,
 * starts companies with their choices, trades shares, builds, runs the best routes, buys trains,
 * merges investors and uses the private powers.
 */
/**
 * Steering for scenario searches: keep the Rocket of China for its forced exchange, and buy
 * every train that a chosen company can.
 */
export type BotSteering = {
    keepsRocket?: boolean
    buysEagerly?: (companyId: string) => boolean
}

export function botMove(game: Table, random: Random, steering: BotSteering = {}): Move {
    const state = game.hydrated
    const playerId = game.player
    if (!playerId) throw new Error(`No one acts in ${state.machineState}`)
    const valid = game.valid(playerId)
    const pick = <T>(items: readonly T[]): T => items[random.randInt(items.length)]
    const me: Owner = { kind: 'player', playerId }
    const cash = finiteCashOwnedBy(state, me)
    const move = (type: string, fields: object = {}): Move => ({ type, fields, playerId })

    if (valid.includes('RespondToPurchaseOffer') && state.purchaseOffer)
        return move('RespondToPurchaseOffer', { offerId: state.purchaseOffer.id, accept: true })
    const exchange = state.presidencyExchanges?.[0]
    if (valid.includes('ChoosePresidencyExchange') && exchange)
        return move('ChoosePresidencyExchange', {
            companyId: exchange.companyId,
            certificateIds: pick(presidencyExchangeOptions(exchange))
        })
    if (valid.includes('ParCompany') && state.pendingPar) {
        const companyId = state.pendingPar.companyId
        const marketSpaceId = pick(CompanyRules1880.awardParSpaces?.(state, companyId) ?? [])
        const choices = CompanyRules1880.startChoices?.(state, companyId, {
            marketSpaceId,
            presidentShares: 2
        })
        return move('ParCompany', {
            companyId,
            marketSpaceId,
            choices: Object.fromEntries(
                (choices ?? []).map((choice) => [choice.id, pick(choice.options).id])
            )
        })
    }
    if (valid.includes('DiscardTrain')) {
        const companyId = state.phaseChange?.discardCompanyIds[0] ?? ''
        const [train] = trainsOwnedBy(state, { kind: 'company', companyId })
        return move('DiscardTrain', { companyId, trainId: train?.id })
    }
    if (valid.includes('ChooseHomeStation')) {
        const choice = pendingHomeChoice(state, StationRules1880)
        if (!choice) throw new Error('A home choice is offered')
        return move('ChooseHomeStation', { companyId: choice.companyId, ...pick(choice.positions) })
    }
    if (valid.includes('ChooseInvestor'))
        return move('ChooseInvestor', { investorId: pick(unchosenInvestors(state)) })
    if (valid.includes('MergeInvestor')) {
        const merger = state.investorMerger
        return move('MergeInvestor', {
            treasuryTo: random.randInt(4) === 0 ? 'owner' : 'company',
            replaceStation:
                !!merger && ownerDirectsMerger(state, merger) && mergerReplaces(state, merger)
        })
    }
    if (valid.includes('ReplaceInvestorStation')) {
        const merger = state.investorMerger
        return move('ReplaceInvestorStation', {
            replaceStation: !!merger && mergerReplaces(state, merger)
        })
    }
    if (valid.includes('ExchangeRocket') && state.machineState === 'ExchangingRocket') {
        const { companyIds, makesRoom } = forcedRocketCompanies(state)
        const companyId = pick(companyIds)
        const [train] = trainsOwnedBy(state, { kind: 'company', companyId })
        return move('ExchangeRocket', {
            companyId,
            ...(makesRoom && train ? { discardTrainId: train.id } : {})
        })
    }
    if (valid.includes('ClaimWoosongPayment') && random.randInt(2) === 0)
        return move('ClaimWoosongPayment', { amount: woosongPayment(state) })
    if (valid.includes('AssignEngineer') && random.randInt(2) === 0)
        return move('AssignEngineer', { companyId: engineerCompany(state, playerId) })
    if (valid.includes('ExchangeRocket') && !steering.keepsRocket && random.randInt(3) === 0)
        return move('ExchangeRocket', { companyId: rocketCompany(state, playerId) })
    if (valid.includes('RepayPlayerLoan')) {
        const amount = Math.min(cash, playerLoan(state, playerId))
        if (amount > 0) return move('RepayPlayerLoan', { amount })
    }

    switch (state.machineState) {
        case 'SelectionAuction': {
            const model = new SelectionAuctionModel(state, AuctionRules1880)
            const bidding = model.auction.bidding
            const lotId = bidding?.lotId ?? model.nominationLotIds[0]
            const minimum = model.minimumBid(lotId)
            if (minimum <= cash && random.randInt(3) > 0)
                return bidding
                    ? move('BidForLot', { lotId, amount: minimum })
                    : move('NominateLot', { lotId, amount: minimum })
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
                        StockRules1880
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
                    const spaces = CompanyRules1880.startMarketSpaces(state, company.id)
                    if (!spaces.length) continue
                    const marketSpaceId = pick(spaces)
                    const presidentShares = pick(
                        CompanyRules1880.presidentShareSizes?.(state, company.id) ?? [2]
                    )
                    const choices = Object.fromEntries(
                        (
                            CompanyRules1880.startChoices?.(state, company.id, {
                                marketSpaceId,
                                presidentShares
                            }) ?? []
                        ).map((choice) => [choice.id, pick(choice.options).id])
                    )
                    const request = {
                        playerId,
                        buyer: me,
                        companyId: company.id,
                        marketSpaceId,
                        presidentShares,
                        choices
                    }
                    const result = evaluateCompanyStart(
                        state,
                        request,
                        StockRules1880,
                        CompanyRules1880
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
                        StockRules1880
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
                const construction = new TrackConstruction(state, TrackRules1880)
                const locations = TrackRules1880.map.definition.locations.filter(
                    (location) => location.buildable !== false
                )
                for (let tries = 0; tries < 24; tries++) {
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
            const stations = placeableStations(state, companyId)
            if (valid.includes('PlaceStation') && stations.length) {
                const placement = new StationPlacement(state, StationRules1880)
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
            const { result } = autorouter.solve(state, RouteRules1880, companyId, {
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
                    EarningsRules1880.choices(state, companyId).flatMap((choice) =>
                        choice === 'pay' ? [choice, choice] : [choice]
                    )
                )
            })
        }
        case 'BuyingTrains': {
            const companyId = state.trainPurchaseStep?.companyId ?? ''
            const owned = trainsOwnedBy(state, { kind: 'company', companyId })
            const mayFinish =
                valid.includes('FinishOperatingTurn') || valid.includes('FinishTrains')
            if (valid.includes('FundTrain') && (!mayFinish || random.randInt(4) === 0)) {
                const funding = new EmergencyTrainFunding(
                    state,
                    TrainFundingRules1880,
                    StockRules1880,
                    TrainRules1880
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
            const trains = valid.includes('OfferPurchase')
                ? purchaseChoices(state, playerId, TransferRules1880, TrainRules1880)
                : []
            if (trains.length && random.randInt(6) === 0)
                return move('OfferPurchase', { ...pick(trains).request, price: 1 })
            const purchase = new TrainPurchase(state, TrainRules1880)
            const offers = purchase
                .offers()
                .flatMap((offer) => (offer.evaluation.details ? [offer.evaluation.details] : []))
            if (
                offers.length &&
                valid.includes('BuyTrain') &&
                (!owned.length || steering.buysEagerly?.(companyId) || random.randInt(3) === 0)
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
                TrainFundingRules1880,
                StockRules1880,
                TrainRules1880
            )
            const next = funding.next()
            if (next.kind === 'sell' && (!next.borrowInstead || random.randInt(2) === 0))
                return move('SellFundingShares', {
                    seller: next.sales[0].seller,
                    companyId: next.sales[0].sales[0].companyId,
                    shares: next.sales[0].sales[0].shares,
                    expectedProceeds: next.sales[0].proceeds
                })
            if (next.kind === 'sell' && next.borrowInstead)
                return move('ContributeTrainFunds', {
                    owner: next.owner,
                    amount: next.borrowInstead.amount
                })
            if (next.kind === 'contribute')
                return move('ContributeTrainFunds', { owner: next.owner, amount: next.amount })
            if (next.kind === 'buy')
                return move('BuyTrain', {
                    companyId: next.purchase.companyId,
                    trainId: next.purchase.trainId,
                    definitionId: next.purchase.definitionId,
                    expectedPrice: next.purchase.price
                })
            throw new Error(`The bot cannot fund a train: ${next.kind}`)
        }
        default:
            throw new Error(`The bot has no move in ${state.machineState}: ${valid.join()}`)
    }
}

/** What a watcher sees of each move: the state before and after, and the actions it processed. */
export type Watched = {
    before: Table['state']
    after: Table['state']
    processed: Table['actions']
}

/** Plays the table to its end, or to the action limit, returning the moves made. */
export function playOut(
    game: Table,
    seed: number,
    limit = 8000,
    watch?: (move: Watched) => void
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
        const next = botMove(game, random)
        const before = game.state
        try {
            const result = game.act(next.type, next.fields, next.playerId)
            watch?.({ before, after: game.state, processed: result.processedActions })
        } catch (error) {
            throw new Error(
                `Move ${count} ${next.type} ${JSON.stringify(next.fields)} by ${next.playerId} in ${game.state.machineState} (valid ${game.valid(next.playerId).join()}) failed: ${String(error)}`,
                { cause: error }
            )
        }
        count++
    }
    return count
}
