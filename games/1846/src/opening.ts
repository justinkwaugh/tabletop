import {
    assert,
    assertExists,
    shuffle,
    type PlayerState,
    type RandomFunction,
    type StartingPositionAssignment
} from '@tabletop/common'
import {
    beginOpening,
    createOrdinaryShareCertificates,
    createCompanyStations,
    type InitialPosition,
    type Opening,
    type OpeningSetup,
    type Station
} from '@tabletop/18xx'
import { BlockingStationLocations } from './stations.js'
import { EighteenFortySixMap, AdditionalReservations } from './map.js'
import { createInitialTrainInventory } from './trains.js'
import { EighteenFortySixTileSet } from './tiles.js'
import { BankSize, Corporations, DraftCompanies } from './catalog.js'
import { dealPacket } from './distribution.js'
import type {
    EighteenFortySixProjectedState,
    EighteenFortySixState,
    HydratedEighteenFortySixState
} from './state.js'

type Opening1846 = Opening<typeof EighteenFortySixProjectedState, HydratedEighteenFortySixState>

/** Seats players in table order: the last seat drafts first and the first holds the priority deal. */
function seatPlayers(
    players: readonly PlayerState[],
    random: RandomFunction,
    startingPositions?: StartingPositionAssignment
): PlayerState[] {
    const seated = [...players]
    // The ordinary seating draw is consumed either way so the rest of the seeded setup is unchanged.
    shuffle(seated, random)
    if (startingPositions === undefined) return seated
    return startingPositions.playerIds.toReversed().map((playerId) => {
        const player = players.find((candidate) => candidate.playerId === playerId)
        assertExists(player, 'Assigned players are seated')
        return player
    })
}

export function createOpening1846({ players, prng, startingPositions }: OpeningSetup): Opening1846 {
    const count = players.length
    assert(count >= 2 && count <= 5, '1846 supports two through five players')
    const random = prng.random
    const seating = seatPlayers(players, random, startingPositions)
    const removedPrivateIds = ['orange', 'blue'].flatMap((group) => {
        const candidates = DraftCompanies.filter(
            (company) => company.kind === 'private' && company.group === group
        ).map((company) => company.id)
        shuffle(candidates, random)
        return candidates.slice(0, count === 2 ? 2 : 6 - count)
    })
    const removalGroups =
        count === 2
            ? [
                  ['ERIE', 'GT', 'NYC', 'PRR'],
                  ['B&O', 'C&O', 'IC']
              ]
            : [['C&O', 'ERIE', 'PRR']]
    const removedCorporationIds = removalGroups.flatMap((group) => {
        shuffle(group, random)
        return group.slice(0, count === 2 ? 1 : 5 - count)
    })
    const privates = DraftCompanies.filter((company) => !removedPrivateIds.includes(company.id))
    const independents = privates.filter((company) => company.kind === 'independent')
    const majors = Corporations.filter((company) => !removedCorporationIds.includes(company.id))
    const certificates: EighteenFortySixState['certificates'] = [
        ...majors.flatMap((company) => {
            const treasury = { owner: { kind: 'company' as const, companyId: company.id } }
            return createOrdinaryShareCertificates(
                company.id,
                Array.from({ length: 8 }, () => treasury),
                treasury
            )
        }),
        ...privates.map((company): EighteenFortySixState['certificates'][number] => ({
            id: `${company.id}:charter`,
            companyId: company.id,
            owner: { kind: 'bank' },
            ...(company.kind === 'independent'
                ? { kind: 'share', shares: 1, president: true }
                : { kind: 'private' })
        }))
    ]
    const placedHomes = [
        ...Corporations.filter((company) => removedCorporationIds.includes(company.id)),
        ...independents
    ]
    const stations: Station[] = [
        ...majors.flatMap((company) => createCompanyStations(company.id, company.tokens)),
        ...placedHomes.map((company): Station => ({
            id: `${company.id}:station:1`,
            companyId: company.id,
            status: 'placed',
            position: { locationId: company.home, nodeId: 'city', slot: 0 }
        }))
    ]
    if (count === 2)
        for (const companyId of removedCorporationIds)
            stations.push(
                companyId === 'ERIE'
                    ? {
                          id: `${companyId}:blocking`,
                          companyId,
                          status: 'placed',
                          position: {
                              locationId: BlockingStationLocations[companyId],
                              nodeId: 'city',
                              slot: 0
                          }
                      }
                    : { id: `${companyId}:blocking`, companyId, status: 'available' }
            )
    const position: InitialPosition = {
        phaseId: 'I',
        stockMarket: { stacks: [] },
        bank: {},
        companies: [
            ...Corporations.map((company) => ({
                id: company.id,
                kind: 'major',
                closed: removedCorporationIds.includes(company.id),
                started: false
            })),
            ...privates.map((company) => ({
                id: company.id,
                kind: company.kind === 'independent' ? 'minor' : 'private'
            }))
        ],
        certificatePools: [{ id: 'open-market', owner: { kind: 'bank' } }],
        cash: [
            {
                owner: { kind: 'bank' },
                amount: BankSize[count] - count * (count === 2 ? 600 : 400)
            },
            ...players.map((player) => ({
                owner: { kind: 'player' as const, playerId: player.playerId },
                amount: count === 2 ? 600 : 400
            })),
            ...[...majors, ...independents].map((company) => ({
                owner: { kind: 'company' as const, companyId: company.id },
                amount: 0
            }))
        ],
        certificates,
        stations,
        stationReservations: [
            ...EighteenFortySixMap.stationReservations(),
            ...AdditionalReservations,
            ...(privates.some((company) => company.id === 'C&WI')
                ? [{ companyId: 'C&WI', locationId: 'D6', nodeId: 'city-3' }]
                : [])
        ].filter(
            (reservation) => !placedHomes.some((company) => company.id === reservation.companyId)
        ),
        tileInventory: EighteenFortySixTileSet.createInventory(),
        trainInventory: createInitialTrainInventory(count)
    }
    const draftOrder = seating.map((player) => player.playerId).toReversed()
    return {
        position,
        titleState: {
            removedCorporationIds,
            revenueMarkers: [],
            purchases: [],
            draft:
                count === 2
                    ? { kind: 'public', stage: 'buying', passedPlayerIds: [] }
                    : {
                          kind: 'hidden',
                          deck: [
                              ...privates.map((company) => company.id),
                              ...players.map((_, index) => `blank:${index + 1}`)
                          ],
                          participants: seating.map((player) => ({
                              playerId: player.playerId,
                              packet: [],
                              selections: []
                          })),
                          remainingCount: privates.length + count
                      }
        },
        begin(state) {
            state.players = seating.map((seat) => {
                const player = state.players.find(
                    (candidate) => candidate.playerId === seat.playerId
                )
                assertExists(player, 'Seated players are in the game')
                return player
            })
            state.turnManager.turnOrder = [...draftOrder]
            beginOpening(state, count === 2 ? 'BuyingOpeningCompanies' : 'Drafting', draftOrder[0])
            if (state.draft?.kind === 'hidden') {
                assertExists(state.draft.deck, 'Draft deck is required')
                shuffle(state.draft.deck, state.getProtectedPrng().random)
                dealPacket(state)
            }
        }
    }
}
