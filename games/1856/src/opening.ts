import { assert } from '@tabletop/common'
import {
    awardCertificates,
    beginWaterfallAuction,
    createCompanyStations,
    createOrdinaryShareCertificates,
    privateIncomePayments,
    startingCashByPlayerCount,
    type InitialPosition,
    type Opening,
    type OpeningSetup,
    type WaterfallAuctionRules
} from '@tabletop/18xx'
import {
    CgrId,
    CgrStationCount,
    Majors1856,
    PrivateCatalog1856,
    Privates1856,
    ThbId
} from './companies.js'
import { GameConfig1856 } from './definition/gameConfig.js'
import { HamiltonLocationId, Map1856 } from './map.js'
import { IpoPoolId1856, MarketPoolId1856 } from './names.js'
import type { HydratedState1856, State1856 } from './state.js'
import { Charters1856 } from './charters.js'
import { TileSet1856 } from './tiles.js'
import { createTrainInventory1856 } from './trains.js'

export const Bank1856 = 12000

/** $1500 divided among the players (Player Starting Capital). */
export const startingCash1856 = startingCashByPlayerCount({ 3: 500, 4: 375, 5: 300, 6: 250 })

/**
 * The privates are sold in order: the next may be bought at its cost, later ones bid on for at
 * least $5 more. Two or more bidders bid again from the left of the highest. When everyone
 * passes the privates pay, and the Flos Tramway, while unsold, costs $5 less (Initial Stock
 * Round).
 */
export const AuctionRules1856: WaterfallAuctionRules<HydratedState1856> = {
    lots: (state) => PrivateCatalog1856.lots(state),
    increment: 5,
    bidOrder: 'clockwise-from-highest',
    allPass: 'discount-and-income',
    award(state, award) {
        awardCertificates(state, award, [`${award.lotId}:charter`])
    },
    incomePayments: (state) => privateIncomePayments(state, { charters: Charters1856 })
}

export function createOpening1856({
    players,
    config,
    startingPositions
}: OpeningSetup): Opening<typeof State1856, HydratedState1856> {
    assert(players.length >= 3 && players.length <= 6, '1856 supports three through six players')
    const options = GameConfig1856.options(config)
    const capital = startingCash1856({ playerCount: players.length, config })
    const ipo = { owner: { kind: 'bank' } as const, poolId: IpoPoolId1856 }
    const position: InitialPosition = {
        stockMarket: { stacks: [] },
        bank: {},
        companies: [
            ...[...Majors1856.map((company) => company.id), CgrId].map((id) => ({
                id,
                kind: 'major',
                started: false,
                floated: false,
                funded: false,
                operated: false
            })),
            ...Privates1856.map((company) => ({ id: company.id, kind: 'private' }))
        ],
        cash: [
            { owner: { kind: 'bank' }, amount: Bank1856 - players.length * capital },
            ...players.map((player) => ({
                owner: { kind: 'player' as const, playerId: player.playerId },
                amount: capital
            })),
            ...[...Majors1856.map((company) => company.id), CgrId].map((companyId) => ({
                owner: { kind: 'company' as const, companyId },
                amount: 0
            }))
        ],
        certificatePools: [
            { id: IpoPoolId1856, owner: { kind: 'bank' } },
            { id: MarketPoolId1856, owner: { kind: 'bank' } }
        ],
        certificates: [
            ...Majors1856.flatMap((company) =>
                createOrdinaryShareCertificates(
                    company.id,
                    Array.from({ length: 8 }, () => ipo),
                    ipo
                )
            ),
            ...Privates1856.map((company) => ({
                id: `${company.id}:charter`,
                companyId: company.id,
                kind: 'private' as const,
                owner: { kind: 'bank' as const }
            }))
        ],
        stations: [
            ...Majors1856.flatMap((company) =>
                createCompanyStations(company.id, company.stationCosts.length)
            ),
            ...createCompanyStations(CgrId, CgrStationCount)
        ],
        stationReservations: Map1856.stationReservations(),
        // The THB starts in either city of Hamilton.
        hexReservations: [{ companyId: ThbId, locationId: HamiltonLocationId }],
        tileInventory: TileSet1856.createInventory(),
        trainInventory: createTrainInventory1856(options.eightTrains),
        phaseId: '2'
    }
    return {
        position,
        titleState: {
            variants: {
                ...(options.alternateDestinations ? { alternateDestinations: true as const } : {}),
                ...(options.eightTrains ? { eightTrains: true as const } : {})
            },
            funding: [],
            destinationsReached: []
        },
        begin: beginWaterfallAuction(AuctionRules1856, startingPositions)
    }
}
