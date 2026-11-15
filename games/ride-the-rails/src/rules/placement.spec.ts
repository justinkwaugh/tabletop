import { describe, expect, it } from 'vitest'
import type { HexId } from '../data/hexes.js'
import { RAILROAD_IDS } from '../data/railroads.js'
import { USA_HEXES } from '../data/usaMap.js'
import { PhaseName } from '../definition/phases.js'
import type { HydratedRideTheRailsGameState, Track } from '../model/gameState.js'
import { buildState, type StateRecipe } from '../testing/fixtures.js'
import { hasLegalPlacement, legalPlacements, placementsLeft, placementTest } from './placement.js'

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
                refused('east-coast-cities-held')
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
                refused('east-coast-cities-held')
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
