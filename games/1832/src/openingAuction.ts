import {
    awardCertificates,
    beginWaterfallAuction,
    createCompanyStations,
    createOrdinaryShareCertificates,
    privateIncomePayments,
    requirePar,
    settleCashPayments,
    type InitialPosition,
    type Opening,
    type OpeningSetup,
    type WaterfallAuctionRules
} from '@tabletop/18xx'
import { assert } from '@tabletop/common'
import { EighteenThirtyTwoMajors } from './majors.js'
import { EighteenThirtyTwoMap } from './map.js'
import { EighteenThirtyTwoPrivateCatalog, EighteenThirtyTwoPrivates } from './privates.js'
import type { EighteenThirtyTwoState, HydratedEighteenThirtyTwoState } from './state.js'
import { EighteenThirtyTwoStationCounts } from './stationRules.js'
import { createEighteenThirtyTwoStockMarket } from './stockMarket.js'
import { EighteenThirtyTwoTileSet } from './tiles.js'
import { EighteenThirtyTwoTrainDepot } from './trains.js'

export const EighteenThirtyTwoBank = 12000
export const EighteenThirtyTwoInitialTitleState = {
    ownershipLimitExemptions: [],
    systems: {},
    mergers: [],
    coalRights: [],
    revenueTokens: [],
    companyStarts: {}
}
// $2100 divided among the players (§3.3, Table 2).
export const EighteenThirtyTwoStartingCash: Readonly<Record<number, number>> = {
    2: 1050,
    3: 700,
    4: 525,
    5: 420,
    6: 350,
    7: 300
}

// The privates are sold in ascending order; bids exceed the price by $5, and several bidders
// settle a lot by auction from the left of the highest bidder (§5.7).
export const EighteenThirtyTwoAuctionRules: WaterfallAuctionRules = {
    lots: (state) => EighteenThirtyTwoPrivateCatalog.lots(state),
    increment: 5,
    bidOrder: 'clockwise-from-highest',
    // P7's buyer also receives the CoG president's certificate and sets its par (§16.2 P7).
    award(state, award) {
        awardCertificates(state, award, [
            `${award.lotId}:charter`,
            ...(award.lotId === 'P7' ? ['CG:president'] : [])
        ])
        if (award.lotId === 'P7') requirePar(state, 'CG', award.playerId)
    },
    payIncome(state) {
        settleCashPayments(state, privateIncomePayments(state))
    }
}

export function createEighteenThirtyTwoOpening({
    players,
    startingPositions
}: OpeningSetup): Opening<typeof EighteenThirtyTwoState, HydratedEighteenThirtyTwoState> {
    assert(players.length >= 2 && players.length <= 7, '1832 supports two through seven players')
    const majors = Object.values(EighteenThirtyTwoMajors)
    const capital = EighteenThirtyTwoStartingCash[players.length]
    const ipo = { owner: { kind: 'bank' } as const, poolId: 'initial-offering' }
    const position: InitialPosition = {
        stockMarket: createEighteenThirtyTwoStockMarket(),
        bank: { name: 'Bank', unlimitedAfterExhaustion: true },
        companies: [
            ...majors.map((company) => ({
                ...company,
                kind: 'major',
                shareCount: 10,
                started: false,
                floated: false,
                funded: false,
                operated: false
            })),
            ...EighteenThirtyTwoPrivates.map((company) => ({
                id: company.id,
                name: company.name,
                kind: 'private',
                privateRevenue: company.revenue
            }))
        ],
        cash: [
            { owner: { kind: 'bank' }, amount: EighteenThirtyTwoBank - players.length * capital },
            ...players.map((player) => ({
                owner: { kind: 'player' as const, playerId: player.playerId },
                amount: capital
            })),
            ...majors.map((company) => ({
                owner: { kind: 'company' as const, companyId: company.id },
                amount: 0
            }))
        ],
        certificatePools: [
            { id: 'initial-offering', name: 'Initial offering', owner: { kind: 'bank' } },
            { id: 'open-market', name: 'Open market', owner: { kind: 'bank' } }
        ],
        certificates: [
            ...majors.flatMap((company) =>
                createOrdinaryShareCertificates(
                    company.id,
                    Array.from({ length: 8 }, () => ipo),
                    ipo
                )
            ),
            ...EighteenThirtyTwoPrivates.map((company) => ({
                id: `${company.id}:charter`,
                companyId: company.id,
                kind: 'private' as const,
                certificateLimitCount: 1,
                retired: false as const,
                owner: { kind: 'bank' as const }
            }))
        ],
        stations: majors.flatMap((company) =>
            createCompanyStations(company.id, EighteenThirtyTwoStationCounts[company.id])
        ),
        stationReservations: EighteenThirtyTwoMap.stationReservations(),
        tileInventory: EighteenThirtyTwoTileSet.createInventory(),
        trainInventory: EighteenThirtyTwoTrainDepot.createInventory(),
        phaseId: '2'
    }
    return {
        position,
        titleState: EighteenThirtyTwoInitialTitleState,
        begin: beginWaterfallAuction(EighteenThirtyTwoAuctionRules, startingPositions)
    }
}
