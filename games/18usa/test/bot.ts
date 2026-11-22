import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import {
    CompanyAuctionModel,
    StationPlacement,
    TrackConstruction,
    TrainPurchase,
    evaluateSharePurchase,
    evaluateShareSale,
    finiteCashOwnedBy,
    privateTrackConstruction,
    privateTrackTermsFor,
    trainRoutesOf,
    trainsOverLimit,
    trainsOwnedBy,
    type Owner
} from '@tabletop/18xx'
import { Autorouter } from '@tabletop/18xx-autorouter'
import { EighteenUSAStockRules } from '../src/stockRules.js'
import { EighteenUSATrackRules } from '../src/trackRules.js'
import { EighteenUSAStationRules } from '../src/stationRules.js'
import { EighteenUSARouteRules } from '../src/routeRules.js'
import { EighteenUSATrainRules } from '../src/trainRules.js'
import { EighteenUSACashCrisisRules } from '../src/bankruptcy.js'
import { EighteenUSAAcquisitionRounds, EighteenUSAConversionRounds } from '../src/companyRounds.js'
import { EighteenUSAAuctionRules } from '../src/openingAuction.js'
import type { Table } from './kit.js'
import { EighteenUSAPrivatePowerRules } from '../src/privatePowerRules.js'
import { denverRotations, oreUpgrades } from '../src/trackActions.js'
import { assignableTrains } from '../src/trainAssignments.js'
import { EighteenUSAStations } from '../src/owedStations.js'

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

function actingCompanyId(game: Table): string {
    const state = game.hydrated
    return (
        state.trackStep?.companyId ??
        state.stationStep?.companyId ??
        state.routeStep?.companyId ??
        state.trainPurchaseStep?.companyId ??
        state.loanStep?.companyId ??
        EighteenUSAConversionRounds.companyId(state) ??
        EighteenUSAAcquisitionRounds.companyId(state) ??
        ''
    )
}

/**
 * A simple seeded player for whole-game tests: it bids for privates, auctions and trades
 * companies, builds, runs the best routes, pays out, buys trains with loans when it must, and
 * answers every merger, acquisition and cash decision, so games reach their end.
 */
