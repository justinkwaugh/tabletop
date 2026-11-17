import { describe, expect, it } from 'vitest'
import { Value } from 'typebox/value'
import {
    LOCOMOTIVES_PER_RAILROAD,
    RAILROAD_IDS,
    RAILROAD_INTRODUCTIONS,
    RAILROADS,
    RailroadId
} from './railroads.js'
import {
    chargesMountain,
    GROUP_LIMITS,
    lowersLimit,
    PLACEMENT_LIMITS,
    placementLimit,
    type MapPlacementLimits
} from './placementLimits.js'
import { BONUS_RULES } from '../rules/bonuses.js'
import { ROUND_END_PASSENGER_CITY } from '../rules/endOfRound.js'
import { ALPHA_HEX, FLAT_FIXTURE_MAP, MOUNTAIN_HEX } from '../testing/flatFixtureMap.js'
import { BOARD_MAPS } from './boardMaps.js'
import { MAP_DETAILS, MAP_IDS, MAP_KEY_OF } from './maps.js'
import { BONUSES, CHICAGO_BONUS, FIVE_DOLLAR_BONUS, TRANSCONTINENTAL_BONUS } from './bonuses.js'

function duplicatesOf(ids: readonly string[]): string[] {
    return ids.filter((id, index) => ids.indexOf(id) !== index)
}

describe('railroads (R-1.1, R-1.4)', () => {
    it('lists the six railroads in availability order (R-1.4)', () => {
        expect(RAILROADS.map((railroad) => [railroad.id, railroad.printedName])).toEqual([
            ['railroad.red', 'Red'],
            ['railroad.blue', 'Blue'],
            ['railroad.orange', 'Orange'],
            ['railroad.yellow', 'Yellow'],
            ['railroad.purple', 'Purple'],
            ['railroad.black', 'Black']
        ])
        expect(RAILROADS.map((railroad) => railroad.id)).toEqual(RAILROAD_IDS)
    })

    it('has no duplicate railroad id', () => {
        expect(duplicatesOf(RAILROADS.map((railroad) => railroad.id))).toEqual([])
    })

    it('gives each railroad 27 locomotives, 162 in all (R-1.1)', () => {
        expect(LOCOMOTIVES_PER_RAILROAD).toBe(27)
        for (const railroad of RAILROADS) {
            expect(railroad.locomotives).toBe(27)
        }
        expect(RAILROADS.reduce((total, railroad) => total + railroad.locomotives, 0)).toBe(162)
    })

    it('validates railroad ids with its schema', () => {
        for (const id of RAILROAD_IDS) {
            expect(Value.Check(RailroadId, id)).toBe(true)
        }
        expect(Value.Check(RailroadId, 'railroad.green')).toBe(false)
    })

    it('introduces the railroads on the USA map by round with their start rules (R-1.4, R-4.2)', () => {
        expect(RAILROAD_INTRODUCTIONS['map.usa']).toEqual([
            { railroadId: 'railroad.red', availableFromRound: 1, startRule: 'east-coast-apart' },
            { railroadId: 'railroad.blue', availableFromRound: 1, startRule: 'east-coast-apart' },
            {
                railroadId: 'railroad.orange',
                availableFromRound: 2,
                startRule: 'east-coast-or-chicago'
            },
            {
                railroadId: 'railroad.yellow',
                availableFromRound: 3,
                startRule: 'chicago-or-westernmost'
            },
            { railroadId: 'railroad.purple', availableFromRound: 4, startRule: 'west-coast' },
            { railroadId: 'railroad.black', availableFromRound: 5, startRule: 'any-city' }
        ])
    })

    it('introduces each railroad once per map, in railroad order (R-1.4, R-8)', () => {
        for (const introductions of Object.values(RAILROAD_INTRODUCTIONS)) {
            expect(introductions.map((introduction) => introduction.railroadId)).toEqual(
                RAILROAD_IDS
            )
        }
    })
})

describe('placement limits (R-3.2.3, R-3.2.4)', () => {
    it('prints 8 / 5 / 4 for 3 / 4 / 5 players on the USA map, mountain −1', () => {
        expect(PLACEMENT_LIMITS['map.usa']).toEqual({
            byPlayerCount: [
                { playerCount: 3, limit: 8 },
                { playerCount: 4, limit: 5 },
                { playerCount: 5, limit: 4 }
            ],
            mountainReduction: 1
        })
    })

    it('reads the limit without a mountain placement (R-3.2.3)', () => {
        expect(placementLimit('map.usa', 3, false)).toBe(8)
        expect(placementLimit('map.usa', 4, false)).toBe(5)
        expect(placementLimit('map.usa', 5, false)).toBe(4)
    })

    it('reduces the limit by one once a mountain placement is made (R-3.2.4)', () => {
        expect(placementLimit('map.usa', 3, true)).toBe(7)
        expect(placementLimit('map.usa', 4, true)).toBe(4)
        expect(placementLimit('map.usa', 5, true)).toBe(3)
    })

    it('has one row per player count on every map (R-1.2, R-8)', () => {
        for (const limits of Object.values(PLACEMENT_LIMITS)) {
            expect(limits.byPlayerCount.map((row) => row.playerCount)).toEqual([3, 4, 5])
        }
    })

    it('has no limit for a player count the game does not seat (R-1.2)', () => {
        expect(() => placementLimit('map.usa', 2, false)).toThrow()
    })
})

