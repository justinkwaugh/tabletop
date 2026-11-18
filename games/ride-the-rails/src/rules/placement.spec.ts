import { describe, expect, it } from 'vitest'
import { hexById } from '../data/boardMaps.js'
import type { HexId } from '../data/hexes.js'
import { lowersLimit } from '../data/placementLimits.js'
import { RAILROAD_IDS } from '../data/railroads.js'
import { USA_HEXES } from '../data/usaMap.js'
import { PhaseName } from '../definition/phases.js'
import type { HydratedRideTheRailsGameState, Track } from '../model/gameState.js'
import { buildState, type StateRecipe } from '../testing/fixtures.js'
import { FLAT_FIXTURE_MAP, LONG_DISTANCE_HEX } from '../testing/flatFixtureMap.js'
import {
    groupHexesHeld,
    hasLegalPlacement,
    legalPlacements,
    longDistanceRefusal,
    placementsLeft,
    placementTest
} from './placement.js'

const NEW_YORK: HexId = 'hex.usa.6-60'
const PHILADELPHIA: HexId = 'hex.usa.7-57'
const BALTIMORE: HexId = 'hex.usa.9-55'
const CHICAGO: HexId = 'hex.usa.5-43'
const RENO: HexId = 'hex.usa.7-7'
const WEST_OF_PHILADELPHIA: HexId = 'hex.usa.7-55'
const MOUNTAIN_NEXT_TO_PHILADELPHIA: HexId = 'hex.usa.6-56'
const BETWEEN_PHILADELPHIA_AND_BALTIMORE: HexId = 'hex.usa.8-56'
const NEXT_TO_BALTIMORE: HexId = 'hex.usa.9-53'
const NEXT_TO_CHICAGO: HexId = 'hex.usa.5-41'
const BETWEEN_NEW_YORK_AND_PHILADELPHIA: HexId = 'hex.usa.6-58'

const LEGAL = { legal: true, isStart: false }

function refused(reason: string) {
    return { legal: false, reason }
}

function building(recipe: StateRecipe = {}): HydratedRideTheRailsGameState {
    return buildState({
        round: 6,
        phase: PhaseName.Build,
        shares: { p1: { 'railroad.red': 1, 'railroad.black': 1 }, p2: { 'railroad.blue': 1 } },
        track: { [PHILADELPHIA]: ['railroad.red'] },
        ...recipe
    })
}

