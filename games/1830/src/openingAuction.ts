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
import { EighteenThirtyGameConfig } from './definition/gameConfig.js'
import { EighteenThirtyMajors } from './majors.js'
import { EighteenThirtyMap } from './map.js'
import { EighteenThirtyPrivateCatalog, EighteenThirtyPrivates } from './privates.js'
import type { EighteenThirtyState, HydratedEighteenThirtyState } from './state.js'
import { EighteenThirtyStationCounts } from './stationRules.js'
import { EighteenThirtyTileSet } from './tiles.js'
import { createEighteenThirtyTrainInventory } from './trains.js'

export const EighteenThirtyBank = 12000
export const EighteenThirtyStartingCash: Readonly<Record<number, number>> = {
    2: 1200,
    3: 800,
    4: 600,
    5: 480,
    6: 400
}

// C&A's first buyer receives a PRR share; B&O's receives B&O's president's certificate.
const EighteenThirtyAwardedShares: Readonly<Record<string, readonly string[]>> = {
    CA: ['PRR:share:1'],
    BOP: ['BO:president']
}

export const EighteenThirtyAuctionRules: WaterfallAuctionRules = {
    lots: (state) => EighteenThirtyPrivateCatalog.lots(state),
    increment: 5,
    bidOrder: 'lowest-bid-first',
    award(state, award) {
        awardCertificates(state, award, [
            `${award.lotId}:charter`,
            ...(EighteenThirtyAwardedShares[award.lotId] ?? [])
        ])
        if (award.lotId === 'BOP') requirePar(state, 'BO', award.playerId)
    },
    payIncome(state) {
        settleCashPayments(state, privateIncomePayments(state))
    }
}
export function createEighteenThirtyOpening({
    players,
    config,
    startingPositions
}: OpeningSetup): Opening<typeof EighteenThirtyState, HydratedEighteenThirtyState> {
    assert(players.length >= 2 && players.length <= 6, '1830 supports two through six players')
    const options = EighteenThirtyGameConfig.options(config)
    const majors = Object.values(EighteenThirtyMajors)
    const capital = EighteenThirtyStartingCash[players.length]
    const ipo = { owner: { kind: 'bank' } as const, poolId: 'initial-offering' }
    const position: InitialPosition = {
        stockMarket: { stacks: [] },
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
            ...EighteenThirtyPrivates.map((company) => ({
                id: company.id,
                name: company.name,
                kind: 'private',
                privateRevenue: company.revenue
            }))
        ],
        cash: [
            { owner: { kind: 'bank' }, amount: EighteenThirtyBank - players.length * capital },
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
            { id: 'initial-offering', name: 'IPO', owner: { kind: 'bank' } },
            { id: 'open-market', name: 'Market', owner: { kind: 'bank' } }
        ],
        certificates: [
            ...majors.flatMap((company) =>
                createOrdinaryShareCertificates(
                    company.id,
                    Array.from({ length: 8 }, () => ipo),
                    ipo
                )
            ),
            ...EighteenThirtyPrivates.map((company) => ({
                id: `${company.id}:charter`,
                companyId: company.id,
                kind: 'private' as const,
                certificateLimitCount: 1,
                retired: false as const,
                owner: { kind: 'bank' as const }
            }))
        ],
        stations: majors.flatMap((company) =>
            createCompanyStations(company.id, EighteenThirtyStationCounts[company.id])
        ),
        stationReservations: EighteenThirtyMap.stationReservations(),
        tileInventory: EighteenThirtyTileSet.createInventory(),
        trainInventory: createEighteenThirtyTrainInventory(options.extraSixTrain),
        phaseId: '2'
    }
    return {
        position,
        ...(options.multipleBrownFromIpo ? { titleState: { multipleBrownFromIpo: true } } : {}),
        begin: beginWaterfallAuction(EighteenThirtyAuctionRules, startingPositions)
    }
}
