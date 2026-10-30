import { assert } from '@tabletop/common'
import {
    awardCertificates,
    beginWaterfallAuction,
    createCompanyStations,
    createOrdinaryShareCertificates,
    privateIncomePayments,
    settleCashPayments,
    startingCashByPlayerCount,
    treasuryPool,
    treasuryPoolId,
    type InitialPosition,
    type Opening,
    type OpeningSetup,
    type WaterfallAuctionRules
} from '@tabletop/18xx'
import { Charters1833NE, Privates1833NE, StationCount, corporationIds } from './companies.js'
import { GameConfig1833NE } from './definition/gameConfig.js'
import { Map1833NE } from './map.js'
import { PrivateCatalog1833NE } from './privates.js'
import { MarketPoolId } from './stock.js'
import { ReservedCitySpots } from './stations.js'
import { TileSet1833NE } from './tiles.js'
import { TakeoverDepot, TrainDepot1833NE } from './trains.js'
import type { HydratedState1833NE, State1833NE } from './state.js'

export const Bank1833NE = 10000
export const StartingCash1833NE: Readonly<Record<number, number>> = { 3: 600, 4: 450, 5: 400 }
export const startingCash1833NE = startingCashByPlayerCount(StartingCash1833NE)

/** §3.2: bids in $5 multiples from the printed price; when all pass, bids resolve and two income rounds follow. */
export const AuctionRules1833NE: WaterfallAuctionRules = {
    lots: (state) => PrivateCatalog1833NE.lots(state),
    increment: 5,
    bidMultiple: 5,
    firstBidAtPrice: true,
    bidOrder: 'clockwise-from-highest',
    allPass: 'resolve-bids-then-income',
    incomeRounds: 2,
    firstStockPlayer: 'after-last-purchase',
    award(state, award) {
        awardCertificates(state, award, [`${award.lotId}:charter`])
    },
    payIncome(state) {
        settleCashPayments(state, privateIncomePayments(state, { charters: Charters1833NE }))
    }
}

export function createOpening1833NE({
    players,
    startingPositions,
    config
}: OpeningSetup): Opening<typeof State1833NE, HydratedState1833NE> {
    assert(players.length >= 3 && players.length <= 5, '1833NE supports three to five players')
    const capital = startingCash1833NE({ playerCount: players.length, config })
    const takeoverGame = GameConfig1833NE.takeoverGame(config)
    const corporations = corporationIds(takeoverGame)
    const position: InitialPosition = {
        phaseId: 'I',
        stockMarket: { stacks: [] },
        bank: {},
        companies: [
            ...corporations.map((id) => ({ id, kind: 'major', started: false })),
            ...Privates1833NE.map((company) => ({ id: company.id, kind: 'private' }))
        ],
        certificatePools: [
            { id: MarketPoolId, owner: { kind: 'bank' } },
            ...corporations.map((id) => treasuryPool(id))
        ],
        cash: [
            { owner: { kind: 'bank' }, amount: Bank1833NE - players.length * capital },
            ...players.map((player) => ({
                owner: { kind: 'player' as const, playerId: player.playerId },
                amount: capital
            })),
            ...corporations.map((companyId) => ({
                owner: { kind: 'company' as const, companyId },
                amount: 0
            }))
        ],
        certificates: [
            ...corporations.flatMap((companyId) => {
                const treasury = {
                    owner: { kind: 'company' as const, companyId },
                    poolId: treasuryPoolId(companyId)
                }
                return createOrdinaryShareCertificates(
                    companyId,
                    Array.from({ length: 8 }, () => treasury),
                    treasury
                )
            }),
            ...Privates1833NE.map((company) => ({
                id: `${company.id}:charter`,
                companyId: company.id,
                kind: 'private' as const,
                owner: { kind: 'bank' as const }
            }))
        ],
        stations: corporations.flatMap((id) => createCompanyStations(id, StationCount)),
        stationReservations: [...Map1833NE.stationReservations(), ...ReservedCitySpots],
        tileInventory: TileSet1833NE.createInventory(),
        trainInventory: TrainDepot1833NE.createInventory(takeoverGame ? TakeoverDepot : undefined)
    }
    return {
        position,
        titleState: {
            ferries: [],
            spikeLayers: [],
            ...(takeoverGame ? { takeoverGame: true as const, takeovers: [] } : {})
        },
        begin: beginWaterfallAuction(AuctionRules1833NE, startingPositions)
    }
}