describe('the placement test', () => {
    describe('shares (R-3.2.2)', () => {
        it('refuses a railroad the player holds no share of', () => {
            expect(placementTest(building(), 'p2', 'railroad.red', WEST_OF_PHILADELPHIA)).toEqual(
                refused('no-share')
            )
        })

        it('accepts a railroad the player holds a share of', () => {
            expect(placementTest(building(), 'p1', 'railroad.red', WEST_OF_PHILADELPHIA)).toEqual(
                LEGAL
            )
        })
    })

    describe('supply (R-1.1)', () => {
        it('refuses track from an empty supply', () => {
            const state = building({
                shares: { p1: { 'railroad.red': 20 }, p2: { 'railroad.red': 6 } }
            })
            expect(placementTest(state, 'p1', 'railroad.red', WEST_OF_PHILADELPHIA)).toEqual(
                refused('empty-supply')
            )
        })

        it('accepts the supply’s last locomotive', () => {
            const state = building({
                shares: { p1: { 'railroad.red': 20 }, p2: { 'railroad.red': 5 } }
            })
            expect(placementTest(state, 'p1', 'railroad.red', WEST_OF_PHILADELPHIA)).toEqual(LEGAL)
        })
    })

    describe('placement limit with the mountain edge (R-3.2.3, R-3.2.4)', () => {
        it('refuses a mountain with L − 1 placed and no mountain yet, and accepts a plain hex', () => {
            const state = building({ building: { placed: 7, usedMountain: false } })
            expect(
                placementTest(state, 'p1', 'railroad.red', MOUNTAIN_NEXT_TO_PHILADELPHIA)
            ).toEqual(refused('over-placement-limit'))
            expect(placementTest(state, 'p1', 'railroad.red', WEST_OF_PHILADELPHIA)).toEqual(LEGAL)
        })

        it('accepts a mountain with L − 2 placed and no mountain yet', () => {
            const state = building({ building: { placed: 6, usedMountain: false } })
            expect(
                placementTest(state, 'p1', 'railroad.red', MOUNTAIN_NEXT_TO_PHILADELPHIA)
            ).toEqual(LEGAL)
        })

        it('counts every placement against L − 1 after a mountain', () => {
            const atReducedLimit = building({ building: { placed: 7, usedMountain: true } })
            expect(
                placementTest(atReducedLimit, 'p1', 'railroad.red', WEST_OF_PHILADELPHIA)
            ).toEqual(refused('over-placement-limit'))
            const belowReducedLimit = building({ building: { placed: 6, usedMountain: true } })
            expect(
                placementTest(belowReducedLimit, 'p1', 'railroad.red', WEST_OF_PHILADELPHIA)
            ).toEqual(LEGAL)
        })

        it('refuses any placement at the limit', () => {
            const state = building({ building: { placed: 8, usedMountain: false } })
            expect(placementTest(state, 'p1', 'railroad.red', WEST_OF_PHILADELPHIA)).toEqual(
                refused('over-placement-limit')
            )
        })

        it('uses the player count’s limit: 4 for five players', () => {
            const state = building({
                playerCount: 5,
                building: { placed: 3, usedMountain: false }
            })
            expect(
                placementTest(state, 'p1', 'railroad.red', MOUNTAIN_NEXT_TO_PHILADELPHIA)
            ).toEqual(refused('over-placement-limit'))
            expect(placementTest(state, 'p1', 'railroad.red', WEST_OF_PHILADELPHIA)).toEqual(LEGAL)
        })

        it('tells how many placements the turn has left', () => {
            expect(placementsLeft(building({ building: { placed: 2, usedMountain: false } }))).toBe(
                6
            )
            expect(placementsLeft(building({ building: { placed: 2, usedMountain: true } }))).toBe(
                5
            )
        })
    })

    describe('one per railroad (R-4.1.3)', () => {
        it('refuses a second locomotive of a railroad in one hex', () => {
            const state = building({
                track: {
                    [PHILADELPHIA]: ['railroad.red'],
                    [WEST_OF_PHILADELPHIA]: ['railroad.red']
                }
            })
            expect(placementTest(state, 'p1', 'railroad.red', WEST_OF_PHILADELPHIA)).toEqual(
                refused('railroad-in-hex')
            )
        })

        it('refuses a second Black locomotive in Chicago, which has no capacity limit', () => {
            const state = building({ track: { [CHICAGO]: ['railroad.black'] } })
            expect(placementTest(state, 'p1', 'railroad.black', CHICAGO)).toEqual(
                refused('railroad-in-hex')
            )
        })
    })

    describe('capacity (R-4.1.4)', () => {
        it('refuses a third locomotive in a plain hex and accepts a second', () => {
            const full = building({
                track: {
                    [PHILADELPHIA]: ['railroad.red'],
                    [WEST_OF_PHILADELPHIA]: ['railroad.blue', 'railroad.orange']
                }
            })
            expect(placementTest(full, 'p1', 'railroad.red', WEST_OF_PHILADELPHIA)).toEqual(
                refused('hex-at-capacity')
            )
            const half = building({
                track: {
                    [PHILADELPHIA]: ['railroad.red'],
                    [WEST_OF_PHILADELPHIA]: ['railroad.blue']
                }
            })
            expect(placementTest(half, 'p1', 'railroad.red', WEST_OF_PHILADELPHIA)).toEqual(LEGAL)
        })

        it('refuses a second locomotive in an East Coast city and accepts the first', () => {
            const redTrack: Track = {
                [PHILADELPHIA]: ['railroad.red'],
                [BETWEEN_NEW_YORK_AND_PHILADELPHIA]: ['railroad.red']
            }
            const taken = building({ track: { ...redTrack, [NEW_YORK]: ['railroad.blue'] } })
            expect(placementTest(taken, 'p1', 'railroad.red', NEW_YORK)).toEqual(
                refused('hex-at-capacity')
            )
            expect(
                placementTest(building({ track: redTrack }), 'p1', 'railroad.red', NEW_YORK)
            ).toEqual(LEGAL)
        })

        it('accepts any number in Chicago', () => {
            const state = building({
                track: {
                    [PHILADELPHIA]: ['railroad.red'],
                    [NEXT_TO_CHICAGO]: ['railroad.red'],
                    [CHICAGO]: [
                        'railroad.blue',
                        'railroad.orange',
                        'railroad.yellow',
                        'railroad.purple',
                        'railroad.black'
                    ]
                }
            })
            expect(placementTest(state, 'p1', 'railroad.red', CHICAGO)).toEqual(LEGAL)
        })
    })

    describe('at most two East Coast cities, a start counted (R-4.1.4, R-4.2.5)', () => {
        it('refuses a railroad a third East Coast city', () => {
            const state = building({
                track: {
                    [NEW_YORK]: ['railroad.red'],
                    [PHILADELPHIA]: ['railroad.red'],
                    [BETWEEN_PHILADELPHIA_AND_BALTIMORE]: ['railroad.red']
                }
            })
            expect(placementTest(state, 'p1', 'railroad.red', BALTIMORE)).toEqual(
                refused('group-limit-reached')
            )
        })

        it('accepts a second East Coast city', () => {
            const state = building({
                track: {
                    [PHILADELPHIA]: ['railroad.red'],
                    [BETWEEN_PHILADELPHIA_AND_BALTIMORE]: ['railroad.red']
                }
            })
            expect(placementTest(state, 'p1', 'railroad.red', BALTIMORE)).toEqual(LEGAL)
        })

        it('counts Black’s East Coast start among its two', () => {
            const state = building({
                track: {
                    [NEW_YORK]: ['railroad.black'],
                    [PHILADELPHIA]: ['railroad.black'],
                    [BETWEEN_PHILADELPHIA_AND_BALTIMORE]: ['railroad.black']
                }
            })
            expect(placementTest(state, 'p1', 'railroad.black', BALTIMORE)).toEqual(
                refused('group-limit-reached')
            )
        })

        it('counts a start as the first of the two', () => {
            const state = building({
                track: {
                    [PHILADELPHIA]: ['railroad.black'],
                    [BETWEEN_NEW_YORK_AND_PHILADELPHIA]: ['railroad.black']
                }
            })
            expect(placementTest(state, 'p1', 'railroad.black', NEW_YORK)).toEqual(LEGAL)
        })
    })

    describe('adjacency or start (R-4.1.1, R-4.1.2)', () => {
        it('refuses a hex not adjacent to the railroad’s track once it has started', () => {
            expect(placementTest(building(), 'p1', 'railroad.red', NEXT_TO_BALTIMORE)).toEqual(
                refused('not-adjacent-or-start')
            )
        })

        it('accepts a hex adjacent to the railroad’s track', () => {
            expect(
                placementTest(building(), 'p1', 'railroad.red', BETWEEN_PHILADELPHIA_AND_BALTIMORE)
            ).toEqual(LEGAL)
        })

        it('accepts a start in a start city and refuses one elsewhere', () => {
            expect(placementTest(building(), 'p1', 'railroad.black', RENO)).toEqual({
                legal: true,
                isStart: true
            })
            expect(placementTest(building(), 'p1', 'railroad.black', NEXT_TO_BALTIMORE)).toEqual(
                refused('not-adjacent-or-start')
            )
        })

        it('is not adjacent to another railroad’s track', () => {
            const state = building({
                track: { [PHILADELPHIA]: ['railroad.red'], [NEXT_TO_BALTIMORE]: ['railroad.blue'] }
            })
            expect(placementTest(state, 'p1', 'railroad.red', BALTIMORE)).toEqual(
                refused('not-adjacent-or-start')
            )
        })
    })

    it('reports the first clause that fails', () => {
        const state = building({
            shares: { p1: { 'railroad.red': 20 }, p2: { 'railroad.red': 6 } },
            building: { placed: 8, usedMountain: false }
        })
        expect(placementTest(state, 'p1', 'railroad.red', PHILADELPHIA)).toEqual(
            refused('empty-supply')
        )
    })
})

