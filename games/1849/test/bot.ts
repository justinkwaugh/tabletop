import {
    EmergencyTrainFunding,
    StationPlacement,
    TrackConstruction,
    TrainPurchase,
    corporateFinanceChoices,
    evaluateCompanyStart,
    evaluateSharePurchase,
    evaluateShareSale,
    finiteCashOwnedBy,
    insolvencyChoices,
    presidencyExchangeOptions,
    purchaseChoices,
    privateStationPositions,
    trainsOwnedBy,
    type Owner
} from '@tabletop/18xx'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { Autorouter } from '@tabletop/18xx-autorouter'
import {
    CorporateFinanceRules1849,
    TrainFundingRules1849,
    TrainRules1849,
    TransferRules1849
} from '../src/operating.js'
import { ETokenId, eTokenPrice1849 } from '../src/electricDreams.js'
import { PrivateCatalog1849 } from '../src/privates.js'
import { RouteRules1849 } from '../src/routes.js'
import { StationRules1849, garibaldiHomes } from '../src/stations.js'
import { CompanyRules1849, StockRules1849 } from '../src/stock.js'
import { TrackRules1849 } from '../src/track.js'
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
 * A simple seeded player for whole-game tests: it buys the privates, starts corporations in
 * order, trades shares, builds, runs the best routes, buys trains and answers every decision.
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

    // The Buy station tokens variant: the seller's president agrees or not (§14.1).
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
            marketSpaceId: pick(CompanyRules1849.awardParSpaces?.(state, '') ?? [])
        })
    if (valid.includes('DiscardTrain')) {
        const companyId = state.phaseChange?.discardCompanyIds[0] ?? ''
        const [train] = trainsOwnedBy(state, { kind: 'company', companyId })
        return move('DiscardTrain', { companyId, trainId: train?.id })
    }
    if (valid.includes('ChooseHomeStation')) {
        const [home] = garibaldiHomes(state, 0)
        return move('ChooseHomeStation', {
            companyId: 'AFG',
            locationId: home.locationId,
            nodeId: home.nodeId
        })
    }
    if (valid.includes('PlacePrivateStation') && state.privateStation) {
        const [position] = privateStationPositions(state, StationRules1849, state.privateStation)
        return position
            ? move('PlacePrivateStation', {
                  privateCompanyId: state.privateStation.privateCompanyId,
                  position
              })
            : move('DeclinePrivateStation', {
                  privateCompanyId: state.privateStation.privateCompanyId
              })
    }

    switch (state.machineState) {
        case 'WaterfallAuction': {
            const auction = state.openingAuction
            const lotId = auction?.remainingLotIds[0]
            if (valid.includes('BuyAuctionLot') && lotId) {
                // Only the first lot's price falls while everyone passes (§8).
                const discounted = lotId === PrivateCatalog1849.privates[0]?.id
                const price = Math.max(
                    0,
                    PrivateCatalog1849.faceValue(lotId) -
                        (discounted ? (auction?.discount ?? 0) : 0)
                )
                if (price <= cash && random.randInt(5) > 0)
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
                        StockRules1849
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
                    const spaces = CompanyRules1849.startMarketSpaces(state, company.id)
                    if (!spaces.length) continue
                    const marketSpaceId = pick(spaces)
                    const homes = CompanyRules1849.startHomes?.(state, company.id, marketSpaceId)
                    const home = homes?.[0]
                    const extras = state.certificates
                        .filter(
                            (certificate) =>
                                certificate.companyId === company.id &&
                                certificate.kind === 'share' &&
                                certificate.shares === 1 &&
                                !certificate.president
                        )
                        .slice(0, random.randInt(3))
                        .map((certificate) => certificate.id)
                    const request = {
                        playerId,
                        buyer: me,
                        companyId: company.id,
                        marketSpaceId,
                        ...(home
                            ? { home: { locationId: home.locationId, nodeId: home.nodeId } }
                            : {}),
                        ...(extras.length ? { additionalCertificateIds: extras } : {})
                    }
                    const result = evaluateCompanyStart(
                        state,
                        request,
                        StockRules1849,
                        CompanyRules1849
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
            if (valid.includes('BuyShares') && random.randInt(3) > 0) {
                const offers = state.certificates.flatMap((certificate) => {
                    const result = evaluateSharePurchase(
                        state,
                        { playerId, buyer: me, certificateId: certificate.id },
                        StockRules1849
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
                const construction = new TrackConstruction(state, TrackRules1849)
                const locations = TrackRules1849.map.definition.locations.filter(
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
            const station = state.stations.find(
                (entry) => entry.companyId === companyId && entry.status === 'available'
            )
            if (valid.includes('PlaceStation') && station) {
                const choices = new StationPlacement(state, StationRules1849).choices(station.id)
                if (choices.length) {
                    const { cost, ...request } = pick(choices)
                    return move('PlaceStation', { ...request, expectedCost: cost })
                }
            }
            return move('FinishStations', { companyId })
        }
        case 'RunningTrains': {
            const companyId = state.routeStep?.companyId ?? ''
            const { result } = autorouter.solve(state, RouteRules1849, companyId, {
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
            const funding = new EmergencyTrainFunding(
                state,
                TrainFundingRules1849,
                StockRules1849,
                TrainRules1849
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
            // Electric Dreams: sometimes buy the E token before the turn's trains (§14.3).
            if (valid.includes('BuyAccessRight') && random.randInt(2) === 0) {
                const price = eTokenPrice1849(state)
                if (finiteCashOwnedBy(state, { kind: 'company', companyId }) >= price)
                    return move('BuyAccessRight', {
                        companyId,
                        rightId: ETokenId,
                        expectedPrice: price
                    })
            }
            // Sometimes offer for another corporation's station, if any may be bought (§14.1).
            const stations = valid.includes('OfferPurchase')
                ? purchaseChoices(state, playerId, TransferRules1849, TrainRules1849).filter(
                      (choice) => choice.request.asset.kind === 'station'
                  )
                : []
            const treasury = finiteCashOwnedBy(state, { kind: 'company', companyId })
            if (stations.length && treasury >= 1 && random.randInt(4) === 0) {
                const choice = pick(stations)
                return move('OfferPurchase', {
                    ...choice.request,
                    price: 1 + random.randInt(Math.min(treasury, 80))
                })
            }
            const purchase = new TrainPurchase(state, TrainRules1849)
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
                ...marketOffers
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
            if (valid.includes('CorporateFinance') && random.randInt(4) === 0) {
                const choices = corporateFinanceChoices(state, CorporateFinanceRules1849)
                if (choices.length) return move('CorporateFinance', pick(choices))
            }
            return move(valid.includes('FinishTrains') ? 'FinishTrains' : 'FinishOperatingTurn', {
                companyId
            })
        }
        case 'RepayingLoans': {
            // The Bonds variant: sometimes issue or repay the bond (§14.2).
            const companyId = state.loanStep?.companyId ?? ''
            if (valid.includes('RepayLoan') && random.randInt(2) === 0)
                return move('RepayLoan', { companyId })
            if (valid.includes('TakeLoan') && random.randInt(3) === 0)
                return move('TakeLoan', { companyId })
            return move('FinishOperatingTurn', { companyId })
        }
        case 'FundingTrain': {
            const funding = new EmergencyTrainFunding(
                state,
                TrainFundingRules1849,
                StockRules1849,
                TrainRules1849
            )
            const next = funding.next()
            if (next.kind === 'sell')
                return move('SellFundingShares', {
                    seller: next.sales[0].seller,
                    companyId: next.sales[0].sales[0].companyId,
                    shares: next.sales[0].sales[0].shares,
                    expectedProceeds: next.sales[0].proceeds
                })
            const choices = insolvencyChoices(state, TrainFundingRules1849, next)
            return move('DeclareBankruptcy', choices.length ? { choice: pick(choices) } : {})
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
