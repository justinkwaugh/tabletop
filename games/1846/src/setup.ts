import { BlockingStationLocations } from './stations.js'
import { EighteenFortySixMap, AdditionalReservations } from './map.js'
import { createInitialTrainInventory } from './trains.js'
import { EighteenFortySixTileSet } from './tiles.js'
import { createStockRound } from '@tabletop/18xx'
import {
    BaseGameInitializer,
    Color,
    Prng,
    assert,
    shuffle,
    type Game,
    type UninitializedGameState
} from '@tabletop/common'
import {
    createOrdinaryShareCertificates,
    createCompanyStations,
    type Station
} from '@tabletop/18xx'
import { BankSize, Corporations, DraftCompanies } from './catalog.js'
import {
    hydrateEighteenFortySixState,
    type HydratedEighteenFortySixState,
    type EighteenFortySixState,
    type EighteenFortySixProjectedState
} from './state.js'
import { dealPacket } from './distribution.js'

export const PlayerColors = [Color.Red, Color.Blue, Color.Green, Color.Yellow, Color.Purple]
export class Initializer extends BaseGameInitializer<
    EighteenFortySixProjectedState,
    HydratedEighteenFortySixState
> {
    initializeGameState(game: Game, base: UninitializedGameState): HydratedEighteenFortySixState {
        const count = game.players.length
        assert(count >= 2 && count <= 5, '1846 supports two through five players')
        const random = new Prng(base.prng).random
        const players = game.players.map((player, index) => ({
            playerId: player.id,
            color: PlayerColors[index]
        }))
        shuffle(players, random)
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
        const order = players.map((player) => player.playerId)
        const state = hydrateEighteenFortySixState({
            ...base,
            players,
            activePlayerIds: [order[order.length - 1]],
            machineState: count === 2 ? 'BuyingOpeningCompanies' : 'Drafting',
            phaseId: 'I',
            phaseEvents: [],
            bankruptPlayerIds: [],
            independentAcquisitions: [],
            revenueMarkers: [],
            usedPrivatePowerIds: [],
            tileInventory: EighteenFortySixTileSet.createInventory(),
            stockMarket: { stacks: [] },
            stockRound: createStockRound(1),
            turnManager: {
                series: [],
                turnOrder: order.toReversed(),
                turnCounts: Object.fromEntries(order.map((id) => [id, 0]))
            },
            removedCorporationIds,
            bank: { unlimitedAfterExhaustion: true },
            companies: [
                ...Corporations.map((company) => ({
                    id: company.id,
                    kind: 'major',
                    shareCount: 10,
                    closed: removedCorporationIds.includes(company.id),
                    started: false
                })),
                ...privates.map((company) => ({
                    id: company.id,
                    kind: company.kind === 'independent' ? 'minor' : 'private',
                    privateRevenue: company.revenue,
                    ...(company.kind === 'independent' ? { shareCount: 1 } : {})
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
                (reservation) =>
                    !placedHomes.some((company) => company.id === reservation.companyId)
            ),
            trainInventory: createInitialTrainInventory(count),
            draft:
                count === 2
                    ? { kind: 'public', stage: 'buying', passedPlayerIds: [] }
                    : {
                          kind: 'hidden',
                          deck: [
                              ...privates.map((company) => company.id),
                              ...players.map((_, index) => `blank:${index + 1}`)
                          ],
                          participants: players.map((player) => ({
                              playerId: player.playerId,
                              packet: [],
                              selections: []
                          })),
                          remainingCount: privates.length + count
                      },
            purchases: []
        })
        state.turnManager.startTurn(state.activePlayerIds[0], state.actionCount)
        if (state.draft.kind === 'hidden') {
            assert(state.draft.deck, 'Draft deck is required')
            shuffle(state.draft.deck, state.getProtectedPrng().random)
            dealPacket(state)
        }
        return state
    }
}