const ALL_SHARES = {
    'railroad.red': 2,
    'railroad.blue': 1,
    'railroad.orange': 1,
    'railroad.yellow': 1,
    'railroad.purple': 1,
    'railroad.black': 1
}

const PROPERTY_FIXTURES: Record<string, StateRecipe> = {
    'an empty board in round 1': {
        round: 1,
        phase: PhaseName.Build,
        shares: { p1: { 'railroad.red': 1, 'railroad.blue': 1 } }
    },
    'Yellow yet to start in round 3': {
        round: 3,
        phase: PhaseName.Build,
        shares: { p1: ALL_SHARES },
        track: {
            [NEW_YORK]: ['railroad.red'],
            [PHILADELPHIA]: ['railroad.blue'],
            [WEST_OF_PHILADELPHIA]: ['railroad.blue', 'railroad.red'],
            [CHICAGO]: ['railroad.orange'],
            'hex.usa.8-38': ['railroad.orange']
        },
        building: { placed: 3, usedMountain: true }
    },
    'Yellow started, Black unstarted, in round 5': {
        playerCount: 4,
        round: 5,
        phase: PhaseName.Build,
        shares: { p1: ALL_SHARES },
        track: {
            [NEW_YORK]: ['railroad.red'],
            [BALTIMORE]: ['railroad.blue'],
            [CHICAGO]: ['railroad.orange', 'railroad.yellow'],
            [NEXT_TO_CHICAGO]: ['railroad.yellow'],
            [RENO]: ['railroad.purple'],
            'hex.usa.9-5': ['railroad.purple'],
            'hex.usa.8-6': ['railroad.purple']
        }
    },
    'one placement left before the mountain limit': {
        playerCount: 5,
        round: 4,
        phase: PhaseName.Build,
        shares: { p1: ALL_SHARES },
        track: {
            [PHILADELPHIA]: ['railroad.red'],
            [MOUNTAIN_NEXT_TO_PHILADELPHIA]: ['railroad.blue'],
            [NEW_YORK]: ['railroad.blue']
        },
        building: { placed: 3, usedMountain: false }
    },
    'a railroad with an empty supply': {
        round: 2,
        phase: PhaseName.Build,
        shares: { p1: { 'railroad.red': 25, 'railroad.orange': 1 } },
        track: {
            [PHILADELPHIA]: ['railroad.red'],
            [BETWEEN_PHILADELPHIA_AND_BALTIMORE]: ['railroad.red']
        }
    }
}

