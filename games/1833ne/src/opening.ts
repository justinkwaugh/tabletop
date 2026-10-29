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
import { Charters1833NE, Corporations1833NE, Privates1833NE, StationCount } from './companies.js'
import { Map1833NE } from './map.js'
import { PrivateCatalog1833NE } from './privates.js'
import { MarketPoolId } from './stock.js'
import { ReservedCitySpots } from './stations.js'
import { TileSet1833NE } from './tiles.js'
import { TrainDepot1833NE } from './trains.js'
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
    const position: InitialPosition = {
        phaseId: 'I',
        stockMarket: { stacks: [] },
        bank: {},
        companies: [
            ...Corporations1833NE.map((company) => ({
                id: company.id,
                kind: 'major',
                started: false
            })),
            ...Privates1833NE.map((company) => ({ id: company.id, kind: 'private' }))
        ],
        certificatePools: [
            { id: MarketPoolId, owner: { kind: 'bank' } },
            ...Corporations1833NE.map((company) => treasuryPool(company.id))
        ],
        cash: [
            { owner: { kind: 'bank' }, amount: Bank1833NE - players.length * capital },
            ...players.map((player) => ({
                owner: { kind: 'player' as const, playerId: player.playerId },
                amount: capital
            })),
            ...Corporations1833NE.map((company) => ({
                owner: { kind: 'company' as const, companyId: company.id },
                amount: 0
            }))
        ],
        certificates: [
            ...Corporations1833NE.flatMap((company) => {
                const treasury = {
                    owner: { kind: 'company' as const, companyId: company.id },
                    poolId: treasuryPoolId(company.id)
                }
                return createOrdinaryShareCertificates(
                    company.id,
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
        stations: Corporations1833NE.flatMap((company) =>
            createCompanyStations(company.id, StationCount)
        ),
        stationReservations: [...Map1833NE.stationReservations(), ...ReservedCitySpots],
        tileInventory: TileSet1833NE.createInventory(),
        trainInventory: TrainDepot1833NE.createInventory()
    }
    return {
        position,
        titleState: { ferries: [], spikeLayers: [] },
        begin: beginWaterfallAuction(AuctionRules1833NE, startingPositions)
    }
}
