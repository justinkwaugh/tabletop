import {
    beginOpening,
    createCompanyStations,
    treasuryPoolId,
    type InitialPosition,
    type Opening,
    type OpeningSetup
} from '@tabletop/18xx'
import { assert, shuffle, type Prng } from '@tabletop/common'
import {
    ConcessionIds1822,
    LnwrId,
    MajorIds1822,
    Majors1822,
    MinorIds1822,
    createMajorCertificates1822,
    createMinorCertificates1822,
    exchangeTokenCount1822,
    minor1822
} from './companies.js'
import { LotKinds1822, LotStacks1822, charterCertificateId, refillBidBoxes1822 } from './lots.js'
import { Map1822 } from './map.js'
import { MarketPoolId1822 } from './names.js'
import { PhaseCreditPrivateIds, Privates1822, TaxHavenPrivateId } from './privates.js'
import { Bank1822, MaximumPlayers1822, MinimumPlayers1822, startingCash1822 } from './setup.js'
import type { HydratedState1822, State1822 } from './state.js'
import { TileSet1822 } from './tiles.js'
import { TrainDepot1822 } from './trains.js'

/** A major company begins with two station tokens it may place: its home and one more (§5.12.2). */
const MajorStationCount = 2
const MinorStationCount = 1

/** Private companies that hold money or a share on their own charter (Table 3: P15, P16, P20). */
const PrivatesHoldingCash: readonly string[] = [...PhaseCreditPrivateIds, TaxHavenPrivateId]

/** Shuffles a stack with its fixed certificate on top (§2.1.4–§2.1.6). */
function dealStack(prng: Prng, lotIds: readonly string[], first: string): string[] {
    const rest = lotIds.filter((id) => id !== first)
    shuffle(rest, prng.random)
    return [first, ...rest]
}

export function createOpening1822({
    players,
    prng,
    config,
    startingPositions
}: OpeningSetup): Opening<typeof State1822, HydratedState1822> {
    assert(
        players.length >= MinimumPlayers1822 && players.length <= MaximumPlayers1822,
        '1822 supports three to seven players'
    )
    const minorIds = MinorIds1822.filter((id) => !minor1822(id)?.expansion)
    const privates = Privates1822.filter((entry) => !entry.expansion)
    const charterIds = [...privates.map((entry) => entry.id), ...ConcessionIds1822]
    const capital = startingCash1822({ playerCount: players.length, config })
    // The player number cards are dealt at random (§2.1.14).
    const order = players.map((entry) => entry.playerId)
    shuffle(order, prng.random)
    const playerOrder = startingPositions ? [...startingPositions.playerIds] : order
    const stacks = LotKinds1822.map((kind) => ({
        id: kind,
        lotIds: dealStack(prng, LotStacks1822[kind].lotIds, LotStacks1822[kind].first)
    }))
    const companyIds = [...MajorIds1822, ...minorIds]
    const position: InitialPosition = {
        stockMarket: { stacks: [] },
        bank: {},
        phaseId: '1',
        companies: [
            ...MajorIds1822.map((id) => ({ id, kind: 'major' })),
            ...minorIds.map((id) => ({ id, kind: 'minor' })),
            ...charterIds.map((id) => ({ id, kind: 'private' }))
        ].map((company) =>
            company.kind === 'private'
                ? company
                : { ...company, started: false, floated: false, funded: false, operated: false }
        ),
        cash: [
            { owner: { kind: 'bank' }, amount: Bank1822 - players.length * capital },
            ...players.map((entry) => ({
                owner: { kind: 'player' as const, playerId: entry.playerId },
                amount: capital
            })),
            ...[...companyIds, ...PrivatesHoldingCash.filter((id) => charterIds.includes(id))].map(
                (companyId) => ({
                    owner: { kind: 'company' as const, companyId },
                    amount: 0
                })
            )
        ],
        certificatePools: [
            { id: MarketPoolId1822, owner: { kind: 'bank' } },
            ...companyIds.map((companyId) => ({
                id: treasuryPoolId(companyId),
                owner: { kind: 'company' as const, companyId }
            }))
        ],
        certificates: [
            ...MajorIds1822.flatMap((companyId) => createMajorCertificates1822(companyId)),
            ...minorIds.flatMap((companyId) =>
                createMinorCertificates1822(companyId, { owner: { kind: 'bank' } })
            ),
            ...charterIds.map((companyId) => ({
                id: charterCertificateId(companyId),
                companyId,
                kind: 'private' as const,
                owner: { kind: 'bank' as const }
            }))
        ],
        stations: [
            ...MajorIds1822.flatMap((companyId) =>
                createCompanyStations(companyId, MajorStationCount)
            ),
            ...minorIds.flatMap((companyId) => createCompanyStations(companyId, MinorStationCount))
        ],
        stationReservations: [
            ...Map1822.stationReservations().filter((reservation) =>
                companyIds.includes(reservation.companyId)
            ),
            // The LNWR's destination token starts in Manchester as a second home (§5.6.2).
            ...Majors1822.filter((major) => major.id === LnwrId).map((major) => ({
                companyId: major.id,
                ...major.destination
            }))
        ],
        tileInventory: TileSet1822.createInventory(),
        trainInventory: TrainDepot1822.createInventory()
    }
    const titleState = {
        ownershipLimitExemptions: [],
        bidBoxes: { stacks, boxes: [], bids: [] },
        playerLoans: [],
        debutCompanyIds: [],
        discountTokens: [],
        exchangeTokens: MajorIds1822.map((companyId) => ({
            companyId,
            count: exchangeTokenCount1822(companyId)
        }))
    }
    return {
        position,
        titleState,
        begin(state) {
            state.turnManager.turnOrder = [...playerOrder]
            refillBidBoxes1822(state)
            beginOpening(state, 'StockRound', playerOrder[0])
        }
    }
}