describe('legal placements (R-3.2, R-4.1, R-4.2)', () => {
    it.each(Object.entries(PROPERTY_FIXTURES))(
        'agree with the placement test on every hex for every railroad: %s',
        (_name, recipe) => {
            const state = buildState(recipe)
            const expected = RAILROAD_IDS.flatMap((railroadId) =>
                USA_HEXES.flatMap((hex) => {
                    const verdict = placementTest(state, 'p1', railroadId, hex.id)
                    return verdict.legal
                        ? [{ railroadId, hexId: hex.id, isStart: verdict.isStart }]
                        : []
                })
            )
            expect(legalPlacements(state, 'p1')).toEqual(expected)
        }
    )

    it.each([
        ...Object.entries(PROPERTY_FIXTURES),
        ['no shares', { round: 2, phase: PhaseName.Build }],
        [
            'the placement limit reached',
            {
                phase: PhaseName.Build,
                shares: { p1: ALL_SHARES },
                building: { placed: 8, usedMountain: false }
            }
        ]
    ] satisfies [string, StateRecipe][])(
        'R-3.2.1: finds whether any placement is legal: %s',
        (_name, recipe) => {
            const state = buildState(recipe)
            expect(hasLegalPlacement(state, 'p1')).toBe(legalPlacements(state, 'p1').length > 0)
        }
    )

    it('offers Red and Blue the six East Coast cities as starts on an empty board', () => {
        const placements = legalPlacements(
            buildState(PROPERTY_FIXTURES['an empty board in round 1']),
            'p1'
        )
        const eastCoast = [
            'hex.usa.6-60',
            'hex.usa.7-57',
            'hex.usa.9-55',
            'hex.usa.11-55',
            'hex.usa.12-52',
            'hex.usa.14-50'
        ].sort()
        expect(placements.every((placement) => placement.isStart)).toBe(true)
        for (const railroadId of ['railroad.red', 'railroad.blue'] as const) {
            expect(
                placements
                    .filter((placement) => placement.railroadId === railroadId)
                    .map((placement) => placement.hexId)
                    .sort()
            ).toEqual(eastCoast)
        }
        expect(placements).toHaveLength(12)
    })

    it('offers no mountain when one placement is left before the mountain limit', () => {
        const placements = legalPlacements(
            buildState(PROPERTY_FIXTURES['one placement left before the mountain limit']),
            'p1'
        )
        const mountains = new Set(
            USA_HEXES.filter((hex) => hex.terrain === 'mountain').map((hex) => hex.id)
        )
        expect(placements.length).toBeGreaterThan(0)
        expect(placements.some((placement) => mountains.has(placement.hexId))).toBe(false)
    })

    it('offers nothing of a railroad whose supply is empty', () => {
        const placements = legalPlacements(
            buildState(PROPERTY_FIXTURES['a railroad with an empty supply']),
            'p1'
        )
        expect(placements.some((placement) => placement.railroadId === 'railroad.red')).toBe(false)
        expect(placements.some((placement) => placement.railroadId === 'railroad.orange')).toBe(
            true
        )
    })
})

describe('long-distance hexes (R-8, Australia)', () => {
    const longDistance = FLAT_FIXTURE_MAP.isLongDistance(LONG_DISTANCE_HEX)
    const plain = FLAT_FIXTURE_MAP.isLongDistance('hex.usa.0-0')

    it('takes a long-distance hex only as the turn’s first placement', () => {
        expect(longDistanceRefusal({ placed: 0, usedMountain: false }, longDistance)).toBe(
            undefined
        )
        expect(longDistanceRefusal({ placed: 1, usedMountain: false }, longDistance)).toBe(
            'long-distance-not-first'
        )
        expect(longDistanceRefusal({ placed: 1, usedMountain: false }, plain)).toBe(undefined)
    })

    it('refuses every placement once the turn has made a long-distance one', () => {
        const after = { placed: 1, usedMountain: false, usedLongDistance: true } as const
        expect(longDistanceRefusal(after, plain)).toBe('long-distance-ended-turn')
        expect(longDistanceRefusal(after, longDistance)).toBe('long-distance-ended-turn')
    })

    it('refuses a placement in the placement test once the turn is so ended', () => {
        const state = building({
            shares: { p1: { 'railroad.red': 1 } },
            track: { [NEW_YORK]: ['railroad.red'] },
            building: { placed: 1, usedMountain: false, usedLongDistance: true }
        })
        expect(
            placementTest(state, 'p1', 'railroad.red', BETWEEN_NEW_YORK_AND_PHILADELPHIA)
        ).toEqual(refused('long-distance-ended-turn'))
        expect(hasLegalPlacement(state, 'p1')).toBe(false)
    })
})

