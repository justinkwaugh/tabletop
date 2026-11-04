import {
    awardCertificates,
    beginWaterfallAuction,
    closePrivate,
    createCompanyStations,
    createOrdinaryShareCertificates,
    destinationStationId,
    homeStationId,
    privateIncomePayments,
    requirePar,
    startingCashByPlayerCount,
    type InitialPosition,
    type Opening,
    type OpeningSetup,
    type WaterfallAuctionRules
} from '@tabletop/18xx'
import { assert } from '@tabletop/common'
import { GameConfig1870 } from './definition/gameConfig.js'
import {
    Charters1870,
    Companies1870,
    FriscoCompanyId,
    KatyCompanyId,
    OffboardHomeCompanyId
} from './companies.js'
import { Map1870, OffboardHomeLocationId } from './map.js'
import { FriscoPrivateId, KatyPrivateId, PrivateCatalog1870, Privates1870 } from './privates.js'
import type { HydratedState1870, State1870 } from './state.js'
import { TileSet1870 } from './tiles.js'
import { createTrainInventory1870 } from './trains.js'

export const Bank1870 = 12000
// $2100 divided among the players (p. 4).
export const StartingCash1870: Readonly<Record<number, number>> = {
    2: 1050,
    3: 700,
    4: 525,
    5: 420,
    6: 350,
    7: 300
}
export const startingCash1870 = startingCashByPlayerCount(StartingCash1870)

// The privates are offered in order; a bid beats the price or the last bid by $5, and several
// bidders settle a private by auction from the left of the highest bidder (p. 10).
export const AuctionRules1870: WaterfallAuctionRules = {
    lots: (state) => PrivateCatalog1870.lots(state),
    increment: 5,
    bidOrder: 'clockwise-from-highest',
    award(state, award) {
        const extras: Readonly<Record<string, string>> = {
            [FriscoPrivateId]: `${FriscoCompanyId}:president`,
            [KatyPrivateId]: `${KatyCompanyId}:share:1`
        }
        const extra = extras[award.lotId]
        awardCertificates(state, award, [`${award.lotId}:charter`, ...(extra ? [extra] : [])])
        // The Frisco private is its railway's president's certificate, and no more (p. 9).
        if (award.lotId === FriscoPrivateId) {
            closePrivate(state, FriscoPrivateId)
            requirePar(state, FriscoCompanyId, award.playerId)
        }
    },
    incomePayments(state) {
        return privateIncomePayments(state, { charters: Charters1870 })
    }
}

export const InitialTitleState1870 = {
    variants: {},
    revenueTokens: [],
    destinationRunsMade: [],
    destinationStations: []
}

function companyStations(companyId: string, count: number) {
    const stations = createCompanyStations(companyId, count)
    const destination = {
        id: destinationStationId(companyId),
        companyId,
        status: 'removed' as const
    }
    // The Southern Pacific's home is its printed place in the Southwest (p. 15).
    return [
        ...stations.map((station) =>
            station.id === homeStationId(OffboardHomeCompanyId)
                ? { id: station.id, companyId, status: 'removed' as const }
                : station
        ),
        destination
    ]
}

export function createOpening1870({
    players,
    config,
    startingPositions
}: OpeningSetup): Opening<typeof State1870, HydratedState1870> {
    assert(players.length >= 2 && players.length <= 7, '1870 supports two through seven players')
    const variants = GameConfig1870.variants(config)
    const capital = startingCash1870({ playerCount: players.length, config })
    const ipo = { owner: { kind: 'bank' } as const, poolId: 'initial-offering' }
    const position: InitialPosition = {
        stockMarket: { stacks: [] },
        bank: {},
        companies: [
            ...Companies1870.map((company) => ({
                id: company.id,
                kind: 'major',
                started: false,
                floated: false,
                funded: false,
                operated: false
            })),
            ...Privates1870.map((company) => ({ id: company.id, kind: 'private' }))
        ],
        cash: [
            { owner: { kind: 'bank' }, amount: Bank1870 - players.length * capital },
            ...players.map((player) => ({
                owner: { kind: 'player' as const, playerId: player.playerId },
                amount: capital
            })),
            ...Companies1870.map((company) => ({
                owner: { kind: 'company' as const, companyId: company.id },
                amount: 0
            }))
        ],
        certificatePools: [
            { id: 'initial-offering', owner: { kind: 'bank' } },
            { id: 'open-market', owner: { kind: 'bank' } }
        ],
        certificates: [
            ...Companies1870.flatMap((company) =>
                createOrdinaryShareCertificates(
                    company.id,
                    Array.from({ length: 8 }, () => ipo),
                    ipo
                )
            ),
            ...Privates1870.map((company) => ({
                id: `${company.id}:charter`,
                companyId: company.id,
                kind: 'private' as const,
                owner: { kind: 'bank' as const }
            }))
        ],
        stations: Companies1870.flatMap((company) =>
            companyStations(company.id, company.stationCosts.length)
        ),
        stationReservations: Map1870.stationReservations(),
        stationAccess: [
            {
                companyId: OffboardHomeCompanyId,
                locationId: OffboardHomeLocationId,
                nodeId: 'offboard',
                sourceId: 'home'
            }
        ],
        tileInventory: TileSet1870.createInventory(),
        trainInventory: createTrainInventory1870(variants),
        phaseId: '2'
    }
    return {
        position,
        titleState: { ...InitialTitleState1870, variants },
        begin: beginWaterfallAuction(AuctionRules1870, startingPositions)
    }
}