export function botMove(game: Table, random: Random): Move {
    const state = game.hydrated
    const playerId = game.player
    const valid = game.valid(playerId)
    const pick = <T>(items: readonly T[]): T => items[random.randInt(items.length)]
    const me: Owner = { kind: 'player', playerId }
    const cash = finiteCashOwnedBy(state, me)
    const move = (type: string, fields: object = {}): Move => ({ type, fields, playerId })
    const companyId = actingCompanyId(game)
    const company: Owner = { kind: 'company', companyId }

    if (valid.includes('DiscardTrain')) {
        const discarding = state.phaseChange?.discardCompanyIds[0] ?? companyId
        const [train] = trainsOverLimit(state, EighteenUSATrainRules, discarding)
        return move('DiscardTrain', { companyId: discarding, trainId: train?.id })
    }

    switch (state.machineState) {
        case 'SelectionAuction': {
            const auction = state.selectionAuction
            const bidding = auction?.bidding
            if (bidding) {
                const high = bidding.auction.participants.reduce(
                    (best, participant) => Math.max(best, participant.bid ?? 0),
                    0
                )
                const minimum = high + 5
                if (valid.includes('BidForLot') && minimum <= cash && random.randInt(3) === 0)
                    return move('BidForLot', { lotId: bidding.lotId, amount: minimum })
                return move('PassSelectionAuction')
            }
            const lotId = auction?.remainingLotIds[random.randInt(auction.remainingLotIds.length)]
            if (lotId && valid.includes('NominateLot') && random.randInt(4) > 0) {
                const amount = EighteenUSAAuctionRules.openingBid(state, lotId)
                if (amount <= cash) return move('NominateLot', { lotId, amount })
            }
            return move('PassSelectionAuction')
        }
        case 'RaisingCash': {
            if (valid.includes('SellShares'))
                for (const entry of state.companies) {
                    const sales = [{ companyId: entry.id, shares: 1 }]
                    const sale = evaluateShareSale(
                        state,
                        { playerId, seller: me, sales },
                        EighteenUSACashCrisisRules
                    )
                    if (sale.details)
                        return move('SellShares', {
                            seller: me,
                            sales,
                            expectedProceeds: sale.details.proceeds
                        })
                }
            return move('GoBankrupt')
        }
        case 'StockRound': {
            const auction = new CompanyAuctionModel(state, EighteenUSAStockRules)
            if (state.companyAuction) {
                const auctioned = state.companyAuction.companyId
                if (valid.includes('FormCompany')) {
                    const choice = pick(formations(game))
                    return move('FormCompany', { companyId: auctioned, ...choice })
                }
                const lowest = auction.lowestBid(playerId)
                if (
                    valid.includes('BidForCompany') &&
                    lowest !== undefined &&
                    random.randInt(3) === 0
                )
                    return move('BidForCompany', { companyId: auctioned, amount: lowest })
                return move('PassCompanyAuction', { companyId: auctioned })
            }
            const mustSell = !valid.includes('FinishStockTurn')
            if (valid.includes('SellShares') && (mustSell || random.randInt(14) === 0))
                for (const entry of state.companies) {
                    const sales = [{ companyId: entry.id, shares: 1 }]
                    const sale = evaluateShareSale(
                        state,
                        { playerId, seller: me, sales },
                        EighteenUSAStockRules
                    )
                    if (sale.details)
                        return move('SellShares', {
                            seller: me,
                            sales,
                            expectedProceeds: sale.details.proceeds
                        })
                }
            if (valid.includes('AuctionCompany') && random.randInt(2) === 0) {
                const unstarted = state.companies.filter(
                    (entry) => entry.kind === 'major' && !entry.started && !entry.closed
                )
                const target = unstarted.length ? pick(unstarted) : undefined
                const homes = target
                    ? (EighteenUSAStockRules.companyAuction?.homes(state, target.id) ?? [])
                    : []
                const home = homes.length ? pick(homes) : undefined
                const lowest = home ? auction.lowestBid(playerId, home) : undefined
                if (target && home && lowest !== undefined) {
                    const maximum =
                        EighteenUSAStockRules.companyAuction?.maximumBid(state, playerId, home) ??
                        lowest
                    const amount = Math.min(maximum, lowest + 10 * random.randInt(12))
                    if (!auction.openingReason({ playerId, companyId: target.id, amount, home }))
                        return move('AuctionCompany', {
                            companyId: target.id,
                            amount,
                            home: { locationId: home.locationId, nodeId: home.nodeId }
                        })
                }
            }
            if (valid.includes('BuyShares') && random.randInt(3) > 0) {
                const offers = state.certificates.flatMap((certificate) => {
                    const result = evaluateSharePurchase(
                        state,
                        { playerId, buyer: me, certificateId: certificate.id },
                        EighteenUSAStockRules
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
            const power = powerMove(game, random, companyId)
            if (power) return power
            if (valid.includes('LayTile')) {
                const construction = new TrackConstruction(state, EighteenUSATrackRules)
                const locations = EighteenUSATrackRules.map.definition.locations.filter(
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
            const station = state.stations.find(
                (entry) => entry.companyId === companyId && entry.status === 'available'
            )
            if (valid.includes('PlaceStation') && station) {
                const choices = new StationPlacement(state, EighteenUSAStationRules).choices(
                    station.id
                )
                if (choices.length && random.randInt(2) === 0) {
                    const { cost, ...request } = pick(choices)
                    return move('PlaceStation', { ...request, expectedCost: cost })
                }
            }
            return move('FinishStations', { companyId })
        }
        case 'RunningTrains': {
            const power = powerMove(game, random, companyId)
            if (power) return power
            const { result } = autorouter.solve(state, EighteenUSARouteRules, companyId, {
                timeLimitMs: 150
            })
            return move('RunTrains', { companyId, routes: trainRoutesOf(result) })
        }
        case 'DistributingEarnings':
            return move('DistributeEarnings', {
                companyId,
                choice: pick(['pay', 'pay', 'half-pay', 'withhold'])
            })
        case 'BuyingTrains': {
            const owned = trainsOwnedBy(state, company).filter(
                (train) => train.definitionId !== 'P'
            )
            const purchase = new TrainPurchase(state, EighteenUSATrainRules)
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
            if (!owned.length && valid.includes('TakeLoan') && random.randInt(4) > 0)
                return move('TakeLoan', { companyId })
            return move(valid.includes('FinishTrains') ? 'FinishTrains' : 'FinishOperatingTurn', {
                companyId
            })
        }
        case 'RepayingLoans':
            if (valid.includes('RepayLoan') && random.randInt(3) === 0)
                return move('RepayLoan', { companyId })
            return move('FinishOperatingTurn', { companyId })
        case 'MergerRound':
            if (valid.includes('ConvertCompany') && random.randInt(3) === 0)
                return move('ConvertCompany', { companyId })
            return move('PassMerger', { companyId })
        case 'TradingConvertedShares': {
            if (valid.includes('BuyConvertedShare') && random.randInt(2) === 0) {
                const purchase = EighteenUSAConversionRounds.convertedSharePurchase(state, playerId)
                if (purchase.details)
                    return move('BuyConvertedShare', {
                        companyId,
                        expectedPrice: purchase.details.price
                    })
            }
            return move('PassConvertedShares', { companyId })
        }
        case 'BorrowingAfterConversion':
            return move('FinishConversionLoans', { companyId })
        case 'AcquisitionRound':
            for (const type of ['DeclineOffer', 'SkipCompanySale', 'OpenCompanySale'])
                if (valid.includes(type)) return move(type, { companyId })
            break
        case 'AcquisitionBidding':
            return move('PassOnCompany', { companyId })
        case 'AcquisitionLoans':
            return move('FinishAcquisitionLoans', { companyId })
        case 'SavingTrain': {
            const pending = state.boneyard
            return move('SaveTrain', {
                companyId: pending?.companyId,
                ...(pending && random.randInt(2) === 0 ? { trainId: pick(pending.trainIds) } : {})
            })
        }
        case 'ReducingStations': {
            const [marker] = EighteenUSAStations.removableMarkers(state, companyId)
            if (marker && random.randInt(2) === 0)
                return move('RemoveStationMarker', {
                    companyId,
                    locationId: marker.locationId,
                    kind: marker.kind
                })
            const station = pick(EighteenUSAStations.removableStations(state, companyId))
            return move('RemoveStation', { companyId, stationId: station?.id })
        }
        case 'DiscardingMergedTrains': {
            const [train] = trainsOverLimit(state, EighteenUSATrainRules, companyId)
            return move('DiscardMergedTrain', { companyId, trainId: train?.id })
        }
    }
    throw new Error(`The bot has no move in ${state.machineState}: ${valid.join()}`)
}

/** A move using one of the acting company's private powers or 18USA's own actions, if any applies. */
function powerMove(game: Table, random: Random, companyId: string): Move | undefined {
    const state = game.hydrated
    const playerId = game.player
    const valid = game.valid(playerId)
    const move = (type: string, fields: object = {}): Move => ({ type, fields, playerId })
    const pick = <T>(items: readonly T[]): T => items[random.randInt(items.length)]
    if (random.randInt(2) === 0) return undefined
    const held = state.companies
        .filter((entry) => entry.kind === 'private' && !entry.closed)
        .map((entry) => entry.id)
    if (valid.includes('LayPrivateTile'))
        for (const privateCompanyId of held) {
            const offered = EighteenUSAPrivatePowerRules.trackTerms(
                state,
                privateCompanyId,
                playerId
            )
            const option = offered?.options && pick(offered.options).id
            const terms = offered && privateTrackTermsFor(offered, option)
            if (!terms) continue
            const construction = privateTrackConstruction(state, terms, EighteenUSATrackRules)
            for (const locationId of terms.locationIds.slice(0, 12)) {
                const choices = construction.choices(locationId)
                if (!choices.length) continue
                const choice = pick(choices)
                return move('LayPrivateTile', {
                    privateCompanyId,
                    ...(option ? { option } : {}),
                    companyId: terms.companyId,
                    locationId,
                    definitionId: choice.definitionId,
                    rotation: choice.rotation,
                    nodeMapping: choice.nodeMapping,
                    expectedCost: choice.cost
                })
            }
        }
    if (valid.includes('PlacePrivateMarker'))
        for (const privateCompanyId of held) {
            const terms = EighteenUSAPrivatePowerRules.markerTerms?.(
                state,
                privateCompanyId,
                playerId
            )
            if (terms?.locationIds.length)
                return move('PlacePrivateMarker', {
                    privateCompanyId,
                    locationId: pick(terms.locationIds)
                })
        }
    if (valid.includes('PlacePrivateToken'))
        for (const privateCompanyId of held) {
            const terms = EighteenUSAPrivatePowerRules.tokenTerms?.(
                state,
                privateCompanyId,
                playerId
            )
            if (terms?.positions.length)
                return move('PlacePrivateToken', {
                    privateCompanyId,
                    position: pick(terms.positions)
                })
        }
    if (valid.includes('UpgradeOre')) {
        const upgrades = oreUpgrades(state, companyId)
        if (upgrades.length)
            return move('UpgradeOre', { companyId, locationId: pick(upgrades).locationId })
    }
    if (valid.includes('TurnDenver')) {
        const rotations = denverRotations(state, companyId)
        if (rotations.length) return move('TurnDenver', { companyId, rotation: pick(rotations) })
    }
    if (valid.includes('BuyPullman')) return move('BuyPullman', { companyId })
    if (valid.includes('AssignTrainPower'))
        for (const power of ['double-heading', 'switcher'] as const) {
            const trains = assignableTrains(state, companyId, power)
            if (trains.length)
                return move('AssignTrainPower', { companyId, power, trainId: pick(trains).id })
        }
    if (valid.includes('ScrapPullman') && random.randInt(8) === 0)
        return move('ScrapPullman', { companyId })
    return undefined
}

function subsets<T>(items: readonly T[]): T[][] {
    return items.reduce<T[][]>((all, item) => [...all, ...all.map((set) => [...set, item])], [[]])
}

/** Every size and contribution the auction's winner may form the company with. */
function formations(game: Table): { shareCount: number; privateIds: string[] }[] {
    const state = game.hydrated
    const terms = EighteenUSAStockRules.companyAuction
    const pending = new CompanyAuctionModel(state, EighteenUSAStockRules).pendingFormation()
    if (!terms || !pending) throw new Error('No formation is pending')
    const choices = terms
        .shareCounts(state)
        .flatMap((shareCount) =>
            subsets(terms.contributions(state, pending.playerId, pending.price)).flatMap(
                (privateIds) =>
                    terms.formationReason(state, { ...pending, shareCount, privateIds })
                        ? []
                        : [{ shareCount, privateIds }]
            )
        )
    if (!choices.length) throw new Error('The winner cannot form the company')
    return choices
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