describe('group limits (R-4.1.4, R-8)', () => {
    it('counts the hexes of a group that hold the railroad', () => {
        const track: Track = {
            [NEW_YORK]: ['railroad.red'],
            [PHILADELPHIA]: ['railroad.blue'],
            [BALTIMORE]: ['railroad.red'],
            [CHICAGO]: ['railroad.red']
        }
        expect(groupHexesHeld(track, 'railroad.red', 'east-coast')).toBe(2)
        expect(groupHexesHeld(track, 'railroad.blue', 'east-coast')).toBe(1)
        expect(groupHexesHeld(track, 'railroad.blue', 'west-coast')).toBe(0)
    })
})

describe('Australia (R-8.2)', () => {
    const SYDNEY: HexId = 'hex.au.31-15'
    const MOUNTAIN_NEXT_TO_SYDNEY: HexId = 'hex.au.31-13'
    const WEST_OF_SYDNEY: HexId = 'hex.au.30-14'
    const ADELAIDE: HexId = 'hex.au.4-14'
    const LONG_DISTANCE_NEXT_TO_ADELAIDE: HexId = 'hex.au.3-13'
    const EAST_OF_ADELAIDE: HexId = 'hex.au.5-13'
    const MELBOURNE: HexId = 'hex.au.17-29'
    const MOUNTAIN_NEXT_TO_MELBOURNE: HexId = 'hex.au.18-28'
    const ALPS_NEXT_TO_THAT_MOUNTAIN: HexId = 'hex.au.19-27'

    function australia(recipe: StateRecipe = {}): HydratedRideTheRailsGameState {
        return building({
            mapId: 'map.au',
            shares: { p1: { 'railroad.red': 1, 'railroad.blue': 1, 'railroad.orange': 1 } },
            track: {
                [SYDNEY]: ['railroad.red'],
                [ADELAIDE]: ['railroad.orange'],
                [MELBOURNE]: ['railroad.blue'],
                [MOUNTAIN_NEXT_TO_MELBOURNE]: ['railroad.blue']
            },
            ...recipe
        })
    }

    it('allows 8, 5 and 4 placements for 3, 4 and 5 players', () => {
        expect([3, 4, 5].map((playerCount) => placementsLeft(australia({ playerCount })))).toEqual([
            8, 5, 4
        ])
    })

    it('lowers the limit by two for a mountain placement: a mountain is refused with 7 placed of 8, and taken with 6', () => {
        const seventh = australia({ building: { placed: 6, usedMountain: false } })
        expect(placementTest(seventh, 'p1', 'railroad.red', MOUNTAIN_NEXT_TO_SYDNEY)).toEqual(
            refused('over-placement-limit')
        )
        expect(placementTest(seventh, 'p1', 'railroad.red', WEST_OF_SYDNEY)).toEqual(LEGAL)
        const sixth = australia({ building: { placed: 5, usedMountain: false } })
        expect(placementTest(sixth, 'p1', 'railroad.red', MOUNTAIN_NEXT_TO_SYDNEY)).toEqual(LEGAL)
    })

    it('lowers it once, however many mountain placements the turn holds', () => {
        const state = australia({ building: { placed: 5, usedMountain: true } })
        expect(placementsLeft(state)).toBe(1)
        expect(placementTest(state, 'p1', 'railroad.red', MOUNTAIN_NEXT_TO_SYDNEY)).toEqual(LEGAL)
    })

    it('takes a long-distance hex as the turn’s first placement only', () => {
        expect(
            placementTest(australia(), 'p1', 'railroad.orange', LONG_DISTANCE_NEXT_TO_ADELAIDE)
        ).toEqual(LEGAL)
        const later = australia({ building: { placed: 1, usedMountain: false } })
        expect(
            placementTest(later, 'p1', 'railroad.orange', LONG_DISTANCE_NEXT_TO_ADELAIDE)
        ).toEqual(refused('long-distance-not-first'))
        expect(placementTest(later, 'p1', 'railroad.orange', EAST_OF_ADELAIDE)).toEqual(LEGAL)
    })

    it('takes nothing more once the turn has made a long-distance placement', () => {
        const state = australia({
            track: {
                [ADELAIDE]: ['railroad.orange'],
                [LONG_DISTANCE_NEXT_TO_ADELAIDE]: ['railroad.orange']
            },
            building: { placed: 1, usedMountain: false, usedLongDistance: true }
        })
        expect(placementTest(state, 'p1', 'railroad.orange', EAST_OF_ADELAIDE)).toEqual(
            refused('long-distance-ended-turn')
        )
        expect(hasLegalPlacement(state, 'p1')).toBe(false)
    })

    describe('Perth and Brisbane, the long-distance cities', () => {
        const PERTH: HexId = 'hex.au.0-12'
        const PERTH_CHAIN_END: HexId = 'hex.au.1-13'
        const BRISBANE: HexId = 'hex.au.34-6'
        const BRISBANE_CHAIN_END: HexId = 'hex.au.34-8'
        const chainEnds = (recipe: StateRecipe = {}) =>
            australia({
                track: {
                    [SYDNEY]: ['railroad.red'],
                    [ADELAIDE]: ['railroad.orange'],
                    [PERTH_CHAIN_END]: ['railroad.orange'],
                    [BRISBANE_CHAIN_END]: ['railroad.red']
                },
                ...recipe
            })

        it('takes a placement in Perth or Brisbane as the turn’s first', () => {
            expect(placementTest(chainEnds(), 'p1', 'railroad.orange', PERTH)).toEqual(LEGAL)
            expect(placementTest(chainEnds(), 'p1', 'railroad.red', BRISBANE)).toEqual(LEGAL)
        })

        it('refuses a placement in Perth or Brisbane after another placement that turn', () => {
            const later = chainEnds({ building: { placed: 1, usedMountain: false } })
            expect(placementTest(later, 'p1', 'railroad.orange', PERTH)).toEqual(
                refused('long-distance-not-first')
            )
            expect(placementTest(later, 'p1', 'railroad.red', BRISBANE)).toEqual(
                refused('long-distance-not-first')
            )
            const offered = legalPlacements(later, 'p1').map((placement) => placement.hexId)
            expect(offered).not.toContain(PERTH)
            expect(offered).not.toContain(BRISBANE)
            expect(offered.length).toBeGreaterThan(0)
        })
    })

    it('never takes a locomotive in the Alps', () => {
        const state = australia()
        expect(hexById(ALPS_NEXT_TO_THAT_MOUNTAIN).terrain).toBe('alps')
        expect(placementTest(state, 'p1', 'railroad.blue', ALPS_NEXT_TO_THAT_MOUNTAIN)).toEqual(
            refused('hex-at-capacity')
        )
        expect(
            legalPlacements(state, 'p1').filter(({ hexId }) => hexById(hexId).terrain === 'alps')
        ).toEqual([])
    })

    it('holds one locomotive in a long-distance hex', () => {
        const state = australia({
            shares: { p1: { 'railroad.orange': 1, 'railroad.black': 1 } },
            track: {
                [ADELAIDE]: ['railroad.orange', 'railroad.black'],
                [LONG_DISTANCE_NEXT_TO_ADELAIDE]: ['railroad.black']
            }
        })
        expect(
            placementTest(state, 'p1', 'railroad.orange', LONG_DISTANCE_NEXT_TO_ADELAIDE)
        ).toEqual(refused('hex-at-capacity'))
    })
})