describe('bonuses (R-4.3)', () => {
    it('pays $2 for each placement in Chicago (R-4.3.1)', () => {
        expect(CHICAGO_BONUS).toEqual({
            id: 'bonus.usa.chicago',
            printedName: 'Chicago',
            amount: 2
        })
    })

    it('pays $5 for a $5 city (R-4.3.2)', () => {
        expect(FIVE_DOLLAR_BONUS).toEqual({
            id: 'bonus.usa.five-dollar',
            printedName: '$5 cities',
            amount: 5
        })
    })

    it('prices the Transcontinental at $12 in a city hex and $8 elsewhere (R-4.3.3)', () => {
        expect(TRANSCONTINENTAL_BONUS).toEqual({
            id: 'bonus.usa.transcontinental',
            printedName: 'Transcontinental',
            cityHexAmount: 12,
            otherHexAmount: 8
        })
    })

    it('lists the three USA bonuses for the USA map (R-4.3, R-8)', () => {
        expect(BONUSES['map.usa'].map((bonus) => bonus.id)).toEqual([
            'bonus.usa.chicago',
            'bonus.usa.five-dollar',
            'bonus.usa.transcontinental'
        ])
    })

    it('has no duplicate bonus id across the maps', () => {
        const ids = Object.values(BONUSES).flatMap((bonuses) => bonuses.map((bonus) => bonus.id))
        expect(duplicatesOf(ids)).toEqual([])
    })
})

describe('tables keyed by map id (R-8)', () => {
    it('keys every table by the same map ids', () => {
        expect(Object.keys(RAILROAD_INTRODUCTIONS)).toEqual(['map.usa'])
        expect(Object.keys(PLACEMENT_LIMITS)).toEqual(['map.usa'])
        expect(Object.keys(BONUSES)).toEqual(['map.usa'])
    })
})

describe('duplicate detection', () => {
    it('reports a repeated id', () => {
        expect(duplicatesOf(['railroad.red', 'railroad.blue', 'railroad.red'])).toEqual([
            'railroad.red'
        ])
    })
})

describe('group limits (R-4.1.4, R-8)', () => {
    it('lets a railroad hold at most two East Coast cities on the USA map', () => {
        expect(GROUP_LIMITS['map.usa']).toEqual([{ group: 'east-coast', perRailroad: 2 }])
    })
})

describe('the mountain cost (R-3.2.4, R-8)', () => {
    const MOUNTAIN = 'hex.usa.6-56'
    const PLAIN = 'hex.usa.7-55'
    const CITY = 'hex.usa.7-57'

    it('lowers the USA limit for any railroad’s mountain placement, and for no other', () => {
        for (const railroadId of RAILROAD_IDS) {
            expect(lowersLimit('map.usa', railroadId, MOUNTAIN)).toBe(true)
            expect(lowersLimit('map.usa', railroadId, PLAIN)).toBe(false)
            expect(lowersLimit('map.usa', railroadId, CITY)).toBe(false)
        }
    })

    it('spares the railroads a map exempts, on the fixture map', () => {
        const limits: MapPlacementLimits = {
            byPlayerCount: [{ playerCount: 3, limit: 7 }],
            mountainReduction: 2,
            mountainExempt: ['railroad.orange']
        }
        const mountain = FLAT_FIXTURE_MAP.hex(MOUNTAIN_HEX)
        expect(chargesMountain(limits, 'railroad.orange', mountain)).toBe(false)
        expect(chargesMountain(limits, 'railroad.red', mountain)).toBe(true)
        expect(chargesMountain(limits, 'railroad.red', FLAT_FIXTURE_MAP.hex(ALPHA_HEX))).toBe(false)
    })

    it('exempts no railroad on the USA map', () => {
        expect(PLACEMENT_LIMITS['map.usa'].mountainExempt ?? []).toEqual([])
    })
})

describe('every per-map table (R-8)', () => {
    it('has a row for every map id the code knows, and no other', () => {
        const tables: Record<string, object> = {
            BOARD_MAPS,
            MAP_KEY_OF,
            MAP_DETAILS,
            RAILROAD_INTRODUCTIONS,
            PLACEMENT_LIMITS,
            GROUP_LIMITS,
            BONUSES,
            BONUS_RULES,
            ROUND_END_PASSENGER_CITY
        }
        for (const [name, table] of Object.entries(tables)) {
            expect([name, Object.keys(table)]).toEqual([name, [...MAP_IDS]])
        }
    })

    it('has no Paris Travels on the USA map', () => {
        expect(ROUND_END_PASSENGER_CITY['map.usa']).toBe(null)
    })
})
