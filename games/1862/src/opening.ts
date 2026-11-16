import {
    beginOpening,
    createOrdinaryShareCertificates,
    startingCashByPlayerCount,
    treasuryPool,
    type InitialPosition,
    type Opening,
    type OpeningSetup
} from '@tabletop/18xx'
import { assert, shuffle } from '@tabletop/common'
import { Companies1862 } from './companies.js'
import type { HydratedState1862, State1862 } from './state.js'
import { ParliamentState } from './state.js'
import { IpoPoolId, MarketPoolId } from './pools.js'
import { TileSet1862 } from './tiles.js'
import type { Availability, Variants1862 } from './titleState.js'
import { TrainDepot1862, depotIdFor, type TrainKind } from './trains.js'

export const Bank1862 = 15000

// Starting cash by player count (§2.4.4).
export const StartingCash1862: Readonly<Record<number, number>> = {
    2: 1200,
    3: 800,
    4: 600,
    5: 480,
    6: 400,
    7: 345,
    8: 300
}
export const startingCash1862 = startingCashByPlayerCount(StartingCash1862)

/**
 * The setup deals (§2.4): the order of the twenty director's certificates, of which the first
 * eight (nine or ten with seven or eight players) are available at once, the next four from
 * phase B, the next four from phase C and the rest out of the game; the train permits dealt to
 * the companies in play; and the seating, whose first player holds priority.
 */
export type OpeningDeal = {
    availability: Readonly<Record<string, Availability>>
    removedCompanyIds: readonly string[]
    permits: Readonly<Record<string, TrainKind>>
    playerOrder: readonly string[]
}

export function dealOpening({ players, prng, startingPositions }: OpeningSetup): OpeningDeal {
    const companyIds = Companies1862.map((company) => company.id)
    shuffle(companyIds, prng.random)
    const first = 8 + Math.max(0, players.length - 6)
    const groups: [Availability, number][] = [
        ['A', first],
        ['B', 4],
        ['C', 4]
    ]
    const availability: Record<string, Availability> = {}
    let next = 0
    for (const [phase, count] of groups)
        for (const companyId of companyIds.slice(next, (next += count)))
            availability[companyId] = phase
    const inPlay = companyIds.slice(0, next)
    // Six Freight and five each of Express and Local; six of each with seven or eight players.
    const permits: TrainKind[] = [
        ...Array.from({ length: 6 }, () => 'freight' as const),
        ...Array.from({ length: players.length > 6 ? 6 : 5 }, () => 'express' as const),
        ...Array.from({ length: players.length > 6 ? 6 : 5 }, () => 'local' as const)
    ]
    shuffle(permits, prng.random)
    const order = players.map((player) => player.playerId)
    shuffle(order, prng.random)
    return {
        availability,
        removedCompanyIds: companyIds.slice(next),
        permits: Object.fromEntries(inPlay.map((companyId, index) => [companyId, permits[index]])),
        // Seats replace the dealt order cards, which are dealt either way to keep the setup seeded.
        playerOrder: startingPositions ? [...startingPositions.playerIds] : order
    }
}

/** A company's eight certificates: the director's of three shares and seven of one (§2.1). */
export function companyCertificates(companyId: string) {
    const ipo = { owner: { kind: 'bank' } as const, poolId: IpoPoolId }
    const [director, ...ordinary] = createOrdinaryShareCertificates(
        companyId,
        Array.from({ length: 7 }, () => ipo),
        ipo
    )
    return [{ ...director, shares: 3 }, ...ordinary]
}

export function variantsFrom(config: Record<string, unknown> | undefined): Variants1862 {
    return config?.eightStations === true ? { eightStations: true } : {}
}

/** The game's length, which sets the trains it is played with (§2.4.3). */
function gameLength(config: Record<string, unknown> | undefined): 'short' | 'standard' | 'long' {
    const length = config?.length
    return length === 'short' || length === 'long' ? length : 'standard'
}

export function createOpening1862(
    setup: OpeningSetup
): Opening<typeof State1862, HydratedState1862> {
    const { players } = setup
    assert(players.length >= 2 && players.length <= 8, '1862 supports two to eight players')
    const deal = dealOpening(setup)
    const variants = variantsFrom(setup.config)
    const length = gameLength(setup.config)
    const capital = StartingCash1862[players.length]
    const companyIds = Object.keys(deal.availability)
    const position: InitialPosition = {
        stockMarket: { stacks: [] },
        bank: {},
        companies: companyIds.map((id) => ({
            id,
            kind: 'major',
            started: false,
            floated: false,
            funded: false,
            operated: false
        })),
        cash: [
            { owner: { kind: 'bank' }, amount: Bank1862 - players.length * capital },
            ...players.map((player) => ({
                owner: { kind: 'player' as const, playerId: player.playerId },
                amount: capital
            })),
            ...companyIds.map((companyId) => ({
                owner: { kind: 'company' as const, companyId },
                amount: 0
            }))
        ],
        certificatePools: [
            { id: IpoPoolId, owner: { kind: 'bank' } },
            { id: MarketPoolId, owner: { kind: 'bank' } },
            // Each company's charter holds the shares it sells or has redeemed (§6.5.1, §7.13).
            ...companyIds.map(treasuryPool)
        ],
        certificates: companyIds.flatMap(companyCertificates),
        // Stations are bought as a company floats (§6.5.4.2).
        stations: [],
        // Homes are not reserved (§12).
        stationReservations: [],
        tileInventory: TileSet1862.createInventory(),
        trainInventory: TrainDepot1862.createInventory(
            length === 'standard' ? undefined : depotIdFor(length)
        ),
        phaseId: 'A'
    }
    return {
        position,
        titleState: {
            variants,
            permits: Object.fromEntries(
                Object.entries(deal.permits).map(([companyId, kind]) => [companyId, [kind]])
            ),
            originalPermits: { ...deal.permits },
            availability: { ...deal.availability },
            chartered: [],
            obligations: [],
            warranties: {}
        },
        begin(state) {
            const [firstPlayerId] = deal.playerOrder
            state.turnManager.turnOrder = [...deal.playerOrder]
            // The game opens with two Parliament Rounds before the first stock round (§3).
            state.parliament = {
                number: 1,
                stockRound: state.stockRound.number,
                declinedIds: [],
                winnerIds: []
            }
            beginOpening(state, ParliamentState, firstPlayerId)
        }
    }
}