describe('Canada (R-8.3)', () => {
    const MONTREAL: HexId = 'hex.ca.24-10'
    const SOUTH_OF_MONTREAL: HexId = 'hex.ca.24-12'
    const SOUTH_EAST_OF_MONTREAL: HexId = 'hex.ca.25-11'
    const NORTH_EAST_OF_HAMILTON: HexId = 'hex.ca.10-22'
    const SOUTH_EAST_OF_HAMILTON: HexId = 'hex.ca.10-24'
    const TORONTO: HexId = 'hex.ca.11-21'

    function canada(recipe: StateRecipe = {}): HydratedRideTheRailsGameState {
        return building({
            mapId: 'map.ca',
            shares: { p1: { 'railroad.red': 1, 'railroad.black': 1 } },
            track: { [MONTREAL]: ['railroad.red'] },
            ...recipe
        })
    }

    it('allows 7, 5 and 4 placements for 3, 4 and 5 players', () => {
        expect([3, 4, 5].map((playerCount) => placementsLeft(canada({ playerCount })))).toEqual([
            7, 5, 4
        ])
        const seventh = canada({ building: { placed: 6, usedMountain: false } })
        expect(placementTest(seventh, 'p1', 'railroad.red', SOUTH_EAST_OF_MONTREAL)).toEqual(LEGAL)
        const eighth = canada({ building: { placed: 7, usedMountain: false } })
        expect(placementTest(eighth, 'p1', 'railroad.red', SOUTH_EAST_OF_MONTREAL)).toEqual(
            refused('over-placement-limit')
        )
    })

    it('builds no track across an impassable side', () => {
        const state = canada()
        expect(placementTest(state, 'p1', 'railroad.red', SOUTH_OF_MONTREAL)).toEqual(
            refused('not-adjacent-or-start')
        )
        expect(placementTest(state, 'p1', 'railroad.red', SOUTH_EAST_OF_MONTREAL)).toEqual(LEGAL)
        const nearHamilton = canada({ track: { [NORTH_EAST_OF_HAMILTON]: ['railroad.red'] } })
        expect(placementTest(nearHamilton, 'p1', 'railroad.red', SOUTH_EAST_OF_HAMILTON)).toEqual(
            refused('not-adjacent-or-start')
        )
        expect(
            legalPlacements(state, 'p1').filter(
                ({ railroadId, hexId }) =>
                    railroadId === 'railroad.red' && hexId === SOUTH_OF_MONTREAL
            )
        ).toEqual([])
    })

    it('takes any number of railroads in Toronto, one locomotive of each', () => {
        const state = canada({
            shares: { p1: { 'railroad.black': 1, 'railroad.red': 1 } },
            track: {
                [TORONTO]: [
                    'railroad.purple',
                    'railroad.blue',
                    'railroad.orange',
                    'railroad.black'
                ],
                'hex.ca.11-19': ['railroad.red']
            }
        })
        expect(placementTest(state, 'p1', 'railroad.red', TORONTO)).toEqual(LEGAL)
        expect(placementTest(state, 'p1', 'railroad.black', 'hex.ca.10-20')).toEqual(LEGAL)
        const again = canada({
            shares: { p1: { 'railroad.black': 1 } },
            track: { [TORONTO]: ['railroad.black'], 'hex.ca.10-20': ['railroad.black'] }
        })
        expect(placementTest(again, 'p1', 'railroad.black', TORONTO)).toEqual(
            refused('railroad-in-hex')
        )
    })
})

describe('France (R-8.4)', () => {
    const LILLE: HexId = 'hex.fr.15-1'
    const VALENCIENNES: HexId = 'hex.fr.17-3'
    const SEDAN: HexId = 'hex.fr.19-7'
    const PARIS: HexId = 'hex.fr.13-13'
    const NORTH_OF_PARIS: HexId = 'hex.fr.13-11'
    const NORTH_WEST_OF_PARIS: HexId = 'hex.fr.12-12'
    const LE_HAVRE: HexId = 'hex.fr.8-6'
    const CAEN: HexId = 'hex.fr.8-8'
    const SOUTH_EAST_OF_LE_HAVRE: HexId = 'hex.fr.9-7'

    function france(recipe: StateRecipe = {}): HydratedRideTheRailsGameState {
        return building({
            mapId: 'map.fr',
            shares: {
                p1: {
                    'railroad.red': 1,
                    'railroad.blue': 1,
                    'railroad.orange': 1,
                    'railroad.purple': 1,
                    'railroad.black': 1
                }
            },
            track: {},
            ...recipe
        })
    }

    it('allows 8, 5 and 4 placements for 3, 4 and 5 players, one fewer once a mountain is used', () => {
        expect([3, 4, 5].map((playerCount) => placementsLeft(france({ playerCount })))).toEqual([
            8, 5, 4
        ])
        expect(placementsLeft(france({ building: { placed: 0, usedMountain: true } }))).toBe(7)
    })

    it('lets a railroad hold at most two of the Red/Blue/Black cities, a start counted', () => {
        const state = france({
            track: { [LILLE]: ['railroad.red'], [VALENCIENNES]: ['railroad.red'] }
        })
        expect(groupHexesHeld(state.track, 'railroad.red', 'red-blue-black')).toBe(2)
        expect(placementTest(state, 'p1', 'railroad.red', SEDAN)).toEqual(
            refused('group-limit-reached')
        )
        expect(placementTest(state, 'p1', 'railroad.blue', SEDAN)).toEqual({
            legal: true,
            isStart: true
        })
    })

    it('holds one locomotive in each Red/Blue/Black city', () => {
        const state = france({ track: { [LILLE]: ['railroad.red'] } })
        expect(placementTest(state, 'p1', 'railroad.blue', LILLE)).toEqual(
            refused('hex-at-capacity')
        )
    })

    it('lets a railroad hold only one of the Paris entry hexes, each holding one locomotive', () => {
        const state = france({ track: { [PARIS]: ['railroad.purple', 'railroad.black'] } })
        expect(placementTest(state, 'p1', 'railroad.purple', NORTH_OF_PARIS)).toEqual(LEGAL)
        const entered = france({
            track: {
                [PARIS]: ['railroad.purple', 'railroad.black'],
                [NORTH_OF_PARIS]: ['railroad.purple']
            }
        })
        expect(groupHexesHeld(entered.track, 'railroad.purple', 'paris-entry')).toBe(1)
        expect(placementTest(entered, 'p1', 'railroad.purple', NORTH_WEST_OF_PARIS)).toEqual(
            refused('group-limit-reached')
        )
        expect(placementTest(entered, 'p1', 'railroad.black', NORTH_OF_PARIS)).toEqual(
            refused('hex-at-capacity')
        )
        expect(placementTest(entered, 'p1', 'railroad.black', NORTH_WEST_OF_PARIS)).toEqual(LEGAL)
    })

    it('builds no track across an estuary', () => {
        const state = france({ track: { [LE_HAVRE]: ['railroad.orange'] } })
        expect(placementTest(state, 'p1', 'railroad.orange', CAEN)).toEqual(
            refused('not-adjacent-or-start')
        )
        expect(placementTest(state, 'p1', 'railroad.orange', SOUTH_EAST_OF_LE_HAVRE)).toEqual(LEGAL)
    })
})

describe('Germany (R-8.5)', () => {
    const STUTTGART: HexId = 'hex.de.8-46'
    const MOUNTAIN_NORTH_OF_STUTTGART: HexId = 'hex.de.8-44'
    const PLAIN_SOUTH_OF_STUTTGART: HexId = 'hex.de.8-48'
    const BERLIN: HexId = 'hex.de.19-17'
    const NORTH_OF_BERLIN: HexId = 'hex.de.19-15'
    const SOUTH_EAST_OF_BERLIN: HexId = 'hex.de.21-19'

    function germany(recipe: StateRecipe = {}): HydratedRideTheRailsGameState {
        return building({
            mapId: 'map.de',
            shares: { p1: { 'railroad.red': 1, 'railroad.orange': 1, 'railroad.black': 1 } },
            track: { [STUTTGART]: ['railroad.orange', 'railroad.red'] },
            ...recipe
        })
    }

    it('allows 8, 5 and 4 placements for 3, 4 and 5 players, one fewer once a mountain is used', () => {
        expect([3, 4, 5].map((playerCount) => placementsLeft(germany({ playerCount })))).toEqual([
            8, 5, 4
        ])
        expect(placementsLeft(germany({ building: { placed: 0, usedMountain: true } }))).toBe(7)
    })

    it('lets Orange take a mountain as its eighth placement, which lowers the limit for no one else', () => {
        const eighth = germany({ building: { placed: 7, usedMountain: false } })
        expect(placementTest(eighth, 'p1', 'railroad.orange', MOUNTAIN_NORTH_OF_STUTTGART)).toEqual(
            LEGAL
        )
        expect(placementTest(eighth, 'p1', 'railroad.red', MOUNTAIN_NORTH_OF_STUTTGART)).toEqual(
            refused('over-placement-limit')
        )
        expect(placementTest(eighth, 'p1', 'railroad.red', PLAIN_SOUTH_OF_STUTTGART)).toEqual(LEGAL)
    })

    it('reports no mountain charge for an Orange placement, and one for any other railroad', () => {
        expect(lowersLimit('map.de', 'railroad.orange', MOUNTAIN_NORTH_OF_STUTTGART)).toBe(false)
        expect(lowersLimit('map.de', 'railroad.red', MOUNTAIN_NORTH_OF_STUTTGART)).toBe(true)
        expect(lowersLimit('map.de', 'railroad.black', MOUNTAIN_NORTH_OF_STUTTGART)).toBe(true)
        expect(lowersLimit('map.de', 'railroad.red', PLAIN_SOUTH_OF_STUTTGART)).toBe(false)
    })

    it('takes any number of railroads in Berlin, one locomotive of each, from beside either cell', () => {
        const state = germany({
            track: {
                [BERLIN]: ['railroad.purple', 'railroad.blue', 'railroad.orange'],
                [NORTH_OF_BERLIN]: ['railroad.red'],
                [SOUTH_EAST_OF_BERLIN]: ['railroad.black']
            }
        })
        expect(placementTest(state, 'p1', 'railroad.red', BERLIN)).toEqual(LEGAL)
        expect(placementTest(state, 'p1', 'railroad.black', BERLIN)).toEqual(LEGAL)
        expect(placementTest(state, 'p1', 'railroad.orange', BERLIN)).toEqual(
            refused('railroad-in-hex')
        )
    })
})
